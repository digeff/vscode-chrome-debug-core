import { IScript } from '../scripts/script';
import { ISourceToScriptMapper } from '../scripts/sourcesMapper';
import { ILoadedSource } from './loadedSource';
import { RangeInResource } from '../locations/rangeInScript';

export interface ILoadedSourceToScriptRelationship {
    readonly scripts: IScript[];
}

abstract class BaseLoadedSourceToScriptRelationship implements ILoadedSourceToScriptRelationship {
    abstract get scripts(): IScript[];
}

/// Script was created from this source
export class RuntimeSource extends BaseLoadedSourceToScriptRelationship {
    public get scripts(): IScript[] {
        return [this.script];
    }

    constructor(public readonly script: IScript, public readonly rangeInSource: RangeInResource<ILoadedSource>) {
        super();
    }
}

/// The runtime source was generated from this source in the user's workspace
export class DevelopmentSource extends BaseLoadedSourceToScriptRelationship {
    public get scripts(): IScript[] {
        return this.runtimeSource.currentScriptRelationships.scripts;
    }

    constructor(public readonly runtimeSource: ILoadedSource) {
        super();
    }
}

/// A sourcemap indicated that this mapped source was used to generate the DevelopmentSource
export class MappedSource extends BaseLoadedSourceToScriptRelationship {
    public get scripts(): IScript[] {
        return this.developmentSource.scripts;
    }

    constructor(public readonly developmentSource: DevelopmentSource, public readonly sourceMapper: ISourceToScriptMapper) {
        super();
    }
}
