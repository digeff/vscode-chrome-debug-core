import { BPRecipiesInUnresolvedSource } from './bpRecipies';

import { BPRsDeltaCalculator, BPRsDeltaInRequestedSource } from './bpsDeltaCalculator';
import { BPRecipieInSource } from './bpRecipie';
import { newResourceIdentifierMap, IResourceIdentifier } from '../sources/resourceIdentifier';

export class ClientCurrentBPRecipiesRegistry {
    private readonly _requestedSourcePathToCurrentBPRecipies = newResourceIdentifierMap<BPRecipieInSource[]>();

    public updateBPRecipiesAndCalculateDelta(requestedBPRecipies: BPRecipiesInUnresolvedSource): BPRsDeltaInRequestedSource {
        const bpsDelta = this.calculateBPSDeltaFromExistingBPs(requestedBPRecipies);
        this.registerCurrentBPRecipies(requestedBPRecipies.resource.sourceIdentifier, bpsDelta.matchesForRequested);
        return bpsDelta;
    }

    private registerCurrentBPRecipies(requestedSourceIdentifier: IResourceIdentifier, bpRecipies: BPRecipieInSource[]): void {
        this._requestedSourcePathToCurrentBPRecipies.setAndReplaceIfExist(requestedSourceIdentifier, Array.from(bpRecipies));
    }

    private calculateBPSDeltaFromExistingBPs(requestedBPRecipies: BPRecipiesInUnresolvedSource): BPRsDeltaInRequestedSource {
        const bpRecipiesInSource = this._requestedSourcePathToCurrentBPRecipies.getOrAdd(requestedBPRecipies.requestedSourcePath, () => []);
        return new BPRsDeltaCalculator(requestedBPRecipies.resource, requestedBPRecipies, bpRecipiesInSource).calculate();
    }

    public toString(): string {
        return `Client BP Recipies Registry {${this._requestedSourcePathToCurrentBPRecipies}}`;
    }
}
