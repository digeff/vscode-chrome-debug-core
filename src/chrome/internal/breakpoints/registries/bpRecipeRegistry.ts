/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { injectable } from 'inversify';
import { ISource } from '../../sources/source';
import { IBPRecipe } from '../bpRecipe';
import { CDTPBPRecipe } from '../../../cdtpDebuggee/cdtpPrimitives';
import { BidirectionalMap } from '../../../collections/bidirectionalMap';

type ClientBPRecipe = IBPRecipe<ISource>;
type DebuggeeBPRecipe = CDTPBPRecipe;

@injectable()
export class CDTPBPRecipesRegistry {
    private readonly _clientRecipeToDebuggeeRecipe = new BidirectionalMap<ClientBPRecipe, DebuggeeBPRecipe>();

    public register(clientBPRecipe: ClientBPRecipe, debuggeeBPRecipe: DebuggeeBPRecipe): void {
        this._clientRecipeToDebuggeeRecipe.set(clientBPRecipe, debuggeeBPRecipe);
    }

    public unregister(clientBPRecipe: ClientBPRecipe): void {
        this._clientRecipeToDebuggeeRecipe.deleteByLeft(clientBPRecipe);
    }

    public getDebuggeeBPRecipe(clientBPRecipe: ClientBPRecipe): DebuggeeBPRecipe {
        return this._clientRecipeToDebuggeeRecipe.getByLeft(clientBPRecipe);
    }

    public toString(): string {
        return `Client to Debuggee BP Recipes: ${this._clientRecipeToDebuggeeRecipe}`;
    }
}
