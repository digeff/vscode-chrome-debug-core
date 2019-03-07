/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { PausedEvent } from '../../cdtpDebuggee/eventsProviders/cdtpDebuggeeExecutionEventsProvider';
import { IEventsToClientReporter } from '../../client/eventSender';
import { PromiseOrNot } from '../../utils/promises';
import { injectable, inject } from 'inversify';
import { TYPES } from '../../dependencyInjection.ts/types';
import { ICDTPDebuggeeExecutionEventsProvider } from '../../cdtpDebuggee/eventsProviders/cdtpDebuggeeExecutionEventsProvider';
import { HighestPriorityItemFinder } from '../../collections/highestPriorityItemFinder';
import { Logging } from '../services/logging';
import { printArray } from '../../collections/printting';
import { IActionToTakeWhenPaused, HitDebuggerStatement, NoActionIsNeededForThisPause } from './actionToTakeWhenPaused';
import { actionClassToPriorityIndexMapping, ActionToTakeWhenPausedClass } from './pauseActionsPriorities';
import { asyncMap } from '../../collections/async';

type ActionToTakeWhenPausedProvider = (paused: PausedEvent) => PromiseOrNot<IActionToTakeWhenPaused>;

export interface IDebuggeePausedHandler {
    registerActionProvider(provider: (paused: PausedEvent) => PromiseOrNot<IActionToTakeWhenPaused>): void;
}

@injectable()
export class DebuggeePausedHandler implements IDebuggeePausedHandler {
    private readonly _actionToTakeWhenPausedProviders: ActionToTakeWhenPausedProvider[] = [];

    constructor(
        @inject(TYPES.ICDTPDebuggeeExecutionEventsProvider) private readonly _cdtpDebuggerEventsProvider: ICDTPDebuggeeExecutionEventsProvider,
        @inject(TYPES.IEventsToClientReporter) private readonly _eventsToClientReporter: IEventsToClientReporter,
        @inject(TYPES.ILogger) private readonly _logging: Logging) {
        this._cdtpDebuggerEventsProvider.onPaused(paused => this.onPause(paused));
    }

    public registerActionProvider(provider: ActionToTakeWhenPausedProvider): void {
        this._actionToTakeWhenPausedProviders.push(provider);
    }

    public async onPause(paused: PausedEvent): Promise<void> {
        // Find all the actions that we need to take when paused (Most components shouldn't care and should normally return NoActionIsNeededForThisPause)
        const actionsToTake = await asyncMap(this._actionToTakeWhenPausedProviders, provider => provider(paused));
        const relevantActionsToTake = actionsToTake.filter(action => !(action instanceof NoActionIsNeededForThisPause)); // We remove actions that don't need to do anything

        const highestPriorityAction = await new HighestPriorityItemFinder<IActionToTakeWhenPaused>(relevantActionsToTake,
            () => new HitDebuggerStatement(this._eventsToClientReporter), // If we don't have any information whatsoever, then we assume that we stopped due to a debugger statement
            voteClass => actionClassToPriorityIndexMapping.get(<ActionToTakeWhenPausedClass>voteClass.constructor)).find(); // Sort them by priority

        this.reportActionToTake(actionsToTake, highestPriorityAction);

        // Execute the action with the highest priority
        await highestPriorityAction.execute(actionsToTake);
    }

    public reportActionToTake(allActionsToTake: IActionToTakeWhenPaused[], highestPriorityActionToTake: IActionToTakeWhenPaused): void {
        const nonExecutedRelevantActions = allActionsToTake.filter(action => !(action === highestPriorityActionToTake));

        // TODO: Report telemetry here
        this._logging.verbose(printArray(`Paused - choosen: ${highestPriorityActionToTake} other actions = `, nonExecutedRelevantActions));
    }
}
