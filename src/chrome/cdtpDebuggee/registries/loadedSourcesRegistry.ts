import { newResourceIdentifierMap, IResourceIdentifier } from '../../internal/sources/resourceIdentifier';
import { ICurrentScriptRelationshipsProvider, ICurrentScriptRelationships, CurrentScriptRelationships } from '../../internal/sources/loadedSource';
import { IdentifiedLoadedSource } from "../../internal/sources/identifiedLoadedSource";
import { CDTPScriptUrl } from '../../internal/sources/resourceIdentifierSubtypes';
import { ValidatedMultiMap } from '../../collections/validatedMultiMap';
import { ILoadedSourceToScriptRelationship } from '../../internal/sources/loadedSourceToScriptRelationship';

export class LoadedSourcesRegistry implements ICurrentScriptRelationshipsProvider {
    // TODO: Figure out a way to store IdentifiedLoadedSource<CDTPScriptUrl> and IdentifiedLoadedSource<string> in a single map while preserving type safety
    private readonly _loadedSourceByPath = newResourceIdentifierMap<IdentifiedLoadedSource>();

    private readonly _loadedSourceToCurrentScriptRelationships = new ValidatedMultiMap<IdentifiedLoadedSource, ILoadedSourceToScriptRelationship>();

    public getOrAdd(pathOrUrl: IResourceIdentifier,
        obtainValueToAdd: (provider: ICurrentScriptRelationshipsProvider) => IdentifiedLoadedSource): IdentifiedLoadedSource {
        // TODO: The casts in this method are actually false sometimes (Although they won't cause any issues at runtime). Figure out a way of doing this with type safety
        const url = <IResourceIdentifier<CDTPScriptUrl>><unknown>pathOrUrl;
        return <IdentifiedLoadedSource>this._loadedSourceByPath.getOrAdd(url, () => obtainValueToAdd(this));
    }

    public registerRelationship(loadedSource: IdentifiedLoadedSource, relationship: ILoadedSourceToScriptRelationship) {
        this._loadedSourceToCurrentScriptRelationships.add(loadedSource, relationship);
    }

    public currentScriptRelationships(loadedSource: IdentifiedLoadedSource<string>): ICurrentScriptRelationships {
        return new CurrentScriptRelationships(Array.from(this._loadedSourceToCurrentScriptRelationships.get(loadedSource)));
    }
}