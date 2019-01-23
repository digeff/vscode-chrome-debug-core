import { IScript } from '../scripts/script';
import { CDTPScriptUrl } from './resourceIdentifierSubtypes';
import { IResourceIdentifier } from './resourceIdentifier';
import { ILoadedSource, ICurrentScriptRelationships, ICurrentScriptRelationshipsProvider, ContentsLocation } from './loadedSource';

/**
 * Loaded Source classification:
 * Is the script content available on a single place, or two places? (e.g.: You can find similar scripts in multiple different paths)
 *  1. Single: Is the single place on storage, or is this a dynamic script?
 *      Single path on storage: RuntimeScriptRunFromStorage
 *      Single path not on storage: DynamicRuntimeScript
 *  2. Two: We assume one path is from the webserver, and the other path is in the workspace: RuntimeScriptWithSourceOnWorkspace
 */
export class IdentifiedLoadedSource<TSource extends string = string> implements ILoadedSource<TSource> {
    readonly script: IScript; // TODO DIEGO: Remove this

    private constructor(public readonly identifier: IResourceIdentifier<TSource>, private readonly _currentScriptRelationshipsProvider: ICurrentScriptRelationshipsProvider, public readonly contentsLocation: ContentsLocation) { }

    public get url(): CDTPScriptUrl {
        return this.script.url;
    }

    public get currentScriptRelationships(): ICurrentScriptRelationships {
        return this._currentScriptRelationshipsProvider.currentScriptRelationships(this);
    }

    public isMappedSource(): boolean {
        return false;
    }

    public doesScriptHasUrl(): boolean {
        return true;
    }

    public isEquivalentTo(source: ILoadedSource<TSource>): boolean {
        return this === source;
    }

    public toString(): string {
        return `src:${this.identifier}`;
    }

    public static create<TString extends string>(identifier: IResourceIdentifier<TString>, currentScriptRelationshipsProvider: ICurrentScriptRelationshipsProvider): IdentifiedLoadedSource<TString> {
        const contentsLocation = fs.existsSync(identifier.textRepresentation) ? ContentsLocation.PersistentStorage : ContentsLocation.DynamicMemory;
        return new IdentifiedLoadedSource<TString>(identifier, currentScriptRelationshipsProvider, contentsLocation);
    }
}
