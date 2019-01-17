import { IScript } from '../scripts/script';
import { ISourceToScriptMapper } from '../scripts/sourcesMapper';
import { ILoadedSource } from './loadedSource';

export interface ILoadedSourceToScriptRelationship {
    readonly script: IScript;
}

abstract class BaseLoadedSourceToScriptRelationship implements ILoadedSourceToScriptRelationship {
    abstract get script(): IScript;
}

/// Script was created from this source
export class RuntimeSource extends BaseLoadedSourceToScriptRelationship {
    constructor(public readonly script: IScript) {
        super();
    }
}

/// The runtime source was generated from this source in the user's workspace
export class DevelopmentSource extends BaseLoadedSourceToScriptRelationship {
    public get script(): IScript[] {
        return this.runtimeSource.currentScriptRelationships;
    }

    constructor(public readonly runtimeSource: ILoadedSource) {
        super();
    }
}

/// A sourcemap indicated that this mapped source was used to generate the DevelopmentSource
export class MappedSource extends BaseLoadedSourceToScriptRelationship {
    public get script(): IScript {
        return this.developmentSource.script;
    }

    constructor(public readonly developmentSource: DevelopmentSource, public readonly sourceMapper: ISourceToScriptMapper) {
        super();
    }
}
