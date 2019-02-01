import { SourceTextLogic } from './sourcesTextLogic';
import { SourcesTreeNodeLogic } from './sourcesTreeNodeLogic';
import { SourceResolver } from './sourceResolver';
import { ILoadedSource, ILoadedSourceTreeNode } from './loadedSource';
import { ISource } from './source';
import { IScript } from '../scripts/script';
import { IResourceIdentifier } from './resourceIdentifier';
import { IComponent } from '../features/feature';
import { injectable } from 'inversify';

export interface ISourcesLogic {
    createSourceResolver(sourceIdentifier: IResourceIdentifier): ISource;
    getLoadedSourcesTrees(): Promise<ILoadedSourceTreeNode[]>;
    getLoadedSourcesTreeForScript(script: IScript): ILoadedSourceTreeNode;
    getText(source: ISource): Promise<string>;
}

@injectable()
export class SourcesLogic implements IComponent {
    public createSourceResolver(sourceIdentifier: IResourceIdentifier): ISource {
        return this._sourceResolverLogic.createUnresolvedSource(sourceIdentifier);
    }

    public async getLoadedSourcesTrees(): Promise<ILoadedSourceTreeNode[]> {
        return this._sourceTreeNodeLogic.getLoadedSourcesTrees();
    }

    public getLoadedSourcesTreeForScript(script: IScript): ILoadedSourceTreeNode {
        return this._sourceTreeNodeLogic.getLoadedSourcesTreeForScript(script);
    }

    public async getText(source: ISource): Promise<string> {
        return await source.tryResolving(
            async loadedSource => await this._sourceTextLogic.text(loadedSource),
            identifier => {
                throw new Error(`Couldn't resolve the source with the path: ${identifier.textRepresentation}`);
            });
    }

    public toString(): string {
        return `Sources logic {\nResolver:\n${this._sourceResolverLogic}\n` +
            `Text:\n${this._sourceTextLogic}\nTree node:\n${this._sourceTreeNodeLogic}\n}`;
    }

    public async install(): Promise<this> {
        await this._sourceResolverLogic.install();
        await this._sourceTextLogic.install();
        await this._sourceTreeNodeLogic.install();
        return this;
    }

    constructor(
        private readonly _sourceResolverLogic: SourceResolver,
        private readonly _sourceTextLogic: SourceTextLogic,
        private readonly _sourceTreeNodeLogic: SourcesTreeNodeLogic
    ) { }
}