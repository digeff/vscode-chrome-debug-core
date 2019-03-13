/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { createBPRecipieStatus, IBPRecipeStatus } from '../bpRecipeStatus';
import { LocationInLoadedSource } from '../../locations/location';
import { CDTPBreakpoint } from '../../../cdtpDebuggee/cdtpPrimitives';
import { ValidatedMap, IValidatedMap } from '../../../collections/validatedMap';
import { BPRecipeInSource } from '../bpRecipeInSource';
import { BPRecipeIsUnbound, BPRecipeIsBoundInRuntimeLocation, IBPRecipeSingleLocationStatus } from '../bpRecipeStatusForRuntimeLocation';
import { IBreakpointsEventsListener } from '../features/breakpointsEventSystem';
import { printMap } from '../../../collections/printting';
import { ValidatedMultiMap } from '../../../collections/validatedMultiMap';

export interface IBPRecipeStatusCalculatorGeneratedEventsListener {
    onBPRecipeStatusChanged(bpRecipeInSource: BPRecipeInSource): void;
}

export class BPRecipeStatusCalculator {
    private readonly _recipeToStatusAtLocation = new ValidatedMap<BPRecipeInSource, IValidatedMap<LocationInLoadedSource, BPRecipeIsBoundInRuntimeLocation>>();
    private readonly _recipeToUnboundStatus = new ValidatedMultiMap<BPRecipeInSource, BPRecipeIsUnbound>();

    public constructor(
        breakpointsEventsListener: IBreakpointsEventsListener,
        private readonly _generatedEventsListener: IBPRecipeStatusCalculatorGeneratedEventsListener) {
        breakpointsEventsListener.listenForOnClientBPRecipeAdded(clientBPRecipe => this.onClientBPRecipeAdded(clientBPRecipe));
        breakpointsEventsListener.listenForOnClientBPRecipeRemoved(clientBPRecipe => this.onClientBPRecipeRemoved(clientBPRecipe));
        breakpointsEventsListener.listenForOnBreakpointIsBound(breakpoint => this.onBreakpointIsBound(breakpoint));
        breakpointsEventsListener.listenForOnBPRecipeIsUnbound(bpRecipeIsUnbound => this.onBPRecipeIsUnbound(bpRecipeIsUnbound));
    }

    public statusOfBPRecipe(bpRecipe: BPRecipeInSource): IBPRecipeStatus {
        const boundSubstatuses = Array.from(this._recipeToStatusAtLocation.get(bpRecipe).values());
        const unboundSubstatuses = Array.from(this._recipeToUnboundStatus.get(bpRecipe));

        return createBPRecipieStatus(bpRecipe, boundSubstatuses, unboundSubstatuses);
    }

    private onClientBPRecipeAdded(bpRecipe: BPRecipeInSource): void {
        this._recipeToStatusAtLocation.set(bpRecipe, new ValidatedMap<LocationInLoadedSource, BPRecipeIsBoundInRuntimeLocation>());
        this._recipeToUnboundStatus.addKeyIfNotExistant(bpRecipe);
    }

    private onBreakpointIsBound(breakpoint: CDTPBreakpoint): void {
        const bpRecipe = breakpoint.recipe.unmappedBPRecipe;
        const locationInRuntimeSource = breakpoint.actualLocation.mappedToRuntimeSource();
        const runtimeSourceToBPRStatus = this._recipeToStatusAtLocation.get(bpRecipe);

        runtimeSourceToBPRStatus.set(locationInRuntimeSource, new BPRecipeIsBoundInRuntimeLocation(bpRecipe, locationInRuntimeSource, [breakpoint.mappedToSource()]));
        this._generatedEventsListener.onBPRecipeStatusChanged(bpRecipe);
    }

    private onBPRecipeIsUnbound(bpRecipeIsUnbound: BPRecipeIsUnbound): void {
        this._recipeToUnboundStatus.add(bpRecipeIsUnbound.recipe, bpRecipeIsUnbound);
        this._generatedEventsListener.onBPRecipeStatusChanged(bpRecipeIsUnbound.recipe);
    }

    private onClientBPRecipeRemoved(bpRecipe: BPRecipeInSource): void {
        this._recipeToStatusAtLocation.delete(bpRecipe);
        this._recipeToUnboundStatus.delete(bpRecipe);
    }

    public toString(): string {
        return `${printMap(`BPRecipe status calculator:`, this._recipeToStatusAtLocation)} ${printMap(`Unbound bps:`, this._recipeToUnboundStatus)}`;
    }
}
