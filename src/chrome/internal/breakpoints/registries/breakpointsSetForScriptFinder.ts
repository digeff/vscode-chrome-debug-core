/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as _ from 'lodash';
import { ValidatedMultiMap } from '../../../collections/validatedMultiMap';
import { LocationInScript } from '../../locations/location';
import { CDTPBreakpoint } from '../../../cdtpDebuggee/cdtpPrimitives';
import { IScript } from '../../scripts/script';
import { injectable } from 'inversify';
import { BPRecipeWasResolved } from '../../../cdtpDebuggee/features/cdtpDebuggeeBreakpointsSetter';

/**
 * Find the list of breakpoints that we set for a particular script
 */
@injectable()
export class BreakpointsSetForScriptFinder {
    private readonly _scriptToBreakpoints = ValidatedMultiMap.empty<IScript, CDTPBreakpoint>();

    public bpRecipeIsResolved(bpRecipeWasResolved: BPRecipeWasResolved): void {
        this._scriptToBreakpoints.add(bpRecipeWasResolved.breakpoint.actualLocation.script, bpRecipeWasResolved.breakpoint);
    }

    public tryGettingBreakpointAtLocation(locationInScript: LocationInScript): CDTPBreakpoint[] {
        const breakpoints = _.defaultTo(this._scriptToBreakpoints.tryGetting(locationInScript.script), new Set());
        const bpsAtLocation = [];
        for (const bp of breakpoints) {
            if (bp.actualLocation.isSameAs(locationInScript)) {
                bpsAtLocation.push(bp);
            }
        }

        return bpsAtLocation;
    }

    public toString(): string {
        return `Breakpoints recipe status Registry:\nRecipe to breakpoints: ${this._scriptToBreakpoints}`;
    }
}
