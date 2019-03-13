/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { BPRecipesInSource } from '../bpRecipes';

import { BPRsDeltaCalculator, BPRsDeltaInRequestedSource } from '../features/bpsDeltaCalculator';
import { BPRecipeInSource } from '../bpRecipeInSource';
import { newResourceIdentifierMap, IResourceIdentifier } from '../../sources/resourceIdentifier';

export class ClientCurrentBPRecipesRegistry {
    private readonly _requestedSourcePathToCurrentBPRecipes = newResourceIdentifierMap<BPRecipeInSource[]>();

    public updateBPRecipesAndCalculateDelta(requestedBPRecipes: BPRecipesInSource): BPRsDeltaInRequestedSource {
        const bpsDelta = this.calculateBPSDeltaFromExistingBPs(requestedBPRecipes);
        this.registerCurrentBPRecipes(requestedBPRecipes.source.sourceIdentifier, bpsDelta.matchesForRequested);
        return bpsDelta;
    }

    private registerCurrentBPRecipes(requestedSourceIdentifier: IResourceIdentifier, bpRecipes: BPRecipeInSource[]): void {
        this._requestedSourcePathToCurrentBPRecipes.setAndReplaceIfExist(requestedSourceIdentifier, Array.from(bpRecipes));
    }

    private calculateBPSDeltaFromExistingBPs(requestedBPRecipes: BPRecipesInSource): BPRsDeltaInRequestedSource {
        const sourcePath = requestedBPRecipes.requestedSourcePath;
        const bpRecipesInSource = this.bpRecipesForSource(sourcePath);
        return new BPRsDeltaCalculator(requestedBPRecipes.source, requestedBPRecipes, bpRecipesInSource).calculate();
    }

    public bpRecipesForSource(sourcePath: IResourceIdentifier<string>) {
        return this._requestedSourcePathToCurrentBPRecipes.getOr(sourcePath, () => []);
    }

    public toString(): string {
        return `Client BP Recipes Registry {${this._requestedSourcePathToCurrentBPRecipes}}`;
    }
}
