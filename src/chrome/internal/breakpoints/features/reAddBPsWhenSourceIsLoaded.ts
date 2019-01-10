/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { BPRecipesInSource } from '../bpRecipes';
import { ILoadedSource } from '../../sources/loadedSource';
import { asyncMap } from '../../../collections/async';
import { BPRecipeIsUnbound, BPRecipeIsBound } from '../bpRecipeStatus';
import { newResourceIdentifierMap, IResourceIdentifier } from '../../sources/resourceIdentifier';
import { IEventsToClientReporter } from '../../../client/eventSender';
import { IPromiseDefer, promiseDefer } from '../../../../utils';
import { IComponent } from '../../features/feature';
import { injectable, inject } from 'inversify';
import { IBreakpointsInLoadedSource } from './bpRecipeAtLoadedSourceLogic';
import { TYPES } from '../../../dependencyInjection.ts/types';

export interface IEventsConsumedByReAddBPsWhenSourceIsLoaded {
    onLoadedSourceIsAvailable(listener: (source: ILoadedSource) => Promise<void>): void;
    notifyNoPendingBPs(): void;
}

@injectable()
export class ReAddBPsWhenSourceIsLoaded implements IComponent {
    private readonly _sourcePathToBPRecipes = newResourceIdentifierMap<BPRecipesInSource>();
    private readonly _sourcePathToBPsAreSetDefer = newResourceIdentifierMap<IPromiseDefer<void>>();

    public install(): void {
        this._dependencies.onLoadedSourceIsAvailable(source => this.onLoadedSourceIsAvailable(source));
    }

    public replaceBPsForSourceWith(requestedBPs: BPRecipesInSource): void {
        this._sourcePathToBPRecipes.set(requestedBPs.requestedSourcePath, requestedBPs);
    }

    public waitUntilBPsAreSet(loadedSource: ILoadedSource): Promise<void> {
        const bpRecipes = this._sourcePathToBPRecipes.tryGetting(loadedSource.identifier);
        if (bpRecipes !== undefined) {
            return this.getBPsAreSetDefer(loadedSource.identifier).promise;
        } else {
            const defer = this._sourcePathToBPsAreSetDefer.tryGetting(loadedSource.identifier);
            return Promise.resolve(defer && defer.promise);
        }
    }

    private getBPsAreSetDefer(identifier: IResourceIdentifier): IPromiseDefer<void> {
        return this._sourcePathToBPsAreSetDefer.getOrAdd(identifier, () => promiseDefer<void>());
    }

    private async onLoadedSourceIsAvailable(source: ILoadedSource): Promise<void> {
        const unbindBPRecipes = this._sourcePathToBPRecipes.tryGetting(source.identifier);

        if (unbindBPRecipes !== undefined) {
            // We remove it first in sync just to avoid race conditions (If we get multiple refreshes fast, we could get events for the same source path severla times)
            const defer = this.getBPsAreSetDefer(source.identifier);
            this._sourcePathToBPRecipes.delete(source.identifier);
            const remainingBPRecipes = new Set(unbindBPRecipes.breakpoints);
            await asyncMap(unbindBPRecipes.breakpoints, async bpRecipe => {
                try {
                    const bpRecepieResolved = bpRecipe.resolvedWithLoadedSource(source);
                    const bpStatus = await this._breakpointsInLoadedSource.addBreakpointAtLoadedSource(bpRecepieResolved);
                    const mappedBreakpoints = bpStatus.map(breakpoint => breakpoint.mappedToSource());
                    this._eventsToClientReporter.sendBPStatusChanged({
                        bpRecipeStatus: new BPRecipeIsBound(bpRecipe, mappedBreakpoints, 'TODO DIEGO'),
                        reason: 'changed'
                    });
                    remainingBPRecipes.delete(bpRecipe);
                } catch (exception) {
                    this._eventsToClientReporter.sendBPStatusChanged({
                        bpRecipeStatus: new BPRecipeIsUnbound(bpRecipe, `An unexpected error happen while trying to set the breakpoint: ${exception})`),
                        reason: 'changed'
                    });
                }
            });

            // Notify others that we are finished setting the BPs
            defer.resolve();
            this._sourcePathToBPsAreSetDefer.delete(source.identifier);

            if (remainingBPRecipes.size > 0) {
                // TODO DIEGO: Add telemetry given that we don't expect this to happen
                // If we still have BPs recipes that we couldn't add, we put them back in
                this._sourcePathToBPRecipes.set(source.identifier, new BPRecipesInSource(unbindBPRecipes.source, Array.from(remainingBPRecipes)));
            }

            if (this._sourcePathToBPRecipes.size === 0) {
                this._dependencies.notifyNoPendingBPs();
            }
        }
    }

    public toString(): string {
        return `{ BPs to re-add when source is laoded: ${this._sourcePathToBPRecipes}}`;
    }

    constructor(
        @inject(TYPES.EventsConsumedByConnectedCDA) private readonly _dependencies: IEventsConsumedByReAddBPsWhenSourceIsLoaded,
        @inject(TYPES.EventSender) private readonly _eventsToClientReporter: IEventsToClientReporter,
        @inject(TYPES.BPRecipeInLoadedSourceLogic) private readonly _breakpointsInLoadedSource: IBreakpointsInLoadedSource) { }
}