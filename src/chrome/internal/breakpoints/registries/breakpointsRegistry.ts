/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { IBPRecipeStatus, BPRecipeIsBound, BPRecipeIsUnbound } from '../bpRecipeStatus';
import { ValidatedMultiMap } from '../../../collections/validatedMultiMap';
import { IBPRecipe } from '../bpRecipe';
import { LocationInScript } from '../../locations/location';
import { injectable } from 'inversify';
import { CDTPBreakpoint } from '../../../cdtpDebuggee/cdtpPrimitives';
import { ISource } from '../../sources/source';

@injectable()
export class BreakpointsRegistry {
    private readonly _unmappedRecipeToBreakpoints = new ValidatedMultiMap<IBPRecipe<ISource>, CDTPBreakpoint>();

    public registerBPRecipe(bpRecipe: IBPRecipe<ISource>): void {
        this._unmappedRecipeToBreakpoints.addKeyIfNotExistant(bpRecipe);
    }

    public registerBreakpointAsBound(bp: CDTPBreakpoint): void {
        this._unmappedRecipeToBreakpoints.add(bp.recipe.unmappedBPRecipe, bp);
    }

    public getStatusOfBPRecipe(bpRecipe: IBPRecipe<ISource>): IBPRecipeStatus {
        const breakpoints = Array.from(this._unmappedRecipeToBreakpoints.get(bpRecipe));
        if (breakpoints.length > 0) {
            const mappedBreakpoints = breakpoints.map(breakpoint => breakpoint.mappedToSource());
            return new BPRecipeIsBound(bpRecipe, mappedBreakpoints, 'TODO DIEGO');
        } else {
            return new BPRecipeIsUnbound(bpRecipe, 'TODO DIEGO');
        }
    }

    public tryGettingBreakpointAtLocation(locationInScript: LocationInScript): CDTPBreakpoint[] {
        // TODO DIEGO: Figure out if we need a faster algorithm for this
        const matchinbBps = [];
        for (const bps of this._unmappedRecipeToBreakpoints.values()) {
            for (const bp of bps) {
                if (bp.actualLocation.isSameAs(locationInScript)) {
                    matchinbBps.push(bp);
                }
            }
        }

        return matchinbBps;
    }

    public toString(): string {
        return `Breakpoints recipe status Registry:\nRecipe to breakpoints: ${this._unmappedRecipeToBreakpoints}`;
    }
}
