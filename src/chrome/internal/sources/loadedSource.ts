import * as fs from 'fs';
import { IScript } from '../scripts/script';
import { CDTPScriptUrl } from './resourceIdentifierSubtypes';
import { IResourceIdentifier, parseResourceIdentifier, ResourceName } from './resourceIdentifier';
import { determineOrderingOfStrings } from '../../collections/utilities';
import { IEquivalenceComparable } from '../../utils/equivalence';
import { ILoadedSourceToScriptRelationship } from './loadedSourceToScriptRelationship';

export interface ICurrentScriptRelationshipsProvider {
    currentScriptRelationships(loadedSource: IdentifiedLoadedSource): ICurrentScriptRelationships;
}

export interface ICurrentScriptRelationships {
    readonly scripts: IScript[];
    readonly relationships: ILoadedSourceToScriptRelationship[];
}

export class CurrentScriptRelationships implements ICurrentScriptRelationships {
    scripts: IScript[];
    constructor(public readonly relationships: ILoadedSourceToScriptRelationship[]) { }
}

/** This interface represents a source or text that is related to a script that the debugee is executing. The text can be the contents of the script itself,
 *  or a file from which the script was loaded, or a file that was compiled to generate the contents of the script
 */
export interface ILoadedSource<TString = string> extends IEquivalenceComparable {
    readonly script: IScript; // TODO DIEGO: Remove this
    readonly identifier: IResourceIdentifier<TString>;
    readonly url: CDTPScriptUrl;
    // readonly origin: string;
    doesScriptHasUrl(): boolean; // TODO DIEGO: Figure out if we can delete this property
    isMappedSource(): boolean;
}

enum ContentsLocation {
    DynamicMemory,
    PersistentStorage
}

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

    private constructor(
        public readonly identifier: IResourceIdentifier<TSource>,
        private readonly _currentScriptRelationshipsProvider: ICurrentScriptRelationshipsProvider,
        public readonly contentsLocation: ContentsLocation) { }

    public static create<TString extends string>(identifier: IResourceIdentifier<TString>, currentScriptRelationshipsProvider: ICurrentScriptRelationshipsProvider): IdentifiedLoadedSource<TString> {
        const contentsLocation = fs.existsSync(identifier.textRepresentation) ? ContentsLocation.PersistentStorage : ContentsLocation.DynamicMemory;
        return new IdentifiedLoadedSource<TString>(identifier, currentScriptRelationshipsProvider, contentsLocation);
    }
}

export class UnidentifiedLoadedSource implements ILoadedSource<CDTPScriptUrl> {
    public get url(): never {
        throw Error(`Can't get the url for ${this} because it doesn't have one`);
    }

    public get identifier(): IResourceIdentifier<CDTPScriptUrl> {
        return parseResourceIdentifier<CDTPScriptUrl>(`${UnidentifiedLoadedSource.EVAL_PSEUDO_PREFIX}${this.name.textRepresentation}` as any);
    }

    // TODO DIEGO: Move these two properties to the client layer
    public static EVAL_FILENAME_PREFIX = 'VM';
    public static EVAL_PSEUDO_FOLDER = '<eval>';
    public static EVAL_PSEUDO_PREFIX = `${UnidentifiedLoadedSource.EVAL_PSEUDO_FOLDER}\\${UnidentifiedLoadedSource.EVAL_FILENAME_PREFIX}`;

    public isMappedSource(): boolean {
        return false;
    }

    public doesScriptHasUrl(): boolean {
        return false;
    }

    public isEquivalentTo(source: UnidentifiedLoadedSource): boolean {
        return this === source;
    }

    public toString(): string {
        return `No URL script source with id: ${this.name}`;
    }

    constructor(
        public readonly script: IScript,
        public readonly name: ResourceName<CDTPScriptUrl>,
        public readonly origin: string) { }
}

export interface ILoadedSourceTreeNode {
    readonly mainSource: ILoadedSource;
    readonly relatedSources: ILoadedSourceTreeNode[];
}

export function determineOrderingOfLoadedSources(left: ILoadedSource, right: ILoadedSource): number {
    return determineOrderingOfStrings(left.identifier.canonicalized, right.identifier.canonicalized);
}