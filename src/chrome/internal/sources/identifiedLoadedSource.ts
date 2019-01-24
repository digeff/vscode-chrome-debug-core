import * as fs from 'fs';
import { IScript } from '../scripts/script';
import { IResourceIdentifier } from './resourceIdentifier';
import { ILoadedSource, ICurrentScriptRelationships, ICurrentScriptRelationshipsProvider, ContentsLocation, SourceScriptRelationship } from './loadedSource';
import { ILoadedSourceToScriptRelationship } from './loadedSourceToScriptRelationship';
import _ = require('lodash');

/**
 * Loaded Source classification:
 * Is the script content available on a single place, or two places? (e.g.: You can find similar scripts in multiple different paths)
 *  1. Single: Is the single place on storage, or is this a dynamic script?
 *      Single path on storage: RuntimeScriptRunFromStorage
 *      Single path not on storage: DynamicRuntimeScript
 *  2. Two: We assume one path is from the webserver, and the other path is in the workspace: RuntimeScriptWithSourceOnWorkspace
 */
const IsIdentifiedLoadedSource = Symbol();
export class IdentifiedLoadedSource<TString extends string = string> implements ILoadedSource<TString> {
    [IsIdentifiedLoadedSource]: void;

    private constructor(
        public readonly identifier: IResourceIdentifier<TString>,
        public readonly sourceScriptRelationship: SourceScriptRelationship,
        private readonly _currentScriptRelationshipsProvider: ICurrentScriptRelationshipsProvider,
        public readonly contentsLocation: ContentsLocation) { }

    public get url(): TString {
        return this.identifier.textRepresentation;
    }

    public currentScriptRelationships(): ICurrentScriptRelationships {
        return this._currentScriptRelationshipsProvider.currentScriptRelationships(this);
    }

    public isMappedSource(): boolean {
        return false;
    }

    public doesScriptHasUrl(): boolean {
        return true;
    }

    public isEquivalentTo(source: ILoadedSource<TString>): boolean {
        return this === source;
    }

    public toString(): string {
        return `src:${this.identifier}`;
    }

    public static create<TString extends string>(identifier: IResourceIdentifier<TString>, sourceScriptRelationship: SourceScriptRelationship,
        currentScriptRelationshipsProvider: ICurrentScriptRelationshipsProvider): IdentifiedLoadedSource<TString> {

        const contentsLocation = fs.existsSync(identifier.textRepresentation) ? ContentsLocation.PersistentStorage : ContentsLocation.DynamicMemory;
        return new IdentifiedLoadedSource<TString>(identifier, sourceScriptRelationship, currentScriptRelationshipsProvider, contentsLocation);
    }
}

export class CurrentIdentifiedSourceScriptRelationships implements ICurrentScriptRelationships {
    public get scripts(): IScript[] {
        return _.flatten(this.relationships.map(relationship => relationship.scripts));
    }

    constructor(public readonly relationships: ILoadedSourceToScriptRelationship[]) { }
}
