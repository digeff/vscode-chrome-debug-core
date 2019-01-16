/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { BPRecipeHasBoundSubstatuses as BPRecipeHasBoundSubstatuses, BPRecipeIsUnboundDueToNoSubstatuses, createBPRecipieStatus, IBPRecipeStatus } from '../bpRecipeStatus';
import { ValidatedMultiMap } from '../../../collections/validatedMultiMap';
import { IBPRecipe } from '../bpRecipe';
import { LocationInScript, LocationInLoadedSource } from '../../locations/location';
import { injectable } from 'inversify';
import { CDTPBreakpoint } from '../../../cdtpDebuggee/cdtpPrimitives';
import { ISource } from '../../sources/source';
import { ValidatedMap, IValidatedMap } from '../../../collections/validatedMap';
import { BPRecipeInSource } from '../bpRecipeInSource';
import { ILoadedSource } from '../../sources/loadedSource';
import { CDTPScriptUrl } from '../../sources/resourceIdentifierSubtypes';
import { BPRecipeIsUnbound, BPRecipeIsBound, IBPRecipeSingleLocationStatus } from '../bpRecipeStatusForRuntimeSource';
import { BreakpointInSource } from '../breakpoint';
import { IScript } from '../../scripts/script';

export interface IBreakpointsRegistryDependencies {
    onBPRecipeStatusChanged(bpRecipeInSource: BPRecipeInSource): void;
}

export class BreakpointsRegistry {
    private readonly _unmappedRecipeToBreakpoints = new ValidatedMap<BPRecipeInSource, IValidatedMap<LocationInLoadedSource, IBPRecipeSingleLocationStatus>>();
    private readonly _scriptToBreakpoints = new ValidatedMultiMap<IScript, CDTPBreakpoint>();

    constructor(private readonly _dependencies: IBreakpointsRegistryDependencies) { }

    public registerBPRecipeIfNeeded(bpRecipe: BPRecipeInSource): void {
        // If the same breakpoint recipe maps to multiple runtime files with different URLs, we'll get the call to registerBPRecipeIfNeeded with the same recipe more than once
        if (!this._unmappedRecipeToBreakpoints.has(bpRecipe)) {
            this._unmappedRecipeToBreakpoints.set(bpRecipe, new ValidatedMap<LocationInLoadedSource, IBPRecipeSingleLocationStatus>());
        }
    }

    public unregisterBPRecipe(bpRecipe: BPRecipeInSource): void {
        this._unmappedRecipeToBreakpoints.delete(bpRecipe);
    }

    public registerBreakpointAsBound(bp: CDTPBreakpoint): void {
        this._unmappedRecipeToBreakpoints.getOrAdd(bp.recipe.unmappedBPRecipe, () => new ValidatedMap<LocationInLoadedSource, IBPRecipeSingleLocationStatus>());
        this._scriptToBreakpoints.add(bp.actualLocation.script, bp);
    }

    public bpRecipeIsBoundForRuntimeSource(bpRecipe: BPRecipeInSource, locationInRuntimeSource: LocationInLoadedSource, bpsInSource: BreakpointInSource[]): void {
        const runtimeSourceToBPRStatus = this._unmappedRecipeToBreakpoints.get(bpRecipe);
        runtimeSourceToBPRStatus.set(locationInRuntimeSource, new BPRecipeIsBound(bpRecipe, locationInRuntimeSource, bpsInSource));

        this._dependencies.onBPRecipeStatusChanged(bpRecipe);
    }

    public bpRecipeIsUnboundForRuntimeSource(bpRecipe: BPRecipeInSource, locationInRuntimeSource: LocationInLoadedSource, error: Error): void {
        const runtimeSourceToBPRStatus = this._unmappedRecipeToBreakpoints.get(bpRecipe);
        runtimeSourceToBPRStatus.set(locationInRuntimeSource, new BPRecipeIsUnbound(bpRecipe, locationInRuntimeSource, error));

        this._dependencies.onBPRecipeStatusChanged(bpRecipe);
    }

    public getStatusOfBPRecipe(bpRecipe: BPRecipeInSource): IBPRecipeStatus {
        const statusForRuntimeSources = Array.from(this._unmappedRecipeToBreakpoints.get(bpRecipe).values());
        const boundSubstatuses = <BPRecipeIsBound[]>statusForRuntimeSources.filter(s => s instanceof BPRecipeIsBound);
        const unboundSubstatuses = <BPRecipeIsUnbound[]>statusForRuntimeSources.filter(s => s instanceof BPRecipeIsUnbound);

        return createBPRecipieStatus(bpRecipe, boundSubstatuses, unboundSubstatuses);
    }

    public tryGettingBreakpointAtLocation(locationInScript: LocationInScript): CDTPBreakpoint[] {
        const breakpoints = this._scriptToBreakpoints.tryGetting(locationInScript.script) || new Set();
        const bpsAtLocation = [];
        for (const bp of breakpoints) {
            if (bp.actualLocation.isSameAs(locationInScript)) {
                bpsAtLocation.push(bp);
            }
        }

        return bpsAtLocation;
    }

    public toString(): string {
        return `Breakpoints recipe status Registry:\nRecipe to breakpoints: ${this._unmappedRecipeToBreakpoints}`;
    }
}
