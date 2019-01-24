import { CDTP, parseResourceIdentifier, BasePathTransformer, BaseSourceMapTransformer } from '../../..';
import { CDTPEventsEmitterDiagnosticsModule } from '../infrastructure/cdtpDiagnosticsModule';
import { CDTPScriptsRegistry } from '../registries/cdtpScriptsRegistry';
import { IScript, Script } from '../../internal/scripts/script';
import { createCDTPScriptUrl, CDTPScriptUrl } from '../../internal/sources/resourceIdentifierSubtypes';
import { SourcesMapper, NoSourceMapping as NoSourcesMapper, ISourcesMapper } from '../../internal/scripts/sourcesMapper';
import { IResourceIdentifier } from '../../internal/sources/resourceIdentifier';
import { TYPES } from '../../dependencyInjection.ts/types';
import { CDTPStackTraceParser } from '../protocolParsers/cdtpStackTraceParser';
import { inject } from 'inversify';
import { integer } from '../cdtpPrimitives';
import { CodeFlowStackTrace } from '../../internal/stackTraces/codeFlowStackTrace';
import { IExecutionContext } from '../../internal/scripts/executionContext';
import { CDTPDomainsEnabler } from '../infrastructure/cdtpDomainsEnabler';
import { LoadedSourcesRegistry } from '../registries/loadedSourcesRegistry';
import { ILoadedSource, SourceScriptRelationship } from '../../internal/sources/loadedSource';
import { IdentifiedLoadedSource } from '../../internal/sources/identifiedLoadedSource';
import { DevelopmentSourceOf, RuntimeSourceOf, MappedSourceOf } from '../../internal/sources/loadedSourceToScriptRelationship';
import { Position } from '../../internal/locations/location';
import { createLineNumber, createColumnNumber } from '../../internal/locations/subtypes';
import { RangeInResource } from '../../internal/locations/rangeInScript';
import _ = require('lodash');

/**
 * A new JavaScript Script has been parsed by the debugee and it's about to be executed
 */
export interface ScriptParsedEvent {
    readonly script: IScript;
    readonly url: string;
    readonly startLine: integer;
    readonly startColumn: integer;
    readonly endLine: integer;
    readonly endColumn: integer;
    readonly executionContext: IExecutionContext;
    readonly hash: string;
    readonly executionContextAuxData?: any;
    readonly isLiveEdit?: boolean;
    readonly sourceMapURL?: string;
    readonly hasSourceURL?: boolean;
    readonly isModule?: boolean;
    readonly length?: integer;
    readonly stackTrace?: CodeFlowStackTrace;
}

export type ScriptParsedListener = (params: ScriptParsedEvent) => void;

export interface IScriptParsedProvider {
    onScriptParsed(listener: (event: ScriptParsedEvent) => void): void;
}

export class CDTPOnScriptParsedEventProvider extends CDTPEventsEmitterDiagnosticsModule<CDTP.DebuggerApi, void, CDTP.Debugger.EnableResponse> implements IScriptParsedProvider {
    protected readonly api = this._protocolApi.Debugger;

    private readonly _stackTraceParser = new CDTPStackTraceParser(this._scriptsRegistry);

    public onScriptParsed = this.addApiListener('scriptParsed', async (params: CDTP.Debugger.ScriptParsedEvent) => {
        // The stack trace and hash can be large and the DA doesn't need it.
        delete params.stackTrace;
        delete params.hash;

        const creator = !!params.url ? IdentifiedScriptCreator : UnidentifiedScriptCreator;
        await new creator(this._scriptsRegistry, this._loadedSourcesRegistry, this._pathTransformer, this._sourceMapTransformer, params).createAndRegisterScript();

        return await this.toScriptParsedEvent(params);
    });

    constructor(
        @inject(TYPES.CDTPClient) private readonly _protocolApi: CDTP.ProtocolApi,
        @inject(TYPES.BasePathTransformer) private readonly _pathTransformer: BasePathTransformer,
        @inject(TYPES.BaseSourceMapTransformer) private readonly _sourceMapTransformer: BaseSourceMapTransformer,
        @inject(TYPES.CDTPScriptsRegistry) private readonly _scriptsRegistry: CDTPScriptsRegistry,
        @inject(TYPES.IDomainsEnabler) domainsEnabler: CDTPDomainsEnabler,
        @inject(LoadedSourcesRegistry) private readonly _loadedSourcesRegistry: LoadedSourcesRegistry,
    ) {
        super(domainsEnabler);
    }

    private async toScriptParsedEvent(params: CDTP.Debugger.ScriptParsedEvent): Promise<ScriptParsedEvent> {
        const executionContext = this._scriptsRegistry.getExecutionContextById(params.executionContextId);

        return {
            url: params.url,
            startLine: params.startLine,
            startColumn: params.startColumn,
            endLine: params.endLine,
            endColumn: params.endColumn,
            executionContext: executionContext,
            hash: params.hash,
            executionContextAuxData: params.executionContextAuxData,
            isLiveEdit: params.isLiveEdit,
            sourceMapURL: params.sourceMapURL,
            hasSourceURL: params.hasSourceURL,
            isModule: params.isModule,
            length: params.length,
            script: await this._scriptsRegistry.getScriptByCdtpId(params.scriptId),
            stackTrace: params.stackTrace && await this._stackTraceParser.toStackTraceCodeFlow(params.stackTrace)
        };
    }
}

abstract class ScriptCreator {
    protected readonly runtimeSourcePath = parseResourceIdentifier(createCDTPScriptUrl(this._scriptParsedEvent.url || ''));

    constructor(
        private readonly _scriptsRegistry: CDTPScriptsRegistry,
        protected readonly _loadedSourcesRegistry: LoadedSourcesRegistry,
        protected readonly _pathTransformer: BasePathTransformer,
        private readonly _sourceMapTransformer: BaseSourceMapTransformer,
        protected readonly _scriptParsedEvent: CDTP.Debugger.ScriptParsedEvent,
    ) { }

    public async createAndRegisterScript(): Promise<IScript> {
        const executionContext = this._scriptsRegistry.getExecutionContextById(this._scriptParsedEvent.executionContextId);

        const script = await this._scriptsRegistry.registerScript(this._scriptParsedEvent.scriptId, async () => {
            const sourceMapper = await this.sourceMapper();
            return this.createScript(executionContext, sourceMapper, this.mappedSources(sourceMapper));
        });

        script.mappedSources.forEach(source =>
            this._loadedSourcesRegistry.registerRelationship(source, new MappedSourceOf(script.developmentSource, script)));

        await this.registerRuntimeAndDevelopmentSourcesRelationships(script);

        return script;
    }

    protected abstract createScript(executionContext: IExecutionContext, sourceMapper: ISourcesMapper, mappedSources: IdentifiedLoadedSource<string>[]): Promise<IScript>;

    protected abstract registerRuntimeAndDevelopmentSourcesRelationships(script: IScript): Promise<void>;

    private mappedSources(sourceMapper: SourcesMapper | NoSourcesMapper) {
        return sourceMapper.sources.map((path: string) => this.obtainLoadedSource(parseResourceIdentifier(path), SourceScriptRelationship.Unknown));
    }

    private async sourceMapper() {
        const sourceMap = await this._sourceMapTransformer.scriptParsed(this.runtimeSourcePath.canonicalized, this._scriptParsedEvent.sourceMapURL);
        const sourceMapper = sourceMap
            ? new SourcesMapper(sourceMap)
            : new NoSourcesMapper();
        return sourceMapper;
    }

    protected scriptRange(runtimeSource: ILoadedSource<CDTPScriptUrl>) {
        const startPosition = new Position(createLineNumber(this._scriptParsedEvent.startLine), createColumnNumber(this._scriptParsedEvent.startColumn));
        const endPosition = new Position(createLineNumber(this._scriptParsedEvent.endLine), createColumnNumber(this._scriptParsedEvent.endColumn));
        const scriptRange = new RangeInResource(runtimeSource, startPosition, endPosition);
        return scriptRange;
    }

    protected obtainLoadedSource(sourceUrl: IResourceIdentifier, sourceScriptRelationship: SourceScriptRelationship): IdentifiedLoadedSource {
        return this._loadedSourcesRegistry.getOrAdd(sourceUrl, provider => {
            return IdentifiedLoadedSource.create(sourceUrl, sourceScriptRelationship, provider);
        });
    }
}

class IdentifiedScriptCreator extends ScriptCreator {
    private readonly runtimeSource = _.memoize(() => this.obtainRuntimeSource());
    private readonly developmentSource = _.memoize(() => this.obtainDevelopmentSource());

    protected async createScript(executionContext: IExecutionContext, sourceMapper: ISourcesMapper, mappedSources: IdentifiedLoadedSource<string>[]): Promise<IScript> {
        return Script.create(executionContext, this.runtimeSource(), await this.developmentSource(), sourceMapper, mappedSources, this.scriptRange(this.runtimeSource()));
    }

    private obtainRuntimeSource(): IdentifiedLoadedSource<CDTPScriptUrl> {
        // This is an heuristic. I think that if the script starts on (0, 0) then that means the file is a script file, and not an .html file or something which is a script and something else
        // I cannot think of any case where this would be false, but we've been surprised before...
        const isSingleScript = this._scriptParsedEvent.startLine === 0 && this._scriptParsedEvent.startColumn === 0;
        const sourceScriptRelationship = isSingleScript ? SourceScriptRelationship.SourceIsSingleScript : SourceScriptRelationship.SourceIsMoreThanAScript;

        // TODO: Figure out a way to remove the cast in next line
        return <IdentifiedLoadedSource<CDTPScriptUrl>><unknown>this.obtainLoadedSource(this.runtimeSourcePath, sourceScriptRelationship);
    }

    private async obtainDevelopmentSource(): Promise<IdentifiedLoadedSource> {
        const developmentSourceLocation = await this._pathTransformer.scriptParsed(this.runtimeSourcePath);

        // The development file should have the same contents, so it should have the same source script relationship as the runtime file
        return this.obtainLoadedSource(developmentSourceLocation, this.runtimeSource().sourceScriptRelationship);
    }

    protected async registerRuntimeAndDevelopmentSourcesRelationships(script: IScript): Promise<void> {
        this._loadedSourcesRegistry.registerRelationship(await this.developmentSource(), new DevelopmentSourceOf(this.runtimeSource()));

        this._loadedSourcesRegistry.registerRelationship(this.runtimeSource(), new RuntimeSourceOf(script));
    }
}

class UnidentifiedScriptCreator extends ScriptCreator {
    protected async createScript(executionContext: IExecutionContext, sourceMapper: ISourcesMapper, mappedSources: IdentifiedLoadedSource<string>[]): Promise<IScript> {
        return Script.createWithUnidentifiedSource(executionContext, sourceMapper, mappedSources, (runtimeSource: ILoadedSource<CDTPScriptUrl>) => this.scriptRange(runtimeSource));
    }

    protected async registerRuntimeAndDevelopmentSourcesRelationships(_script: IScript): Promise<void> { }
}
