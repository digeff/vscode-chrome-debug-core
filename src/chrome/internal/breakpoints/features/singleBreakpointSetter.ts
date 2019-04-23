import { inject, injectable, LazyServiceIdentifer } from 'inversify';
import { PrivateTypes } from '../diTypes';

import { BPRecipeAtLoadedSourceSetter, OnPausedForBreakpointCallback } from './bpRecipeAtLoadedSourceLogic';
import { BPRecipeStatusCalculator, BPRecipeStatusChanged } from '../registries/bpRecipeStatusCalculator';
import { Listeners } from '../../../communication/listeners';
import { BPRecipeInSource } from '../bpRecipeInSource';
import { IBPRecipeStatus } from '../bpRecipeStatus';
import { BPRecipe } from '../bpRecipe';
import { PauseScriptLoadsToSetBPs } from './pauseScriptLoadsToSetBPs';
import { BreakpointsEventSystem } from './breakpointsEventSystem';
import { BPRecipesForSourceRetriever } from '../registries/bpRecipesForSourceRetriever';
import { ExistingBPsForJustParsedScriptSetter } from './existingBPsForJustParsedScriptSetter';
import { IEventsConsumer, BPRecipeWasResolved } from '../../../cdtpDebuggee/features/cdtpDebuggeeBreakpointsSetter';
import { IBPActionWhenHit } from '../bpActionWhenHit';
import { TYPES } from '../../../dependencyInjection.ts/types';
import { ConnectedCDAConfiguration } from '../../../client/chromeDebugAdapter/cdaConfiguration';
import { ISource } from '../../sources/source';

export interface ISingleBreakpointSetter {
    readonly bpRecipeStatusChangedListeners: Listeners<BPRecipeStatusChanged, void>;

    setOnPausedForBreakpointCallback(onPausedForBreakpointCallback: OnPausedForBreakpointCallback): void;

    addBPRecipe(requestedBP: BPRecipeInSource): Promise<void>;
    removeBPRecipe(clientBPRecipe: BPRecipeInSource): Promise<void>;

    statusOfBPRecipe(bpRecipe: BPRecipeInSource): IBPRecipeStatus;

    install(): Promise<this>;
}

@injectable()
export class SingleBreakpointSetter implements ISingleBreakpointSetter {
    public readonly clientBPRecipeAddedListeners = new Listeners<BPRecipeInSource, void>();
    public readonly clientBPRecipeRemovedListeners = new Listeners<BPRecipeInSource, void>();
    public readonly bpRecipeIsResolvedListeners = new Listeners<BPRecipeWasResolved, void>();
    public readonly bpRecipeStatusChangedListeners = new Listeners<BPRecipeStatusChanged, void>();
    private _isBpsWhileLoadingEnable = false;
    public readonly _bpRecipeWasResolvedEventsConsumer: IEventsConsumer = {
        bpRecipeWasResolved: (breakpoint, resolutionSynchronicity) => this.bpRecipeIsResolvedListeners.call(new BPRecipeWasResolved(breakpoint, resolutionSynchronicity))
    };

    public constructor(
        @inject(PrivateTypes.BPRecipeAtLoadedSourceSetter) private readonly _breakpointsInLoadedSource: BPRecipeAtLoadedSourceSetter,
        @inject(new LazyServiceIdentifer(() => TYPES.ConnectedCDAConfiguration)) private readonly _configuration: ConnectedCDAConfiguration,
        @inject(PrivateTypes.IBreakpointsEventsListener) private readonly _breakpointsEventSystem: BreakpointsEventSystem,
        @inject(PrivateTypes.BPRecipesForSourceRetriever) private readonly _bpRecipesForSourceRetriever: BPRecipesForSourceRetriever,
        @inject(new LazyServiceIdentifer(() => PrivateTypes.PauseScriptLoadsToSetBPs)) private readonly _bpsWhileLoadingLogic: PauseScriptLoadsToSetBPs,
        // @inject(TYPES.IScriptParsedProvider) private readonly _onScriptParsedEventProvider: CDTPOnScriptParsedEventProvider,
        @inject(PrivateTypes.ExistingBPsForJustParsedScriptSetter) private readonly _existingBPsForJustParsedScriptSetter: ExistingBPsForJustParsedScriptSetter,
        @inject(PrivateTypes.BPRecipeStatusCalculator) private readonly _bpRecipeStatusCalculator: BPRecipeStatusCalculator) {
        this._breakpointsEventSystem.setDependencies(this, this._breakpointsInLoadedSource);
        this._bpRecipeStatusCalculator.bpRecipeStatusChangedListeners.add(bpRecipe => this.onBPRecipeStatusChanged(bpRecipe));
        this._existingBPsForJustParsedScriptSetter.setEventsConsumer(this._bpRecipeWasResolvedEventsConsumer);
    }

    public setOnPausedForBreakpointCallback(onPausedForBreakpointCallback: OnPausedForBreakpointCallback): void {
        this._breakpointsInLoadedSource.setOnPausedForBreakpointCallback(onPausedForBreakpointCallback);
    }

    public async install(): Promise<this> {
        await this._bpsWhileLoadingLogic.install();
        await this.configure();
        return this;
    }

    public async configure(): Promise<this> {
        this._isBpsWhileLoadingEnable = this._configuration.args.breakOnLoadStrategy !== 'off';
        if (this._isBpsWhileLoadingEnable) {
            await this._bpsWhileLoadingLogic.enableIfNeccesary();
        }
        return this;
    }

    public statusOfBPRecipe(bpRecipe: BPRecipeInSource): IBPRecipeStatus {
        return this._bpRecipeStatusCalculator.statusOfBPRecipe(bpRecipe);
    }

    public async addBPRecipe(requestedBP: BPRecipeInSource): Promise<void> {
        this._bpRecipesForSourceRetriever.bpRecipeIsBeingAdded(requestedBP);
        this.clientBPRecipeAddedListeners.call(requestedBP);

        await this.setAlreadyRegisteredBPRecipe(requestedBP, async () => {
            /**
             * TODO: Implement setting breakpoints using an heuristic when we cannot resolve the source
             * const existingUnboundBPs = bpsDelta.existingToLeaveAsIs.filter(bp => !this._singleBreakpointSetter.statusOfBPRecipe(bp).isVerified());
             * const requestedBPsPendingToAdd = new BPRecipesInSource(bpsDelta.resource, bpsDelta.requestedToAdd.concat(existingUnboundBPs));
             */
            if (this._isBpsWhileLoadingEnable) {
                // TODO: Reevaluate moving the enableIfNeccesary here
                // const whenWasEnabled = await this._bpsWhileLoadingLogic.enableIfNeccesary();
                // if (whenWasEnabled === WhenWasEnabled.JustEnabled) {
                //     /**
                //      * It's possible that while we were enabling the pause while loading logic a script got parsed for this BP Recipe,
                //      * and it doesn't pause on the first line. To address that race condition, we re-check to see if we can set the bpRecipe.
                //      * We'll wait until after all the on-flight script parsed events are processed, to make sure that we-recheck for all
                //      * events for which the instrumentation breakpoint wasn't enabled for
                //      */
                //     await this._onScriptParsedEventProvider.waitForOnFlightEventsToFinish();
                //     // await this.setAlreadyRegisteredBPRecipe(requestedBP, () => { /** We don't need to do anything */ });
                // }
            }
        });
    }

    private async setAlreadyRegisteredBPRecipe(requestedBP: BPRecipeInSource<IBPActionWhenHit>, whenNotResolvedAction: () => void): Promise<void> {
        await requestedBP.tryResolving(async (resolvedRequestedBP) => {
            await this._breakpointsInLoadedSource.addBreakpointAtLoadedSource(resolvedRequestedBP, this._bpRecipeWasResolvedEventsConsumer);
        }, whenNotResolvedAction);
    }

    public async removeBPRecipe(clientBPRecipe: BPRecipe<ISource>): Promise<void> {
        await this._breakpointsInLoadedSource.removeDebuggeeBPRs(clientBPRecipe);
        this.clientBPRecipeRemovedListeners.call(clientBPRecipe);
        this._bpRecipesForSourceRetriever.bpRecipeWasRemoved(clientBPRecipe);
    }

    public toString(): string {
        return `SingleBreakpointSetter`;
    }

    private onBPRecipeStatusChanged(bpRecipeStatusChanged: BPRecipeStatusChanged): void {
        this.bpRecipeStatusChangedListeners.call(bpRecipeStatusChanged);
    }
}