/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { LocationInLoadedSource } from '../locations/location';
import { printArray } from '../../collections/printing';
import { BPRecipeIsBoundInRuntimeLocation, BPRecipeIsUnboundInRuntimeLocation } from './bpRecipeStatusForRuntimeLocation';
import { BPRecipeInSource } from './bpRecipeInSource';
import { breakWhileDebugging } from '../../../validation';

/** These interface and classes represent the status of a BP Recipe (Is it bound or not?) */
const ImplementsBPRecipeStatus = Symbol();
export interface IBPRecipeStatus {
    [ImplementsBPRecipeStatus]: string;

    readonly recipe: BPRecipeInSource;
    readonly statusDescription: string;

    isVerified(): boolean;
}

export class BPRecipeIsUnboundDueToNoSubstatuses implements IBPRecipeStatus {
    [ImplementsBPRecipeStatus] = 'IBPRecipeStatus';

    constructor(
        public readonly recipe: BPRecipeInSource) {
    }

    public isVerified(): boolean {
        return false;
    }

    public get statusDescription(): string {
        return `unbound because none of the scripts already loaded are associated with this source`;
    }

    public toString(): string {
        return `${this.recipe} is ${this.statusDescription}`;
    }
}

export class BPRecipeHasBoundSubstatuses implements IBPRecipeStatus {
    [ImplementsBPRecipeStatus] = 'IBPRecipeStatus';

    constructor(
        public readonly recipe: BPRecipeInSource,
        public readonly boundSubstatuses: BPRecipeIsBoundInRuntimeLocation[],
        public readonly unboundSubstatuses: BPRecipeIsUnboundInRuntimeLocation[]) {
        if (this.boundSubstatuses.length === 0) {
            breakWhileDebugging();
            throw new Error(`At least one bound substatus was expected`);
        }
    }

    public get actualLocationInSource(): LocationInLoadedSource {
        // TODO: Figure out what is the right way to decide the actual location when we have multiple breakpoints
        return this.boundSubstatuses[0].breakpoints[0].actualLocation;
    }

    public isVerified(): boolean {
        return true;
    }

    public get statusDescription(): string {
        return `bound with ${printArray('', this.boundSubstatuses)}`;
    }

    public toString(): string {
        return `${this.recipe} is ${this.statusDescription}`;
    }
}

export class BPRecipeHasOnlyUnboundSubstatuses implements IBPRecipeStatus {
    [ImplementsBPRecipeStatus] = 'IBPRecipeStatus';

    constructor(
        public readonly recipe: BPRecipeInSource,
        public readonly unboundSubstatuses: BPRecipeIsUnboundInRuntimeLocation[]) {
        if (this.unboundSubstatuses.length === 0) {
            breakWhileDebugging();
            throw new Error(`At least the substatus for a single runtime source was expected`);
        }
    }

    public isVerified(): boolean {
        return true;
    }

    public get statusDescription(): string {
        return `unbound because ${printArray('', this.unboundSubstatuses)}`;
    }

    public toString(): string {
        return `${this.recipe} is ${this.statusDescription}`;
    }
}

export function createBPRecipieStatus(recipe: BPRecipeInSource, boundSubstatuses: BPRecipeIsBoundInRuntimeLocation[], unboundSubstatuses: BPRecipeIsUnboundInRuntimeLocation[]): IBPRecipeStatus {
    if (boundSubstatuses.length > 0) {
        return new BPRecipeHasBoundSubstatuses(recipe, boundSubstatuses, unboundSubstatuses);
    } else if (unboundSubstatuses.length > 0) {
        return new BPRecipeHasOnlyUnboundSubstatuses(recipe, unboundSubstatuses);
    } else {
        return new BPRecipeIsUnboundDueToNoSubstatuses(recipe);
    }
}
