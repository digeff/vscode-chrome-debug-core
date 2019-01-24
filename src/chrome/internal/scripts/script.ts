import { ILoadedSource } from '../sources/loadedSource';
import { IdentifiedLoadedSource } from '../sources/identifiedLoadedSource';
import { UnidentifiedLoadedSource } from '../sources/unidentifiedLoadedSource';
import { CDTPScriptUrl } from '../sources/resourceIdentifierSubtypes';
import { IValidatedMap } from '../../collections/validatedMap';
import { printArray } from '../../collections/printing';
import { ISourcesMapper } from './sourcesMapper';
import { IResourceIdentifier, newResourceIdentifierMap } from '../sources/resourceIdentifier';
import { IExecutionContext } from './executionContext';
import { IEquivalenceComparable } from '../../utils/equivalence';
import { Lazy1 } from '../../utils/lazy';
import { RangeInResource } from '../locations/rangeInScript';

/**
 * Multiplicity:
 *   Scripts N [HTMLFile or MultipleTimesLoaded] ... 1 RuntimeSource(LoadedSource)(URLs)
 *   RuntimeSource(LoadedSource)(URLs) N ... 1 DevelopmentSource(LoadedSource)
 *   DevelopmentSource(LoadedSource) N ... M MappedSource(LoadedSource)
 *
 * --- Details ---
 * Scripts N [HTMLFile or MultipleTimesLoaded] ... 1 RuntimeSource(LoadedSource)(URLs)
 *   RuntimeSource(LoadedSource)(URLs) can have N Scripts if it's an .html file with multiple scripts or multiple event handlers
 *   RuntimeSource(LoadedSource)(URLs) can have N Scripts if the same script was loaded multiple times (We've seen this happen in Node when the require cache is deleted)
 *
 * RuntimeSource(LoadedSource)(URLs) N ... 1 DevelopmentSource(LoadedSource)
 * DevelopmentSource(LoadedSource) can be associated with multiple RuntimeSource(LoadedSource)(URLs) if the web-server severs the same file from multiple URLs
 *
 * DevelopmentSource(LoadedSource) N ... M MappedSource(LoadedSource)
 * DevelopmentSource(LoadedSource) can be associated with multiple MappedSource(LoadedSource) if files were bundled or compiled with TypeScript bundling option
 * MappedSource(LoadedSource) can be associated with multiple DevelopmentSource(LoadedSource) if the same typescript file gets bundled into different javascript files
 *
 * Additional notes:
 * It's extremelly unlikely, but it's possible for a .js file to be the MappedSource of a Script A, the RuntimeSource of a different script B, and the DevelopmentSource for a different script C
 */

/** This interface represents a piece of code that is being executed in the debugee. Usually a script matches to a file or a url, but that is not always the case.
 * This interface solves the problem of finding the different loaded sources associated with a script, and being able to identify and compare both scripts and sources easily.
 */
const ImplementsScript = Symbol();
export interface IScript extends IEquivalenceComparable {
    [ImplementsScript]: void;

    readonly executionContext: IExecutionContext;
    readonly runtimeSource: ILoadedSource<CDTPScriptUrl>; // Source in Webserver
    readonly rangeInSource: RangeInResource<ILoadedSource<CDTPScriptUrl>>; // Range in runtimeSource

    readonly developmentSource: ILoadedSource; // Source in Workspace
    readonly mappedSources: IdentifiedLoadedSource[]; // Sources before compilation
    readonly allSources: ILoadedSource[]; // runtimeSource + developmentSource + mappedSources
    readonly url: CDTPScriptUrl;

    readonly sourcesMapper: ISourcesMapper; // TODO DIEGO: See if we can delete this property

    getSource(sourceIdentifier: IResourceIdentifier): ILoadedSource;

    isEquivalentTo(script: IScript): boolean;
}

export function isScript(object: unknown): object is IScript {
    return !!(<any>object)[ImplementsScript];
}

export class Script implements IScript {
    [ImplementsScript]: void;
    private readonly _compiledSources: IValidatedMap<IResourceIdentifier, IdentifiedLoadedSource>;
    public readonly runtimeSource: ILoadedSource<CDTPScriptUrl>;
    public readonly rangeInSource: RangeInResource<ILoadedSource<CDTPScriptUrl>>;
    public readonly developmentSource: ILoadedSource;

    public static create(executionContext: IExecutionContext, runtimeSource: ILoadedSource<CDTPScriptUrl>, developmentSource: ILoadedSource,
        sourcesMapper: ISourcesMapper, mappedSources: IdentifiedLoadedSource[], rangeInSource: RangeInResource<ILoadedSource<CDTPScriptUrl>>): Script {
        return new Script(executionContext, () => runtimeSource, () => developmentSource, mappedSources, sourcesMapper, () => rangeInSource);
    }

    public static createWithUnidentifiedSource(executionContext: IExecutionContext, sourcesMapper: ISourcesMapper, mappedSources: IdentifiedLoadedSource[],
        rangeInSource: (runtimeSource: ILoadedSource<CDTPScriptUrl>) => RangeInResource<ILoadedSource<CDTPScriptUrl>>): Script {
        const sourceProvider = new Lazy1((script: IScript) => new UnidentifiedLoadedSource(script, name, "source for the script from the debugging engine, because the script doesn't have an url")).function;
        return new Script(executionContext, sourceProvider, sourceProvider, mappedSources, sourcesMapper, rangeInSource);
    }

    constructor(public readonly executionContext: IExecutionContext, runtimeSourceProvider: (script: IScript) => ILoadedSource<CDTPScriptUrl>, developmentSourceProvider: (script: IScript) => ILoadedSource,
        mappedSources: IdentifiedLoadedSource[], public readonly sourcesMapper: ISourcesMapper, rangeInSourceProvider: (runtimeSource: ILoadedSource<CDTPScriptUrl>) => RangeInResource<ILoadedSource<CDTPScriptUrl>>) {
        this.runtimeSource = runtimeSourceProvider(this);
        this.developmentSource = developmentSourceProvider(this);
        this.rangeInSource = rangeInSourceProvider(this.runtimeSource);
        const pathsAndMappedSources = mappedSources.map(mappedSource => [mappedSource.identifier, mappedSource] as [IResourceIdentifier, IdentifiedLoadedSource]);
        this._compiledSources = newResourceIdentifierMap(pathsAndMappedSources);
    }

    public get mappedSources(): IdentifiedLoadedSource[] {
        return Array.from(this._compiledSources.values());
    }

    public getSource(sourceIdentifier: IResourceIdentifier): ILoadedSource {
        return this._compiledSources.get(sourceIdentifier);
    }

    public get allSources(): ILoadedSource[] {
        const unmappedSources: ILoadedSource[] = [this.runtimeSource];
        if (this.developmentSource !== this.runtimeSource) {
            unmappedSources.push(this.developmentSource);
        }

        return unmappedSources.concat(this.mappedSources);
    }

    public get url(): CDTPScriptUrl {
        return this.runtimeSource.identifier.textRepresentation;
    }

    public isEquivalentTo(script: Script): boolean {
        return this === script;
    }

    public toString(): string {
        return `Script:\n  Runtime source: ${this.runtimeSource}\n  Development source: ${this.developmentSource}\n`
            + printArray('  Sources of compiledsource', this.mappedSources);
    }
}
