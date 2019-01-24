import { IScript } from '../scripts/script';
import { ISourceToScriptMapper } from '../scripts/sourcesMapper';
import { ILoadedSource } from './loadedSource';

export interface ILoadedSourceToScriptRelationship {
    readonly scripts: IScript[];
}

abstract class BaseLoadedSourceToScriptRelationship implements ILoadedSourceToScriptRelationship {
    abstract get scripts(): IScript[];
}

/// Script was created from this source
export class RuntimeSourceOf extends BaseLoadedSourceToScriptRelationship {
    public get scripts(): IScript[] {
        return [this.script];
    }

    constructor(public readonly runtimeSource: ILoadedSource, public readonly script: IScript) {
        super();
    }
}

/// The runtime source was generated from this source in the user's workspace
export class DevelopmentSourceOf extends BaseLoadedSourceToScriptRelationship {
    public get scripts(): IScript[] {
        return this.runtimeSource.currentScriptRelationships().scripts;
    }

    constructor(public readonly developmentSource: ILoadedSource, public readonly runtimeSource: ILoadedSource) {
        super();
    }

    public toString(): string {
        return `${this.runtimeSource}`;
    }
}

/// A sourcemap indicated that this mapped source was used to generate the DevelopmentSource
export class MappedSourceOf extends BaseLoadedSourceToScriptRelationship {
    constructor(public readonly mappedSource: ILoadedSource, public readonly developmentSource: ILoadedSource, public readonly script: IScript) {
        super();
    }

    public get scripts(): IScript[] {
        return this.developmentSource.currentScriptRelationships().scripts;
    }

    public toString(): string {
        return `${this.developmentSource}${this.script}`;
    }
}
