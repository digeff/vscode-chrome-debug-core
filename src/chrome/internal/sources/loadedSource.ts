import { IScript } from '../scripts/script';
import { IResourceIdentifier } from './resourceIdentifier';
import { determineOrderingOfStrings } from '../../collections/utilities';
import { IEquivalenceComparable } from '../../utils/equivalence';
import { ILoadedSourceToScriptRelationship } from './loadedSourceToScriptRelationship';
import { IdentifiedLoadedSource } from './identifiedLoadedSource';
import { ISourceMapper } from '../scripts/sourcesMapper';
import { LocationInScript, LocationInLoadedSource } from '../locations/location';

export interface ICurrentScriptRelationshipsProvider {
    scriptMapper(loadedSource: IdentifiedLoadedSource): IScriptMapper;
}

export class ScriptAndSourceMapper {
    constructor(
        public readonly script: IScript,
        public readonly sourcesMapper: ISourceMapper) { }
}

export interface IScriptMapper {
    mapToScripts(position: LocationInLoadedSource): LocationInScript[];
}

export enum SourceScriptRelationship {
    SourceIsSingleScript,
    SourceIsMoreThanAScript,
    Unknown
}

/** This interface represents a source or text that is related to a script that the debugee is executing. The text can be the contents of the script itself,
 *  or a file from which the script was loaded, or a file that was compiled to generate the contents of the script
 */
export const ImplementsLoadedSource = Symbol();
export interface ILoadedSource<TString = string> extends IEquivalenceComparable {
    [ImplementsLoadedSource]: string;

    readonly identifier: IResourceIdentifier<TString>;
    readonly url: TString;
    readonly sourceScriptRelationship: SourceScriptRelationship;

    // readonly origin: string;
    doesScriptHasUrl(): boolean; // TODO DIEGO: Figure out if we can delete this property
    isMappedSource(): boolean;

    scriptMapper(): IScriptMapper;
}

export function isLoadedSource(object: unknown): object is ILoadedSource {
    return !!(<any>object)[ImplementsLoadedSource];
}

export enum ContentsLocation {
    DynamicMemory,
    PersistentStorage
}

export interface ILoadedSourceTreeNode {
    readonly mainSource: ILoadedSource;
    readonly relatedSources: ILoadedSourceTreeNode[];
}

export function determineOrderingOfLoadedSources(left: ILoadedSource, right: ILoadedSource): number {
    return determineOrderingOfStrings(left.identifier.canonicalized, right.identifier.canonicalized);
}
