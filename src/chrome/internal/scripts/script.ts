import * as fs from 'fs';
import {
    ILoadedSource, MappedSource, SourceInLocalStorage, DynamicSource,
    ScriptRuntimeSource, ScriptDevelopmentSource, UnidentifiedLoadedSource
} from '../sources/loadedSource';
import { CDTPScriptUrl } from '../sources/resourceIdentifierSubtypes';
import { IValidatedMap } from '../../collections/validatedMap';
import { printArray } from '../../collections/printing';
import { ISourcesMapper } from './sourcesMapper';
import { IResourceIdentifier, IResourceLocation, newResourceIdentifierMap, parseResourceIdentifier, ResourceName } from '../sources/resourceIdentifier';
import { IExecutionContext } from './executionContext';
import { Lazy1 } from '../../utils/lazy';
import { IEquivalenceComparable } from '../../utils/equivalence';

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
    readonly developmentSource: ILoadedSource; // Source in Workspace
    readonly mappedSources: MappedSource[]; // Sources before compilation
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

    private readonly _runtimeSource: ILoadedSource<CDTPScriptUrl>;
    private readonly _developmentSource: ILoadedSource;
    private readonly _compiledSources: IValidatedMap<IResourceIdentifier, MappedSource>;

    public static create(executionContext: IExecutionContext, locationInRuntimeEnvironment: IResourceLocation<CDTPScriptUrl>, locationInDevelopmentEnvinronment: IResourceLocation,
        sourcesMapper: ISourcesMapper): Script {
        const mappedSources = (script: IScript) => newResourceIdentifierMap<MappedSource>(sourcesMapper.sources.map(path => {
            const identifier = parseResourceIdentifier(path);
            return [identifier, new MappedSource(script, identifier, 'TODO DIEGO')] as [IResourceIdentifier, MappedSource];
        }));

        /**
         * Loaded Source classification:
         * Is the script content available on a single place, or two places? (e.g.: You can find similar scripts in multiple different paths)
         *  1. Single: Is the single place on the user workspace, or is this a dynamic script?
         *      Single path on storage: RuntimeScriptRunFromStorage
         *      Single path not on storage: DynamicRuntimeScript
         *  2. Two: We assume one path is from the webserver, and the other path is in the workspace: RuntimeScriptWithSourceOnWorkspace
         */
        let runtimeSource: (script: IScript) => ILoadedSource<CDTPScriptUrl>;
        let developmentSource: (script: IScript) => ILoadedSource;
        if (locationInDevelopmentEnvinronment.isEquivalentTo(locationInRuntimeEnvironment) || locationInDevelopmentEnvinronment.textRepresentation === '') {
            if (fs.existsSync(locationInRuntimeEnvironment.textRepresentation)) {
                developmentSource = runtimeSource = new Lazy1((script: IScript) => // Using Lazy1 will ensure both calls return the same instance
                    new SourceInLocalStorage(script, locationInRuntimeEnvironment, 'TODO DIEGO')).function;
            } else {
                developmentSource = runtimeSource = new Lazy1((script: IScript) => // Using Lazy1 will ensure both calls return the same instance
                    new DynamicSource(script, locationInRuntimeEnvironment, 'TODO DIEGO')).function;
            }
        } else {
            // The script is served from one location, and it's on the workspace on a different location
            runtimeSource = script => new ScriptRuntimeSource(script, locationInRuntimeEnvironment, 'TODO DIEGO');
            developmentSource = script => new ScriptDevelopmentSource(script, locationInDevelopmentEnvinronment, 'TODO DIEGO');
        }
        return new Script(executionContext, runtimeSource, developmentSource, mappedSources, sourcesMapper);
    }

    public static createEval(executionContext: IExecutionContext, name: ResourceName<CDTPScriptUrl>, sourcesMapper: ISourcesMapper): Script {
        // Using Lazy1 will ensure both calls return the same instance
        let getNoURLScript = new Lazy1((script: IScript) => new UnidentifiedLoadedSource(script, name, 'TODO DIEGO'));
        return new Script(executionContext, getNoURLScript.function, getNoURLScript.function, _ => new Map<IResourceIdentifier, MappedSource>(), sourcesMapper);
    }

    constructor(public readonly executionContext: IExecutionContext, getRuntimeSource: (script: IScript) => ILoadedSource<CDTPScriptUrl>, getDevelopmentSource: (script: IScript) => ILoadedSource,
        getCompiledScriptSources: (script: IScript) => Map<IResourceIdentifier, MappedSource>, public readonly sourcesMapper: ISourcesMapper) {
        this._runtimeSource = getRuntimeSource(this);
        this._developmentSource = getDevelopmentSource(this);
        this._compiledSources = newResourceIdentifierMap(getCompiledScriptSources(this));
    }

    public get developmentSource(): ILoadedSource {
        return this._developmentSource;
    }

    public get runtimeSource(): ILoadedSource<CDTPScriptUrl> {
        return this._runtimeSource;
    }

    public get mappedSources(): MappedSource[] {
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
        return this._runtimeSource.identifier.textRepresentation;
    }

    public isEquivalentTo(script: Script): boolean {
        return this === script;
    }

    public toString(): string {
        return `Script:\n  Runtime source: ${this.runtimeSource}\n  Development source: ${this.developmentSource}\n`
            + printArray('  Sources of compiledsource', this.mappedSources);
    }
}
