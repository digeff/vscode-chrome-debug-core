/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { IBPRecipe } from '../bpRecipe';
import { ITelemetryPropertyCollector, IComponent, ConnectedCDAConfiguration } from '../../../..';
import { BPRecipesInSource, BPRecipesInLoadedSource } from '../bpRecipes';
import { ReAddBPsWhenSourceIsLoaded, IEventsConsumedByReAddBPsWhenSourceIsLoaded } from './reAddBPsWhenSourceIsLoaded';
import { asyncMap } from '../../../collections/async';
import { IBPRecipeStatus } from '../bpRecipeStatus';
import { ClientCurrentBPRecipesRegistry } from '../registries/clientCurrentBPRecipesRegistry';
import { BreakpointsRegistry } from '../registries/breakpointsRegistry';
import { BPRecipeAtLoadedSourceLogic } from './bpRecipeAtLoadedSourceLogic';
import { RemoveProperty } from '../../../../typeUtils';
import { IEventsToClientReporter } from '../../../client/eventSender';
import { PauseScriptLoadsToSetBPs, IPauseScriptLoadsToSetBPsDependencies } from './pauseScriptLoadsToSetBPs';
import { inject, injectable } from 'inversify';
import { TYPES } from '../../../dependencyInjection.ts/types';
import { IDebuggeeBreakpoints } from '../../../cdtpDebuggee/features/cdtpDebuggeeBreakpoints';
import { BPRsDeltaInRequestedSource } from './bpsDeltaCalculator';
import { CDTPBreakpoint } from '../../../cdtpDebuggee/cdtpPrimitives';
import { ISource } from '../../sources/source';

export interface InternalDependencies extends
    IEventsConsumedByReAddBPsWhenSourceIsLoaded,
    IPauseScriptLoadsToSetBPsDependencies {

    onAsyncBreakpointResolved(listener: (params: CDTPBreakpoint) => void): void;
}

export type EventsConsumedByBreakpointsLogic = RemoveProperty<InternalDependencies,
    'waitUntilUnboundBPsAreSet' |
    'notifyAllBPsAreBound' |
    'tryGettingBreakpointAtLocation'> & { onNoPendingBreakpoints(listener: () => void): void };

@injectable()
export class BreakpointsLogic implements IComponent {
    private _isBpsWhileLoadingEnable: boolean;

    private readonly _clientBreakpointsRegistry = new ClientCurrentBPRecipesRegistry();

    protected onBreakpointResolved(breakpoint: CDTPBreakpoint): void {
        this._breakpointRegistry.registerBreakpointAsBound(breakpoint);
        this.onUnbounBPRecipeIsNowBound(breakpoint.recipe.unmappedBPRecipe);
    }

    private onUnbounBPRecipeIsNowBound(bpRecipe: IBPRecipe<ISource>): void {
        const bpRecipeStatus = this._breakpointRegistry.getStatusOfBPRecipe(bpRecipe);
        this._eventsToClientReporter.sendBPStatusChanged({ reason: 'changed', bpRecipeStatus });
    }

    public async updateBreakpointsForFile(requestedBPs: BPRecipesInSource, _?: ITelemetryPropertyCollector): Promise<IBPRecipeStatus[]> {
        const bpsDelta = this._clientBreakpointsRegistry.updateBPRecipesAndCalculateDelta(requestedBPs);
        const requestedBPsToAdd = new BPRecipesInSource(bpsDelta.resource, bpsDelta.requestedToAdd);
        bpsDelta.requestedToAdd.forEach(requestedBP => this._breakpointRegistry.registerBPRecipe(requestedBP));

        await requestedBPsToAdd.tryResolving(
            async requestedBPsToAddInLoadedSources => {
                // Match desired breakpoints to existing breakpoints
                if (requestedBPsToAddInLoadedSources.source.doesScriptHasUrl()) {
                    await this.addNewBreakpointsForFile(requestedBPsToAddInLoadedSources);
                    await this.removeDeletedBreakpointsFromFile(bpsDelta);
                } else {
                    // TODO: We need to pause-update-resume the debugger here to avoid a race condition
                    await this.removeDeletedBreakpointsFromFile(bpsDelta);
                    await this.addNewBreakpointsForFile(requestedBPsToAddInLoadedSources);
                }
            },
            () => {
                const existingUnboundBPs = bpsDelta.existingToLeaveAsIs.filter(bp => !this._breakpointRegistry.getStatusOfBPRecipe(bp).isVerified());
                const requestedBPsPendingToAdd = new BPRecipesInSource(bpsDelta.resource, bpsDelta.requestedToAdd.concat(existingUnboundBPs));
                if (this._isBpsWhileLoadingEnable) {
                    this._bpsWhileLoadingLogic.enableIfNeccesary();
                }
                this._unbindedBreakpointsLogic.replaceBPsForSourceWith(requestedBPsPendingToAdd);
            });

        return bpsDelta.matchesForRequested.map(bpRecipe => this._breakpointRegistry.getStatusOfBPRecipe(bpRecipe));
    }

    private async removeDeletedBreakpointsFromFile(bpsDelta: BPRsDeltaInRequestedSource) {
        await asyncMap(bpsDelta.existingToRemove, async (existingBPToRemove) => {
            await this._bprInLoadedSourceLogic.removeBreakpoint(existingBPToRemove);
        });
    }

    private async addNewBreakpointsForFile(requestedBPsToAddInLoadedSources: BPRecipesInLoadedSource) {
        await asyncMap(requestedBPsToAddInLoadedSources.breakpoints, async (requestedBP) => {
            // DIEGO TODO: Do we need to do one breakpoint at a time to avoid issues on CDTP, or can we do them in parallel now that we use a different algorithm?
            await this._bprInLoadedSourceLogic.addBreakpointAtLoadedSource(requestedBP);
        });
    }

    public install(): this {
        this._unbindedBreakpointsLogic.install();
        this._bpsWhileLoadingLogic.install();
        this._dependencies.onNoPendingBreakpoints(() => this._bpsWhileLoadingLogic.disableIfNeccesary());
        this._debuggeeBreakpoints.onBreakpointResolvedSyncOrAsync(breakpoint => this.onBreakpointResolved(breakpoint));
        this._bprInLoadedSourceLogic.install();
        return this.configure();
    }

    public configure(): this {
        this._isBpsWhileLoadingEnable = this._configuration.args.breakOnLoadStrategy !== 'off';
        return this;
    }

    constructor(
        @inject(TYPES.EventsConsumedByConnectedCDA) private readonly _dependencies: EventsConsumedByBreakpointsLogic,
        @inject(TYPES.BreakpointsRegistry) private readonly _breakpointRegistry: BreakpointsRegistry,
        @inject(TYPES.ReAddBPsWhenSourceIsLoaded) private readonly _unbindedBreakpointsLogic: ReAddBPsWhenSourceIsLoaded,
        @inject(TYPES.PauseScriptLoadsToSetBPs) private readonly _bpsWhileLoadingLogic: PauseScriptLoadsToSetBPs,
        @inject(TYPES.BPRecipeInLoadedSourceLogic) private readonly _bprInLoadedSourceLogic: BPRecipeAtLoadedSourceLogic,
        @inject(TYPES.EventSender) private readonly _eventsToClientReporter: IEventsToClientReporter,
        @inject(TYPES.ITargetBreakpoints) private readonly _debuggeeBreakpoints: IDebuggeeBreakpoints,
        @inject(TYPES.ConnectedCDAConfiguration) private readonly _configuration: ConnectedCDAConfiguration) {
    }
}