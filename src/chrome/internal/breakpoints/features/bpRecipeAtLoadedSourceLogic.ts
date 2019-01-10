/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { inject, injectable } from 'inversify';
import { IDebuggeeBreakpoints } from '../../../cdtpDebuggee/features/cdtpDebuggeeBreakpoints';
import { IBreakpointFeaturesSupport } from '../../../cdtpDebuggee/features/cdtpBreakpointFeaturesSupport';
import { TYPES } from '../../../dependencyInjection.ts/types';
import { InformationAboutPausedProvider, NotifyStoppedCommonLogic } from '../../features/takeProperActionOnPausedEvent';
import { IEventsToClientReporter } from '../../../client/eventSender';
import { ReasonType } from '../../../stoppedEvent';
import { CDTPBreakpoint } from '../../../cdtpDebuggee/cdtpPrimitives';
import { CDTPBPRecipesRegistry } from '../registries/bpRecipeRegistry';
import { BPRecipeInLoadedSource } from '../BaseMappedBPRecipe';
import { VoteRelevance, IVote, Abstained } from '../../../communication/collaborativeDecision';
import { ConditionalPause, AlwaysPause } from '../bpActionWhenHit';
import { PausedEvent } from '../../../cdtpDebuggee/eventsProviders/cdtpDebuggeeExecutionEventsProvider';
import { BPRecipe } from '../bpRecipe';
import { ISource } from '../../sources/source';
import { LocationInScript, Position } from '../../locations/location';
import { createColumnNumber, createLineNumber } from '../../locations/subtypes';
import { RangeInScript } from '../../locations/rangeInScript';
import { chromeUtils } from '../../../..';
import { logger } from 'vscode-debugadapter/lib/logger';
import { BreakpointsRegistry } from '../registries/breakpointsRegistry';

export type Dummy = VoteRelevance; // If we don't do this the .d.ts doesn't include VoteRelevance and the compilation fails. Remove this when the issue disappears...

export class HitBreakpoint extends NotifyStoppedCommonLogic {
    public readonly relevance = VoteRelevance.NormalVote;
    protected reason: ReasonType = 'breakpoint';

    constructor(protected readonly _eventsToClientReporter: IEventsToClientReporter,
        protected readonly _publishGoingToPauseClient: () => void) {
        super();
    }
}

export interface IBreakpointsInLoadedSource {
    addBreakpointAtLoadedSource(bpRecipe: BPRecipeInLoadedSource<ConditionalPause | AlwaysPause>): Promise<CDTPBreakpoint[]>;
}

export interface IBPRecipeAtLoadedSourceLogicDependencies {
    subscriberForAskForInformationAboutPaused(listener: InformationAboutPausedProvider): void;
    publishGoingToPauseClient(): void;
}

@injectable()
export class BPRecipeAtLoadedSourceLogic implements IBreakpointsInLoadedSource {
    private readonly doesTargetSupportColumnBreakpointsCached: Promise<boolean>;

    public async askForInformationAboutPaused(paused: PausedEvent): Promise<IVote<void>> {
        if (paused.hitBreakpoints && paused.hitBreakpoints.length > 0) {
            // TODO DIEGO: Improve this to consider breakpoints where we shouldn't pause
            return new HitBreakpoint(this._eventsToClientReporter,
                // () => this._dependencies.publishGoingToPauseClient() TODO Figure out if we need this for the Chrome Overlay
                () => { });
        } else {
            return new Abstained(this);
        }
    }

    public async addBreakpointAtLoadedSource(bpRecipe: BPRecipeInLoadedSource<ConditionalPause | AlwaysPause>): Promise<CDTPBreakpoint[]> {
        const bpInScriptRecipe = bpRecipe.mappedToScript();
        const bestLocation = await this.considerColumnAndSelectBestBPLocation(bpInScriptRecipe.location);
        const bpRecipeInBestLocation = bpInScriptRecipe.withLocationReplaced(bestLocation);

        const runtimeSource = bpInScriptRecipe.location.script.runtimeSource;
        this._breakpointRegistry.registerBPRecipe(bpRecipe.unmappedBPRecipe);

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

        breakpoints.forEach(breakpoint => {
            this._breakpointRegistry.registerBreakpointAsBound(breakpoint);
            this._bpRecipesRegistry.register(bpRecipe.unmappedBPRecipe, breakpoint.recipe);
        });

        return breakpoints;
    }

    public async removeBreakpoint(clientBPRecipe: BPRecipe<ISource>): Promise<void> {
        const debuggeeBPRecipe = this._bpRecipesRegistry.getDebuggeeBPRecipe(clientBPRecipe);
        this._targetBreakpoints.removeBreakpoint(debuggeeBPRecipe);
    }

    private async considerColumnAndSelectBestBPLocation(location: LocationInScript): Promise<LocationInScript> {
        if (await this.doesTargetSupportColumnBreakpointsCached) {
            const thisLineStart = new Position(location.position.lineNumber, createColumnNumber(0));
            const nextLineStart = new Position(createLineNumber(location.position.lineNumber + 1), createColumnNumber(0));
            const thisLineRange = new RangeInScript(location.script, thisLineStart, nextLineStart);

            const possibleLocations = await this._targetBreakpoints.getPossibleBreakpoints(thisLineRange);

            if (possibleLocations.length > 0) {
                const bestLocation = chromeUtils.selectBreakpointLocation(location.position.lineNumber, location.position.columnNumber, possibleLocations);
                logger.verbose(`PossibleBreakpoints: Best location for ${location} is ${bestLocation}`);
                return bestLocation;
            }
        }

        return location;
    }

    public install(): this {
        this._dependencies.subscriberForAskForInformationAboutPaused(params => this.askForInformationAboutPaused(params));
        return this;
    }

    constructor(
        @inject(TYPES.EventsConsumedByConnectedCDA) private readonly _dependencies: IBPRecipeAtLoadedSourceLogicDependencies,
        @inject(TYPES.IBreakpointFeaturesSupport) private readonly _breakpointFeaturesSupport: IBreakpointFeaturesSupport,
        private readonly _breakpointRegistry: BreakpointsRegistry,
        private readonly _bpRecipesRegistry: CDTPBPRecipesRegistry,
        @inject(TYPES.ITargetBreakpoints) private readonly _targetBreakpoints: IDebuggeeBreakpoints,
        @inject(TYPES.IEventsToClientReporter) private readonly _eventsToClientReporter: IEventsToClientReporter) {
        this.doesTargetSupportColumnBreakpointsCached = this._breakpointFeaturesSupport.supportsColumnBreakpoints;
    }
}