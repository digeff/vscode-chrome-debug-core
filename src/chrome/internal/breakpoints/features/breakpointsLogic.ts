/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { IBPRecipe } from '../bpRecipe';
import { BPRecipesInSource, BPRecipesInLoadedSource } from '../bpRecipes';
import { ExistingBPsForJustParsedScriptSetter } from './existingBPsForJustParsedScriptSetter';
import { asyncMap } from '../../../collections/async';
import { IBPRecipeStatus } from '../bpRecipeStatus';
import { ClientCurrentBPRecipesRegistry } from '../registries/clientCurrentBPRecipesRegistry';
import { BreakpointsRegistry } from '../registries/breakpointsRegistry';
import { BPRecipeAtLoadedSourceLogic, IBreakpointsInLoadedSource } from './bpRecipeAtLoadedSourceLogic';
import { RemoveProperty } from '../../../../typeUtils';
import { IEventsToClientReporter } from '../../../client/eventSender';
import { PauseScriptLoadsToSetBPs, IPauseScriptLoadsToSetBPsDependencies } from './pauseScriptLoadsToSetBPs';
import { inject, injectable } from 'inversify';
import { TYPES } from '../../../dependencyInjection.ts/types';
import { IDebuggeeBreakpointsSetter } from '../../../cdtpDebuggee/features/cdtpDebuggeeBreakpointsSetter';
import { BPRsDeltaInRequestedSource } from './bpsDeltaCalculator';
import { CDTPBreakpoint } from '../../../cdtpDebuggee/cdtpPrimitives';
import { ISource } from '../../sources/source';
import { IComponent } from '../../features/feature';
import { ITelemetryPropertyCollector } from '../../../..';
import { ConnectedCDAConfiguration } from '../../../client/chromeDebugAdapter/cdaConfiguration';
import { IScriptParsedProvider } from '../../../cdtpDebuggee/eventsProviders/cdtpOnScriptParsedEventProvider';
import { DebuggeeBPRsSetForClientBPRFinder } from '../registries/debuggeeBPRsSetForClientBPRFinder';
import { BPRecipeInSource } from '../bpRecipeInSource';
import { IDOMInstrumentationBreakpointsSetter } from '../../../cdtpDebuggee/features/cdtpDOMInstrumentationBreakpointsSetter';
import { IDebugeeExecutionController } from '../../../cdtpDebuggee/features/cdtpDebugeeExecutionController';
import { IDebugeeRuntimeVersionProvider } from '../../../cdtpDebuggee/features/cdtpDebugeeRuntimeVersionProvider';
import { IBreakpointFeaturesSupport } from '../../../cdtpDebuggee/features/cdtpBreakpointFeaturesSupport';
import { wrapWithMethodLogger } from '../../../logging/methodsCalledLogger';

export interface InternalDependencies extends
    IPauseScriptLoadsToSetBPsDependencies {

    onAsyncBreakpointResolved(listener: (params: CDTPBreakpoint) => void): void;
}

export type EventsConsumedByBreakpointsLogic = RemoveProperty<InternalDependencies,
    'waitUntilUnboundBPsAreSet' |
    'notifyAllBPsAreBound' |
    'tryGettingBreakpointAtLocation'> & IPauseScriptLoadsToSetBPsDependencies;

@injectable()
export class BreakpointsLogic implements IComponent {
    private readonly _clientCurrentBPRecipesRegistry = wrapWithMethodLogger(new ClientCurrentBPRecipesRegistry(), 'ClientCurrentBPRecipesRegistry');
    private readonly _debuggeeBPRsSetForClientBPRFinder = wrapWithMethodLogger(new DebuggeeBPRsSetForClientBPRFinder(), 'DebuggeeBPRsSetForClientBPRFinder');
    private readonly _breakpointRegistry = wrapWithMethodLogger(new BreakpointsRegistry({ onBPRecipeStatusChanged: recipie => this.onUnbounBPRecipeIsNowBound(recipie) }), 'BreakpointsRegistry');

    private readonly _breakpointsInLoadedSource = new BPRecipeAtLoadedSourceLogic(this._dependencies, this._breakpointFeaturesSupport, this._breakpointRegistry, this._debuggeeBPRsSetForClientBPRFinder,
        this._targetBreakpoints, this._eventsToClientReporter).withLogging;

    private readonly _existingBPsForJustParsedScriptSetter = new ExistingBPsForJustParsedScriptSetter({ onBPRecipeStatusChanged: (bpr: BPRecipeInSource) => this.onUnbounBPRecipeIsNowBound(bpr) },
        this._scriptParsedProvider, this._debuggeeBPRsSetForClientBPRFinder, this._clientCurrentBPRecipesRegistry, this._breakpointsInLoadedSource, this._breakpointRegistry).withLogging;

    private readonly _bpsWhileLoadingLogic: PauseScriptLoadsToSetBPs = new PauseScriptLoadsToSetBPs(this._dependencies, this._domInstrumentationBreakpoints, this._debugeeExecutionControl, this._eventsToClientReporter,
        this._debugeeVersionProvider, this._existingBPsForJustParsedScriptSetter, this._breakpointRegistry).withLogging;

    private _isBpsWhileLoadingEnable: boolean;

    protected onBreakpointResolved(breakpoint: CDTPBreakpoint): void {
        this._breakpointRegistry.registerBreakpointAsBound(breakpoint);
        this.onUnbounBPRecipeIsNowBound(breakpoint.recipe.unmappedBPRecipe);
    }

    private onUnbounBPRecipeIsNowBound(bpRecipe: BPRecipeInSource): void {
        const bpRecipeStatus = this._breakpointRegistry.getStatusOfBPRecipe(bpRecipe);
        this._eventsToClientReporter.sendBPStatusChanged({ reason: 'changed', bpRecipeStatus: bpRecipeStatus });
    }

    public async updateBreakpointsForFile(requestedBPs: BPRecipesInSource, _?: ITelemetryPropertyCollector): Promise<IBPRecipeStatus[]> {
        const bpsDelta = this._clientCurrentBPRecipesRegistry.updateBPRecipesAndCalculateDelta(requestedBPs);
        const requestedBPsToAdd = new BPRecipesInSource(bpsDelta.resource, bpsDelta.requestedToAdd);
        bpsDelta.requestedToAdd.forEach(requestedBP => this._breakpointRegistry.registerBPRecipeIfNeeded(requestedBP));

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
            });

        return bpsDelta.matchesForRequested.map(bpRecipe => this._breakpointRegistry.getStatusOfBPRecipe(bpRecipe));
    }

    private async removeDeletedBreakpointsFromFile(bpsDelta: BPRsDeltaInRequestedSource) {
        await asyncMap(bpsDelta.existingToRemove, async (existingBPToRemove) => {
            await this._breakpointsInLoadedSource.removeBreakpoint(existingBPToRemove);
        });
    }

    private async addNewBreakpointsForFile(requestedBPsToAddInLoadedSources: BPRecipesInLoadedSource) {
        await asyncMap(requestedBPsToAddInLoadedSources.breakpoints, async (requestedBP) => {
            // DIEGO TODO: Do we need to do one breakpoint at a time to avoid issues on CDTP, or can we do them in parallel now that we use a different algorithm?
            await this._breakpointsInLoadedSource.addBreakpointAtLoadedSource(requestedBP);
        });
    }

    public install(): this {
        this._existingBPsForJustParsedScriptSetter.install();
        this._bpsWhileLoadingLogic.install();
        this._debuggeeBreakpoints.onBreakpointResolvedSyncOrAsync(breakpoint => this.onBreakpointResolved(breakpoint));
        this._breakpointsInLoadedSource.install();
        return this.configure();
    }

    public configure(): this {
        this._isBpsWhileLoadingEnable = this._configuration.args.breakOnLoadStrategy !== 'off';
        return this;

    }

    constructor(
        @inject(TYPES.EventsConsumedByConnectedCDA) private readonly _dependencies: EventsConsumedByBreakpointsLogic,
        @inject(TYPES.ITargetBreakpoints) private readonly _debuggeeBreakpoints: IDebuggeeBreakpointsSetter,
        @inject(TYPES.ConnectedCDAConfiguration) private readonly _configuration: ConnectedCDAConfiguration,
        @inject(TYPES.IScriptParsedProvider) private readonly _scriptParsedProvider: IScriptParsedProvider,
        @inject(TYPES.IDOMInstrumentationBreakpoints) private readonly _domInstrumentationBreakpoints: IDOMInstrumentationBreakpointsSetter,
        @inject(TYPES.IDebugeeExecutionControl) private readonly _debugeeExecutionControl: IDebugeeExecutionController,
        @inject(TYPES.IEventsToClientReporter) protected readonly _eventsToClientReporter: IEventsToClientReporter,
        @inject(TYPES.IBreakpointFeaturesSupport) private readonly _breakpointFeaturesSupport: IBreakpointFeaturesSupport,
        @inject(TYPES.ITargetBreakpoints) private readonly _targetBreakpoints: IDebuggeeBreakpointsSetter,
        @inject(TYPES.IDebugeeVersionProvider) protected readonly _debugeeVersionProvider: IDebugeeRuntimeVersionProvider) {
    }
}