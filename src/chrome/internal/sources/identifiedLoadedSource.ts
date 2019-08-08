import * as fs from 'fs';
import { IScript } from '../scripts/script';
import { IResourceIdentifier } from './resourceIdentifier';
import { ILoadedSource, IScriptMapper, ICurrentScriptRelationshipsProvider as IScriptMapperProvider, ContentsLocation, SourceScriptRelationship, ImplementsLoadedSource, ScriptAndSourceMapper } from './loadedSource';
import { ILoadedSourceToScriptRelationship } from './loadedSourceToScriptRelationship';
import * as _ from 'lodash';
import { printArray } from '../../collections/printing';
import { LocationInLoadedSource } from '../locations/location';
import { IMappedTokensInScript } from '../locations/mappedTokensInScript';
import { inspect } from 'util';

/**
 * Loaded Source classification:
 * Is the script content available on a single place, or two places? (e.g.: You can find similar scripts in multiple different paths)
 *  1. Single: Is the single place on storage, or is this a dynamic script?
 *      Single path on storage: RuntimeScriptRunFromStorage
 *      Single path not on storage: DynamicRuntimeScript
 *  2. Two: We assume one path is from the webserver, and the other path is in the workspace: RuntimeScriptWithSourceOnWorkspace
 */
export class IdentifiedLoadedSource<TString extends string = string> implements ILoadedSource<TString> {
    public [ImplementsLoadedSource]: 'ILoadedSource' = 'ILoadedSource';

    private constructor(
        public readonly identifier: IResourceIdentifier<TString>,
        public readonly sourceScriptRelationship: SourceScriptRelationship,
        private readonly _scriptMapperProvider: IScriptMapperProvider,
        public readonly contentsLocation: ContentsLocation) { }

    public static create<TString extends string>(identifier: IResourceIdentifier<TString>, sourceScriptRelationship: SourceScriptRelationship,
        currentScriptRelationshipsProvider: IScriptMapperProvider): IdentifiedLoadedSource<TString> {

        // TODO: Figure out how to make this method async. The challenge is that this method is indirectly called by the Script class constructor,
        // and we need to figure out how to make the constructor async, given that to preserve immutability we can only assign member variables in
        // the constructor
        const contentsLocation = fs.existsSync(identifier.textRepresentation) ? ContentsLocation.PersistentStorage : ContentsLocation.DynamicMemory;
        return new IdentifiedLoadedSource<TString>(identifier, sourceScriptRelationship, currentScriptRelationshipsProvider, contentsLocation);
    }

    public get url(): TString {
        return this.identifier.textRepresentation;
    }

    public scriptMapper(): IScriptMapper {
        return this._scriptMapperProvider.scriptMapper(this);
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

    public [inspect.custom](): string {
        return this.toString();
    }

    public toString(): string {
        return `src:${this.identifier}`;
    }
}

export class ScriptMapper implements IScriptMapper {
    constructor(public readonly relationships: ILoadedSourceToScriptRelationship[]) { }

    public mapToScripts(locationToMap: LocationInLoadedSource): IMappedTokensInScript<IScript>[] {
        return this.relationships.map(relationship => relationship.scriptAndSourceMapper.sourcesMapper.getPositionInScript(locationToMap))
            .filter(mappedTokensInScript => !mappedTokensInScript.isEmpty());
    }

    public get scripts(): IScript[] {
        return _.uniq(_.flatten(this.relationships.map(relationship => relationship.script)));
    }

    public get scriptsAndSourceMappers(): ScriptAndSourceMapper[] {
        return _.flatten(this.relationships.map(relationship => relationship.scriptAndSourceMapper));
    }

    public [inspect.custom](): string {
        return this.toString(inspect);
    }

    public toString(print = (value: unknown) => `${value}`): string {
        return printArray('relationships', this.relationships, print);
    }
}
