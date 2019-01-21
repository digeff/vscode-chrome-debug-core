/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { BPRecipiesInSource } from '../bpRecipies';

import { BPRsDeltaCalculator, BPRsDeltaInRequestedSource } from '../features/bpsDeltaCalculator';
import { BPRecipieInSource } from '../bpRecipieInSource';
import { newResourceIdentifierMap, IResourceIdentifier } from '../../sources/resourceIdentifier';

export class ClientCurrentBPRecipiesRegistry {
    private readonly _requestedSourcePathToCurrentBPRecipies = newResourceIdentifierMap<BPRecipieInSource[]>();

    public updateBPRecipiesAndCalculateDelta(requestedBPRecipies: BPRecipiesInSource): BPRsDeltaInRequestedSource {
        const bpsDelta = this.calculateBPSDeltaFromExistingBPs(requestedBPRecipies);
        this.registerCurrentBPRecipies(requestedBPRecipies.source.sourceIdentifier, bpsDelta.matchesForRequested);
        return bpsDelta;
    }

    private registerCurrentBPRecipies(requestedSourceIdentifier: IResourceIdentifier, bpRecipies: BPRecipieInSource[]): void {
        this._requestedSourcePathToCurrentBPRecipies.setAndReplaceIfExist(requestedSourceIdentifier, Array.from(bpRecipies));
    }

    private calculateBPSDeltaFromExistingBPs(requestedBPRecipies: BPRecipiesInSource): BPRsDeltaInRequestedSource {
        const bpRecipiesInSource = this._requestedSourcePathToCurrentBPRecipies.getOrAdd(requestedBPRecipies.requestedSourcePath, () => []);
        return new BPRsDeltaCalculator(requestedBPRecipies.source, requestedBPRecipies, bpRecipiesInSource).calculate();
    }

    public toString(): string {
        return `Client BP Recipies Registry {${this._requestedSourcePathToCurrentBPRecipies}}`;
    }
}