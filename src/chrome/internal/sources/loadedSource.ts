import { IScript } from '../scripts/script';
import { IResourceIdentifier } from './resourceIdentifier';
import { determineOrderingOfStrings } from '../../collections/utilities';
import { IEquivalenceComparable } from '../../utils/equivalence';
import { ILoadedSourceToScriptRelationship } from './loadedSourceToScriptRelationship';
import { IdentifiedLoadedSource } from './identifiedLoadedSource';

export interface ICurrentScriptRelationshipsProvider {
    currentScriptRelationships(loadedSource: IdentifiedLoadedSource): ICurrentScriptRelationships;
}

export interface ICurrentScriptRelationships {
    readonly scripts: IScript[];
    readonly relationships: ILoadedSourceToScriptRelationship[];
}

export enum SourceScriptRelationship {
    SourceIsSingleScript,
    SourceIsMoreThanAScript,
    Unknown
}

/** This interface represents a source or text that is related to a script that the debugee is executing. The text can be the contents of the script itself,
 *  or a file from which the script was loaded, or a file that was compiled to generate the contents of the script
 */
export interface ILoadedSource<TString = string> extends IEquivalenceComparable {
    readonly identifier: IResourceIdentifier<TString>;
    readonly url: TString;
    readonly sourceScriptRelationship: SourceScriptRelationship;

    // readonly origin: string;
    doesScriptHasUrl(): boolean; // TODO DIEGO: Figure out if we can delete this property
    isMappedSource(): boolean;

    currentScriptRelationships(): ICurrentScriptRelationships;
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
