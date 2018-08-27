import { ChromeDiagnostics } from './chromeDiagnostics';
import { IResourceLocationOrName, newResourcePathMap } from './resourceLocation';
import { ISourceIdentifier, IRuntimeScriptSource, SourceIdentifiedByPath } from './loadedSource';

export class SourcesManager {
    private _sourceToText = new Map<IRuntimeScriptSource, string>();
    private _pathToSource = newResourcePathMap<IRuntimeScriptSource>();

    public getSource(source: ISourceIdentifier): IRuntimeScriptSource {
        if (source.isRuntimeScriptSource()) {
            return source as IRuntimeScriptSource;
        } else {
            return this.getSourceByPath(source.path);
        }
    }

    private getSourceByPath<R>(path: string,
        ifNotFound: (path: string) => R = path => { throw new Error(`Couldn't find the runtime script source at path ${path}`); }): R | IRuntimeScriptSource {
        const source = this._pathToSource.get(path);
        if (source === undefined) {
            return ifNotFound(path);
        }

        return source;
    }

    public getSourceByNameOrLocation(nameOrLocation: IResourceLocationOrName): IRuntimeScriptSource {
        return this.getSourceByPath(nameOrLocation.textRepresentation);
    }

    constructor(private _chromeDiagnostics: ChromeDiagnostics) {
        this._chromeDiagnostics.Debugger.onScriptParsed((params, runtimeScript) => {
            runtimeScript.sources.forEach(source => {
                this._pathToSource.set(source.path, source);
            });
            this._pathToSource.set(runtimeScript.runtimeSource.path, runtimeScript.runtimeSource);
        });
    }

    public async text(sourceIdentifier: ISourceIdentifier): Promise<string> {
        const source = this.getSource(sourceIdentifier);
        let text = this._sourceToText.get(source);

        if (!text) {
            text = await this._chromeDiagnostics.Debugger.getScriptSource(source.runtimeScript);
            this._sourceToText.set(source, text);
        }

        return text;
    }

    public getSourceIdentifierByPath(path: IResourceLocationOrName): ISourceIdentifier {
        return this.getSourceByPath(path.textRepresentation, () => new SourceIdentifiedByPath(path.textRepresentation));
    }
}