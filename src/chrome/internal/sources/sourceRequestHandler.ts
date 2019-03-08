import { ICommandHandlerDeclaration, CommandHandlerDeclaration, ICommandHandlerDeclarer } from '../features/components';
import { injectable, inject } from 'inversify';
import { ClientSourceParser } from '../../client/clientSourceParser';
import { HandlesRegistry } from '../../client/handlesRegistry';
import { SourcesRetriever } from './sourcesRetriever';
import { DebugProtocol } from 'vscode-debugprotocol';
import { ITelemetryPropertyCollector } from '../../../telemetry';
import { ISourceResponseBody, IGetLoadedSourcesResponseBody } from '../../../debugAdapterInterfaces';
import { ILoadedSourceTreeNode } from './loadedSource';
import { asyncMap } from '../../collections/async';
import { SourceToClientConverter } from '../../client/sourceToClientConverter';

@injectable()
export class SourceRequestHandler implements ICommandHandlerDeclarer {
    private readonly _clientSourceParser = new ClientSourceParser(this._handlesRegistry, this._sourcesLogic);
    private readonly _sourceToClientConverter = new SourceToClientConverter(this._handlesRegistry);

    public constructor(
        @inject(HandlesRegistry) private readonly _handlesRegistry: HandlesRegistry,
        private readonly _sourcesLogic: SourcesRetriever) { }

    public getCommandHandlerDeclarations(): ICommandHandlerDeclaration[] {
        return CommandHandlerDeclaration.fromLiteralObject({
            source: (args: DebugProtocol.SourceArguments) => this.source(args),
            loadedSources: () => this.loadedSources(),
        });
    }

    public async loadedSources(): Promise<IGetLoadedSourcesResponseBody> {
        return { sources: await asyncMap(await this._sourcesLogic.loadedSourcesTrees(), st => this.toSourceTree(st)) };
    }

    public async source(args: DebugProtocol.SourceArguments, _telemetryPropertyCollector?: ITelemetryPropertyCollector, _requestSeq?: number): Promise<ISourceResponseBody> {
        if (args.source) {
            const source = this._clientSourceParser.toSource(args.source);
            const sourceText = await this._sourcesLogic.text(source);
            return {
                content: sourceText,
                mimeType: 'text/javascript'
            };
        } else {
            throw new Error(`Expected the source request to have a source argument yet it was ${args.source}`);
        }
    }

    private toSourceLeafs(sources: ILoadedSourceTreeNode[]): Promise<DebugProtocol.Source[]> {
        return Promise.all(sources.map(source => this.toSourceTree(source)));
    }

    private async toSourceTree(sourceMetadata: ILoadedSourceTreeNode): Promise<DebugProtocol.Source> {
        const source = await this._sourceToClientConverter.toSource(sourceMetadata.mainSource);
        (source as any).sources = await this.toSourceLeafs(sourceMetadata.relatedSources);
        return source;
    }
}