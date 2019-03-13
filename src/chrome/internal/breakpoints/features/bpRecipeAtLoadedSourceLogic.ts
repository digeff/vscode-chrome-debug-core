/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { inject, injectable } from 'inversify';
import { IDebuggeeBreakpointsSetter } from '../../../cdtpDebuggee/features/cdtpDebuggeeBreakpointsSetter';
import { IBreakpointFeaturesSupport } from '../../../cdtpDebuggee/features/cdtpBreakpointFeaturesSupport';
import { TYPES } from '../../../dependencyInjection.ts/types';
import { IEventsToClientReporter } from '../../../client/eventSender';
import { ReasonType } from '../../../stoppedEvent';
import { CDTPBreakpoint } from '../../../cdtpDebuggee/cdtpPrimitives';
import { DebuggeeBPRsSetForClientBPRFinder } from '../registries/debuggeeBPRsSetForClientBPRFinder';
import { BPRecipeInLoadedSource } from '../BaseMappedBPRecipe';
import { ConditionalPause, AlwaysPause } from '../bpActionWhenHit';
import { PausedEvent } from '../../../cdtpDebuggee/eventsProviders/cdtpDebuggeeExecutionEventsProvider';
import { BPRecipe } from '../bpRecipe';
import { ISource } from '../../sources/source';
import { LocationInScript, Position, ScriptOrSourceOrURLOrURLRegexp } from '../../locations/location';
import { createColumnNumber, createLineNumber } from '../../locations/subtypes';
import { RangeInScript, RangeInResource } from '../../locations/rangeInScript';
import { logger } from 'vscode-debugadapter/lib/logger';
import { BreakpointsRegistry } from '../registries/breakpointsRegistry';
import { asyncMap } from '../../../collections/async';
import { IBreakpoint, BPPossibleResources } from '../breakpoint';
import * as _ from 'lodash';
import * as chromeUtils from '../../../chromeUtils';
import { IComponentWithAsyncInitialization } from '../../features/components';
import { wrapWithMethodLogger } from '../../../logging/methodsCalledLogger';
import { BaseNotifyClientOfPause, ActionToTakeWhenPausedProvider, IActionToTakeWhenPaused, NoActionIsNeededForThisPause } from '../../features/actionToTakeWhenPaused';
import { IDebuggeePausedHandler } from '../../features/debuggeePausedHandler';

export class HitBreakpoint extends BaseNotifyClientOfPause {
    protected reason: ReasonType = 'breakpoint';

    constructor(protected readonly _eventsToClientReporter: IEventsToClientReporter) {
        super();
    }
}

export interface IBreakpointsInLoadedSource {
    addBreakpointAtLoadedSource(bpRecipe: BPRecipeInLoadedSource<ConditionalPause | AlwaysPause>): Promise<CDTPBreakpoint[]>;
    removeBreakpoint(clientBPRecipe: BPRecipe<ISource>): Promise<void>;
}

export class BPRecipeAtLoadedSourceLogic implements IBreakpointsInLoadedSource {
    private readonly doesTargetSupportColumnBreakpointsCached: Promise<boolean>;

    public readonly withLogging = wrapWithMethodLogger(this);

    constructor(
        private readonly _breakpointFeaturesSupport: IBreakpointFeaturesSupport,
        private readonly _breakpointRegistry: BreakpointsRegistry,
        private readonly _bpRecipesRegistry: DebuggeeBPRsSetForClientBPRFinder,
        private readonly _targetBreakpoints: IDebuggeeBreakpointsSetter,
        private readonly _eventsToClientReporter: IEventsToClientReporter,
        private readonly _debuggeePausedHandler: IDebuggeePausedHandler) {
        this.doesTargetSupportColumnBreakpointsCached = this._breakpointFeaturesSupport.supportsColumnBreakpoints;
        this._debuggeePausedHandler.registerActionProvider(paused => this.withLogging.onProvideActionForWhenPaused(paused));
    }

    public async onProvideActionForWhenPaused(paused: PausedEvent): Promise<IActionToTakeWhenPaused> {
        if (paused.hitBreakpoints && paused.hitBreakpoints.length > 0) {
            // TODO DIEGO: Improve this to consider breakpoints where we shouldn't pause
            return new HitBreakpoint(this._eventsToClientReporter);
        } else {
            return new NoActionIsNeededForThisPause(this);
        }
    }

    public async addBreakpointAtLoadedSource(bpRecipe: BPRecipeInLoadedSource<ConditionalPause | AlwaysPause>): Promise<CDTPBreakpoint[]> {
        const bpsInScriptRecipe = bpRecipe.mappedToScript();
        this._breakpointRegistry.registerBPRecipeIfNeeded(bpRecipe.unmappedBPRecipe);

        const breakpoints = _.flatten(await asyncMap(bpsInScriptRecipe, async bpInScriptRecipe => {
            const bestLocation = await this.considerColumnAndSelectBestBPLocation(bpInScriptRecipe.location);
            const bpRecipeInBestLocation = bpInScriptRecipe.withLocationReplaced(bestLocation);

            const runtimeSource = bpInScriptRecipe.location.script.runtimeSource;

            let breakpoints: CDTPBreakpoint[];
            if (!runtimeSource.doesScriptHasUrl()) {
                breakpoints = [await this._targetBreakpoints.setBreakpoint(bpRecipeInBestLocation)];
            } else if (runtimeSource.identifier.isLocalFilePath()) {
                breakpoints = await this._targetBreakpoints.setBreakpointByUrlRegexp(bpRecipeInBestLocation.mappedToUrlRegexp());
            } else {
                /**
                 * The script has a URL and it's not a local file path, so we could leave it as-is.
                 * We transform it into a regexp to add a GUID to it, so CDTP will let us add the same breakpoint/recipe two times (using different guids).
                 * That way we can always add the new breakpoints for a file, before removing the old ones (except if the script doesn't have an URL)
                 */
                breakpoints = await this._targetBreakpoints.setBreakpointByUrlRegexp(bpRecipeInBestLocation.mappedToUrlRegexp());
            }

            // The onBreakpointResolvedSyncOrAsync handler will notify us that a breakpoint was bound, and send the status update to the client if neccesary

            breakpoints.forEach(breakpoint => {
                this._bpRecipesRegistry.debuggeeBPRsWasSet(bpRecipe.unmappedBPRecipe, breakpoint.recipe);
            });

            return breakpoints;
        }));
        return breakpoints;
    }

    public async removeBreakpoint(clientBPRecipe: BPRecipe<ISource>): Promise<void> {
        const debuggeeBPRecipes = this._bpRecipesRegistry.findDebuggeeBPRsSet(clientBPRecipe);
        await asyncMap(debuggeeBPRecipes, async bpr => {
            await this._targetBreakpoints.removeBreakpoint(bpr);
            await this._bpRecipesRegistry.debuggeeBPRsWasRemoved(clientBPRecipe, bpr);
        });

        this._bpRecipesRegistry.clientBPRWasRemoved(clientBPRecipe);
        this._breakpointRegistry.unregisterBPRecipe(clientBPRecipe);
    }

    private async considerColumnAndSelectBestBPLocation(location: LocationInScript): Promise<LocationInScript> {
        if (await this.doesTargetSupportColumnBreakpointsCached) {
            const thisLineStart = new Position(location.position.lineNumber, createColumnNumber(0));
            const nextLineStart = new Position(createLineNumber(location.position.lineNumber + 1), createColumnNumber(0));
            const thisLineRange = new RangeInResource(location.script, thisLineStart, nextLineStart);

            const possibleLocations = await this._targetBreakpoints.getPossibleBreakpoints(thisLineRange);

            if (possibleLocations.length > 0) {
                const bestLocation = chromeUtils.selectBreakpointLocation(location.position.lineNumber, location.position.columnNumber, possibleLocations);
                logger.verbose(`PossibleBreakpoints: Best location for ${location} is ${bestLocation}`);
                return bestLocation;
            }
        }

        return location;
    }

    public toString(): string {
        return 'BPRecipeAtLoadedSourceLogic';
    }
}