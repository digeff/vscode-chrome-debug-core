import { Crdp, BasePathTransformer, BaseSourceMapTransformer } from '../..';
import { IScript, Script } from '../internal/script';
import { RuntimeScriptsManager } from './runtimeScriptsManager';
import { ScriptParsedEvent, ExceptionDetails, LogEntry } from './events';
import { StackTraceCodeFlow, CallFrameCodeFlow, CallFrame, createCallFrameName, Scope, ScriptCallFrame } from '../internal/stackTraces';
import { LocationInScript, ZeroBasedLocation, ScriptOrSourceOrIdentifierOrUrlRegexp } from '../internal/locationInResource';
import { asyncUndefinedOnFailure } from '../internal/failures';
import { SourcesMapper, NoSourceMapping } from '../internal/sourcesMapper';
import { parseResourceIdentifier, IResourceIdentifier, ResourceName } from '../internal/resourceIdentifier';
import { CDTPScriptUrl } from '../internal/resourceIdentifierSubtypes';
import { BreakpointInScript, BreakpointInUrl, BreakpointInUrlRegexp, Breakpoint } from '../internal/breakpoints/breakpoint';
import { BreakpointRecipieInUrl, BreakpointRecipieInScript, BPRecipie, BreakpointRecipieInUrlRegexp, URLRegexp } from '../internal/breakpoints/bpRecipie';
import { BreakpointIdRegistry } from './breakpointIdRegistry';

export type CDTPResource = IScript | URLRegexp | IResourceIdentifier<CDTPScriptUrl>;

interface HasLocation {
    lineNumber: number;
    columnNumber?: number;
}

interface HasScript {
    scriptId: Crdp.Runtime.ScriptId;
}

interface HasScriptLocation extends HasLocation, HasScript { }

interface BreakpointClass<TResource extends ScriptOrSourceOrIdentifierOrUrlRegexp> {
    new(recipie: BPRecipie<TResource>, actualLocation: LocationInScript): Breakpoint<TResource>;
}

export class TargetToInternal {
    public toBPRecipie(breakpointId: Crdp.Debugger.BreakpointId): BPRecipie<ScriptOrSourceOrIdentifierOrUrlRegexp> {
        return this._breakpointIdRegistry.getRecipieByBreakpointId(breakpointId);
    }

    public async toBreakpoinInResource<TResource extends ScriptOrSourceOrIdentifierOrUrlRegexp>
        (classToUse: BreakpointClass<TResource>, bpRecipie: BPRecipie<TResource>,
        breakpointId: Crdp.Debugger.BreakpointId, actualLocation: Crdp.Debugger.Location): Promise<Breakpoint<TResource>> {

        const breakpoint = new classToUse(bpRecipie, await this.toLocationInScript(actualLocation));
        this._breakpointIdRegistry.registerRecipie(breakpointId, bpRecipie);
        return breakpoint;
    }

    public async toBreakpointInScript(bpRecipie: BreakpointRecipieInScript,
        params: Crdp.Debugger.SetBreakpointResponse): Promise<BreakpointInScript> {
        return this.toBreakpoinInResource<IScript>(BreakpointInScript, bpRecipie, params.breakpointId, params.actualLocation);

        const breakpoint = new BreakpointInScript(bpRecipie, await this.toLocationInScript(params.actualLocation));
        this._breakpointIdRegistry.registerRecipie(params.breakpointId, bpRecipie);
        return breakpoint;
    }

    public async toBreakpointInUrl(bpRecipie: BreakpointRecipieInUrl,
        breakpointId: Crdp.Debugger.BreakpointId,
        actualLocation: Crdp.Debugger.Location): Promise<BreakpointInUrl> {
        return this.toBreakpoinInResource<IResourceIdentifier>(BreakpointInUrl, bpRecipie, breakpointId, actualLocation);

        const breakpoint = new BreakpointInUrl(bpRecipie, await this.toLocationInScript(actualLocation));
        this._breakpointIdRegistry.registerRecipie(breakpointId, bpRecipie);
        return breakpoint;
    }

    public async toBreakpointInUrlRegexp(bpRecipie: BreakpointRecipieInUrlRegexp, breakpointId: Crdp.Debugger.BreakpointId,
        actualLocation: Crdp.Debugger.Location): Promise<BreakpointInUrlRegexp> {
        return this.toBreakpoinInResource<URLRegexp>(BreakpointInUrlRegexp, bpRecipie, breakpointId, actualLocation);

        const breakpoint = new BreakpointInUrlRegexp(bpRecipie, await this.toLocationInScript(actualLocation));
        this._breakpointIdRegistry.registerRecipie(breakpointId, bpRecipie);
        return breakpoint;
    }

    public async toScriptParsedEvent(params: Crdp.Debugger.ScriptParsedEvent): Promise<ScriptParsedEvent> {
        return {
            script: await this.toScript(params.scriptId),
            url: params.url,
            startLine: params.startLine,
            startColumn: params.startColumn,
            endLine: params.endLine,
            endColumn: params.endColumn,
            executionContextId: params.executionContextId,
            hash: params.hash,
            executionContextAuxData: params.executionContextAuxData,
            isLiveEdit: params.isLiveEdit,
            sourceMapURL: params.sourceMapURL,
            hasSourceURL: params.hasSourceURL,
            isModule: params.isModule,
            length: params.length,
            stackTrace: params.stackTrace && await this.toStackTraceCodeFlow(params.stackTrace)
        };
    }

    public async toStackTraceCodeFlow(stackTrace: NonNullable<Crdp.Runtime.StackTrace>): Promise<StackTraceCodeFlow<IScript>> {
        return {
            callFrames: await Promise.all(stackTrace.callFrames.map((callFrame, index) => this.RuntimetoCallFrameCodeFlow(index, callFrame))),
            description: stackTrace.description, parent: stackTrace.parent && await this.toStackTraceCodeFlow(stackTrace.parent)
        };
    }

    private async configurableToCallFrameCodeFlow(index: number, callFrame: Crdp.Runtime.CallFrame | Crdp.Debugger.CallFrame, location: HasScriptLocation): Promise<CallFrameCodeFlow<IScript>> {
        const scriptLocation = await this.getScriptLocation(location);
        const name = createCallFrameName(scriptLocation.script, callFrame.functionName);
        return new CallFrameCodeFlow(index, name, scriptLocation);
    }

    public RuntimetoCallFrameCodeFlow(index: number, callFrame: Crdp.Runtime.CallFrame): Promise<CallFrameCodeFlow<IScript>> {
        return this.configurableToCallFrameCodeFlow(index, callFrame, callFrame);
    }

    public DebuggertoCallFrameCodeFlow(index: number, callFrame: Crdp.Debugger.CallFrame): Promise<CallFrameCodeFlow<IScript>> {
        return this.configurableToCallFrameCodeFlow(index, callFrame, callFrame.location);
    }

    public async toCallFrame(index: number, callFrame: Crdp.Debugger.CallFrame): Promise<CallFrame<IScript>> {
        return new ScriptCallFrame(await this.DebuggertoCallFrameCodeFlow(index, callFrame),
            await Promise.all(callFrame.scopeChain.map(scope => this.toScope(scope))),
            callFrame.this, callFrame.returnValue);
    }

    public async toScope(scope: Crdp.Debugger.Scope): Promise<Scope> {
        return {
            type: scope.type,
            object: scope.object,
            name: scope.name,
            // TODO FILE BUG: Chrome sometimes returns line -1 when the doc says it's 0 based
            startLocation: await asyncUndefinedOnFailure(async () => scope.startLocation && await this.toLocationInScript(scope.startLocation)),
            endLocation: await asyncUndefinedOnFailure(async () => scope.endLocation && await this.toLocationInScript(scope.endLocation))
        };
    }

    public async toExceptionDetails(exceptionDetails: Crdp.Runtime.ExceptionDetails): Promise<ExceptionDetails> {
        return {
            exceptionId: exceptionDetails.exceptionId,
            text: exceptionDetails.text,
            lineNumber: exceptionDetails.lineNumber,
            columnNumber: exceptionDetails.columnNumber,
            script: exceptionDetails.scriptId ? await this.toScript(exceptionDetails.scriptId) : undefined,
            url: exceptionDetails.url,
            stackTrace: exceptionDetails.stackTrace && await this.toStackTraceCodeFlow(exceptionDetails.stackTrace),
            exception: exceptionDetails.exception,
            executionContextId: exceptionDetails.executionContextId,
        };
    }

    public toScript(scriptId: Crdp.Runtime.ScriptId): Promise<IScript> {
        return this._runtimeScriptsManager.getScriptById(scriptId);
    }

    public toLocationInScript(location: Crdp.Debugger.Location): Promise<LocationInScript> {
        return this.getScriptLocation(location);
    }

    public async toLogEntry(entry: Crdp.Log.LogEntry): Promise<LogEntry> {
        return {
            source: entry.source,
            level: entry.level,
            text: entry.text,
            timestamp: entry.timestamp,
            url: entry.url,
            lineNumber: entry.lineNumber,
            stackTrace: entry.stackTrace && await this.toStackTraceCodeFlow(entry.stackTrace),
            networkRequestId: entry.networkRequestId,
            workerId: entry.workerId,
            args: entry.args,
        };
    }

    public async createAndRegisterScript(params: Crdp.Debugger.ScriptParsedEvent): Promise<IScript> {
        // The stack trace and hash can be large and the DA doesn't need it.
        delete params.stackTrace;
        delete params.hash;

        const script = await this._runtimeScriptsManager.registerNewScript(params.scriptId, async () => {
            if (params.url !== undefined && params.url !== '') {
                const runtimeSourceLocation = parseResourceIdentifier<CDTPScriptUrl>(params.url as CDTPScriptUrl);
                const developmentSourceLocation = await this._pathTransformer.scriptParsed(runtimeSourceLocation);
                const sourceMap = await this._sourceMapTransformer.scriptParsed(developmentSourceLocation.canonicalized, params.sourceMapURL);
                const sourceMapper = sourceMap
                    ? new SourcesMapper(sourceMap)
                    : new NoSourceMapping();

                const runtimeScript = Script.create(runtimeSourceLocation, developmentSourceLocation, sourceMapper);
                return runtimeScript;
            } else {
                const sourceMap = await this._sourceMapTransformer.scriptParsed('', params.sourceMapURL);
                const sourceMapper = sourceMap
                    ? new SourcesMapper(sourceMap)
                    : new NoSourceMapping();
                const runtimeScript = Script.createEval(new ResourceName(params.scriptId as CDTPScriptUrl), sourceMapper);
                return runtimeScript;
            }
        });

        return script;
    }

    private getScript(crdpScript: HasScript): Promise<IScript> {
        return this.toScript(crdpScript.scriptId);
    }

    private getLocation(crdpLocation: HasLocation): ZeroBasedLocation {
        return new ZeroBasedLocation(crdpLocation.lineNumber, crdpLocation.columnNumber);
    }

    private async getScriptLocation(crdpScriptLocation: HasScriptLocation): Promise<LocationInScript> {
        return new LocationInScript(await this.getScript(crdpScriptLocation), this.getLocation(crdpScriptLocation));
    }

    constructor(
        private readonly _runtimeScriptsManager: RuntimeScriptsManager,
        private readonly _pathTransformer: BasePathTransformer,
        private readonly _sourceMapTransformer: BaseSourceMapTransformer,
        private readonly _breakpointIdRegistry: BreakpointIdRegistry) { }
}