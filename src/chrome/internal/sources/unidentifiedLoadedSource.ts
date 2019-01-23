import { IScript } from '../scripts/script';
import { CDTPScriptUrl } from './resourceIdentifierSubtypes';
import { IResourceIdentifier, parseResourceIdentifier, ResourceName } from './resourceIdentifier';
import { ILoadedSource } from './loadedSource';

export class UnidentifiedLoadedSource implements ILoadedSource<CDTPScriptUrl> {
    // TODO DIEGO: Move these two properties to the client layer
    public static EVAL_FILENAME_PREFIX = 'VM';
    public static EVAL_PSEUDO_FOLDER = '<eval>';
    public static EVAL_PSEUDO_PREFIX = `${UnidentifiedLoadedSource.EVAL_PSEUDO_FOLDER}\\${UnidentifiedLoadedSource.EVAL_FILENAME_PREFIX}`;

    constructor(public readonly script: IScript, public readonly name: ResourceName<CDTPScriptUrl>, public readonly origin: string) { }

    public get url(): never {
        throw Error(`Can't get the url for ${this} because it doesn't have one`);
    }

    public get identifier(): IResourceIdentifier<CDTPScriptUrl> {
        return parseResourceIdentifier<CDTPScriptUrl>(`${UnidentifiedLoadedSource.EVAL_PSEUDO_PREFIX}${this.name.textRepresentation}` as any);
    }

    public isMappedSource(): boolean {
        return false;
    }

    public doesScriptHasUrl(): boolean {
        return false;
    }

    public isEquivalentTo(source: UnidentifiedLoadedSource): boolean {
        return this === source;
    }

    public toString(): string {
        return `No URL script source with id: ${this.name}`;
    }
}
