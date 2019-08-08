/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { SourceTextRetriever } from './sourceTextRetriever';
import { LoadedSourcesTreeRetriever } from './loadedSourcesTreeRetriever';
import { ILoadedSourceTreeNode } from './loadedSource';
import { ISource } from './source';
import { IScript } from '../scripts/script';
import { injectable } from 'inversify';
import { InternalError } from '../../utils/internalError';
import { inspect } from 'util';

export interface ISourcesRetriever {
    loadedSourcesTrees(): Promise<ILoadedSourceTreeNode[]>;
    loadedSourcesTreeForScript(script: IScript): ILoadedSourceTreeNode;
    text(source: ISource): Promise<string>;
}

@injectable()
export class SourcesRetriever implements ISourcesRetriever {
    constructor(
        private readonly _sourceTextRetriever: SourceTextRetriever,
        private readonly _sourceTreeNodeLogic: LoadedSourcesTreeRetriever) {
    }

    public async loadedSourcesTrees(): Promise<ILoadedSourceTreeNode[]> {
        return this._sourceTreeNodeLogic.getLoadedSourcesTrees();
    }

    public loadedSourcesTreeForScript(script: IScript): ILoadedSourceTreeNode {
        return this._sourceTreeNodeLogic.getLoadedSourcesTreeForScript(script);
    }

    public async text(source: ISource): Promise<string> {
        return await source.tryResolving(
            async loadedSource => await this._sourceTextRetriever.text(loadedSource),
            identifier => {
                throw new InternalError('error.source.cantResolve', `Couldn't resolve the source with the path: ${identifier.textRepresentation}`);
            });
    }

    public [inspect.custom](): string {
        return this.toString(inspect);
    }

    public toString(print = (value: unknown) => `${value}`): string {
        return `Sources retriever for text:\n${this._sourceTextRetriever}\n for trees:\n${this._sourceTreeNodeLogic}\n}`;
    }
}