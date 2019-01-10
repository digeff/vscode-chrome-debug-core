import { DebugProtocol } from 'vscode-debugprotocol';
import { SourceAlreadyResolvedToLoadedSource, ISource } from '../internal/sources/source';
import { HandlesRegistry } from './handlesRegistry';
import { SourcesLogic } from '../internal/sources/sourcesLogic';
import { ILoadedSource } from '../internal/sources/loadedSource';
import { parseResourceIdentifier } from '../internal/sources/resourceIdentifier';

export class ClientSourceParser {
    constructor(
        private readonly _handlesRegistry: HandlesRegistry,
        private readonly _sourcesLogic: SourcesLogic) { }

    public toSource(clientSource: DebugProtocol.Source): ISource {
        if (clientSource.path && !clientSource.sourceReference) {
            const identifier = parseResourceIdentifier(clientSource.path);
            return this._sourcesLogic.createSourceResolver(identifier);
        } else if (clientSource.sourceReference) {
            const source = this.getSourceFromId(clientSource.sourceReference);
            return new SourceAlreadyResolvedToLoadedSource(source);
        } else {
            throw new Error(`Expected the source to have a path (${clientSource.path}) either-or a source reference (${clientSource.sourceReference})`);
        }
    }

    public getSourceFromId(handle: number): ILoadedSource {
        return this._handlesRegistry.sources.getObjectById(handle);
    }
}