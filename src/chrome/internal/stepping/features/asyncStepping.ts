/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { IComponentWithAsyncInitialization } from '../../features/components';
import { BaseNotifyClientOfPause, ActionToTakeWhenPausedProvider, IActionToTakeWhenPaused, NoActionIsNeededForThisPause, BasePauseShouldBeAutoResumed } from '../../features/actionToTakeWhenPaused';
import { injectable, inject } from 'inversify';
import { TYPES } from '../../../dependencyInjection.ts/types';
import { PausedEvent } from '../../../cdtpDebuggee/eventsProviders/cdtpDebuggeeExecutionEventsProvider';
import { IDebuggeeExecutionController } from '../../../cdtpDebuggee/features/cdtpDebugeeExecutionController';
import { IDebuggeeSteppingController } from '../../../cdtpDebuggee/features/cdtpDebugeeSteppingController';
import { IDebuggeePausedHandler } from '../../features/debuggeePausedHandler';

export class PausedBecauseAsyncCallWasScheduled extends BasePauseShouldBeAutoResumed {
    constructor(protected _debuggeeExecutionControl: IDebuggeeExecutionController) {
        super();
    }
}

@injectable()
export class AsyncStepping {
    constructor(
        @inject(TYPES.IDebuggeePausedHandler) private readonly _debuggeePausedHandler: IDebuggeePausedHandler,
        @inject(TYPES.IDebuggeeExecutionControl) private readonly _debugeeExecutionControl: IDebuggeeExecutionController,
        @inject(TYPES.IDebuggeeSteppingController) private readonly _debugeeStepping: IDebuggeeSteppingController) {
        this._debuggeePausedHandler.registerActionProvider(paused => this.onProvideActionForWhenPaused(paused));
    }

    public async onProvideActionForWhenPaused(paused: PausedEvent): Promise<IActionToTakeWhenPaused> {
        if (paused.asyncCallStackTraceId) {
            await this._debugeeStepping.pauseOnAsyncCall({ parentStackTraceId: paused.asyncCallStackTraceId });
            return new PausedBecauseAsyncCallWasScheduled(this._debugeeExecutionControl);
        }

        return new NoActionIsNeededForThisPause(this);
    }
}