import { newResourceIdentifierMap, IResourceIdentifier } from '../../internal/sources/resourceIdentifier';
import { ILoadedSource, ICurrentScriptRelationshipsProvider } from '../../internal/sources/loadedSource';
import { CDTPScriptUrl } from '../../internal/sources/resourceIdentifierSubtypes';
import { ValidatedMultiMap } from '../../collections/validatedMultiMap';
import { ILoadedSourceToScriptRelationship } from '../../internal/sources/loadedSourceToScriptRelationship';

export class LoadedSourcesRegistry implements ICurrentScriptRelationshipsProvider {
    // TODO: Figure out a way to store ILoadedSource<CDTPScriptUrl> and ILoadedSource<string> in a single map while preserving type safety
    private readonly _loadedSourceByPath = newResourceIdentifierMap<ILoadedSource>();

    private readonly _loadedSourceToCurrentScriptRelationships = new ValidatedMultiMap<ILoadedSource, ILoadedSourceToScriptRelationship>();

    public getOrAdd(url: IResourceIdentifier<CDTPScriptUrl>,
        obtainValueToAdd: (provider: ICurrentScriptRelationshipsProvider) => ILoadedSource<CDTPScriptUrl>): ILoadedSource<CDTPScriptUrl>;
    public getOrAdd(path: IResourceIdentifier,
        obtainValueToAdd: (provider: ICurrentScriptRelationshipsProvider) => ILoadedSource): ILoadedSource;
    public getOrAdd<TString extends string>(pathOrUrl: IResourceIdentifier<TString>,
        obtainValueToAdd: (provider: ICurrentScriptRelationshipsProvider) => ILoadedSource<TString>): ILoadedSource<TString> {
        // TODO: The casts in this method are actually false sometimes (Although they won't cause any issues at runtime). Figure out a way of doing this with type safety
        const url = <IResourceIdentifier<CDTPScriptUrl>><unknown>pathOrUrl;
        return <ILoadedSource<TString>>this._loadedSourceByPath.getOrAdd(url, obtainValueToAdd);
    }

    public registerRelationship(loadedSource: ILoadedSource, relationship: ILoadedSourceToScriptRelationship) {
        this._loadedSourceToCurrentScriptRelationships.add(loadedSource, relationship);
    }

    public currentScriptRelationships(loadedSource: ILoadedSource<string>): Set<ILoadedSourceToScriptRelationship> {
        return this._loadedSourceToCurrentScriptRelationships.get(loadedSource);
    }
}