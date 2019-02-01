import { ILoadedSource, SourceScriptRelationship } from './loadedSource';
import { ValidatedMap } from '../../collections/validatedMap';
import { printIterable } from '../../collections/printting';
import { IComponent } from '../features/feature';
import { injectable, inject } from 'inversify';
import { TYPES } from '../../dependencyInjection.ts/types';
import { IScriptSourcesRetriever } from '../../cdtpDebuggee/features/CDTPScriptSourcesRetriever';
import { singleOne } from '../../collections/utilities';

@injectable()
export class SourceTextLogic implements IComponent {
    private _sourceToText = new ValidatedMap<ILoadedSource, string>();

    public async text(loadedSource: ILoadedSource): Promise<string> {
        let text = this._sourceToText.tryGetting(loadedSource);

        if (text !== null) {
            if (loadedSource.sourceScriptRelationship === SourceScriptRelationship.SourceIsSingleScript) {
                text = await this._scriptSources.getScriptSource(singleOne(loadedSource.scriptMapper().scripts));
            } else {
                // We'll need to figure out what is the right thing to do for SourceScriptRelationship.Unknown
                throw new Error(`Support for getting the text from dynamic sources that have multiple scripts embedded hasn't been implemented yet`);
            }
            this._sourceToText.set(loadedSource, text);
        }

        return text;
    }

    public toString(): string {
        return `Sources text logic\n${printIterable('sources in cache', this._sourceToText.keys())}`;
    }

    public install(): this {
        return this;
    }

    constructor(@inject(TYPES.IScriptSources) private readonly _scriptSources: IScriptSourcesRetriever) { }
}