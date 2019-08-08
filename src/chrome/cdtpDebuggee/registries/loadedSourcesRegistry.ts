import { newResourceIdentifierMap, IResourceIdentifier } from '../../internal/sources/resourceIdentifier';
import { ICurrentScriptRelationshipsProvider, IScriptMapper } from '../../internal/sources/loadedSource';
import { IdentifiedLoadedSource, ScriptMapper } from '../../internal/sources/identifiedLoadedSource';
import { CDTPScriptUrl } from '../../internal/sources/resourceIdentifierSubtypes';
import { ValidatedMultiMap } from '../../collections/validatedMultiMap';
import { ILoadedSourceToScriptRelationship } from '../../internal/sources/loadedSourceToScriptRelationship';
import { injectable } from 'inversify';
import { inspect } from 'util';

@injectable()
export class LoadedSourcesRegistry implements ICurrentScriptRelationshipsProvider {
    // TODO: Figure out a way to store IdentifiedLoadedSource<CDTPScriptUrl> and IdentifiedLoadedSource<string> in a single map while preserving type safety
    private readonly _loadedSourceByPath = newResourceIdentifierMap<IdentifiedLoadedSource>();

    private readonly _loadedSourceToCurrentScriptRelationships = ValidatedMultiMap.empty<IdentifiedLoadedSource, ILoadedSourceToScriptRelationship>();

    public getOrAdd(pathOrUrl: IResourceIdentifier,
        obtainValueToAdd: (provider: ICurrentScriptRelationshipsProvider) => IdentifiedLoadedSource): IdentifiedLoadedSource {
        // TODO: The casts in this method are actually false sometimes (Although they won't cause any issues at runtime). Figure out a way of doing this with type safety
        const url = <IResourceIdentifier<CDTPScriptUrl>><unknown>pathOrUrl;
        return <IdentifiedLoadedSource>this._loadedSourceByPath.getOrAdd(url, () => {
            const newLoadedSource = obtainValueToAdd(this);
            this._loadedSourceToCurrentScriptRelationships.addKeyIfNotExistant(newLoadedSource);
            return newLoadedSource;
        });
    }

    public registerRelationship(loadedSource: IdentifiedLoadedSource, relationship: ILoadedSourceToScriptRelationship) {
        this._loadedSourceToCurrentScriptRelationships.add(loadedSource, relationship);
    }

    public scriptMapper(loadedSource: IdentifiedLoadedSource<string>): IScriptMapper {
        return new ScriptMapper(Array.from(this._loadedSourceToCurrentScriptRelationships.get(loadedSource)));
    }

    // After we refresh the page, we discard all relationships to scripts
    public clearAllRelationships(): void {
        // Warning: Throwing away the scripts' information here only prevents code executed in the future from accessing the scripts
        //      If we have any code currently on-flight, that already accessed the script, this method won't fix that. If that code uses
        //      the scriptId, or performs any operation that is invalid with that script because the execution context was cleared, that operation
        //      will most likely fail.
        //      If Users start seeing those kind of issues, we'll need to figure out what enhancements we need to do to handle those cases
        // Also see: cdtpScriptsRegistry.ts
        this._loadedSourceToCurrentScriptRelationships.clear();
    }

    public [inspect.custom](): string {
        return this.toString(inspect);
    }

    public toString(print = (value: unknown) => `${value}`): string {
        return `Loaded sources: ${this._loadedSourceByPath}\nRelationships:\n${this._loadedSourceToCurrentScriptRelationships}`;
    }
}