/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { ScriptCallFrame } from '../../stackTraces/callFrame';
import { BaseNotifyClientOfPause, ActionToTakeWhenPausedProvider, IActionToTakeWhenPaused, NoActionIsNeededForThisPause } from '../../features/actionToTakeWhenPaused';
import { IComponentWithAsyncInitialization } from '../../features/components';
import { injectable, inject } from 'inversify';
import { IDebugeeExecutionController } from '../../../cdtpDebuggee/features/cdtpDebugeeExecutionController';
import { TYPES } from '../../../dependencyInjection.ts/types';
import { PausedEvent } from '../../../cdtpDebuggee/eventsProviders/cdtpDebuggeeExecutionEventsProvider';
import { IDebugeeSteppingController } from '../../../cdtpDebuggee/features/cdtpDebugeeSteppingController';
import { IDebuggeePausedHandler } from '../../features/debuggeePausedHandler';

type SteppingAction = () => Promise<void>;

interface SyncSteppingStatus {
    startStepping(): SyncSteppingStatus;
}

class CurrentlyStepping implements SyncSteppingStatus {
    public startStepping(): SyncSteppingStatus {
        throw new Error('Cannot start stepping again while the program is already stepping');
    }

}

class CurrentlyIdle implements SyncSteppingStatus {
    public startStepping(): SyncSteppingStatus {
        return new CurrentlyStepping();
    }
}

@injectable()
export class SyncStepping {
    private _status: SyncSteppingStatus = new CurrentlyIdle();

    public stepOver = this.createSteppingMethod(() => this._debugeeStepping.stepOver());
    public stepInto = this.createSteppingMethod(() => this._debugeeStepping.stepInto({ breakOnAsyncCall: true }));
    public stepOut = this.createSteppingMethod(() => this._debugeeStepping.stepOut());

    constructor(
        @inject(TYPES.IDebugeeSteppingController) private readonly _debugeeStepping: IDebugeeSteppingController,
        @inject(TYPES.IDebuggeePausedHandler) private readonly _debuggeePausedHandler: IDebuggeePausedHandler,
        @inject(TYPES.IDebugeeExecutionControl) private readonly _debugeeExecutionControl: IDebugeeExecutionController) {
        this._debuggeePausedHandler.registerActionProvider(paused => this.onProvideActionForWhenPaused(paused));
    }

    public continue(): Promise<void> {
        return this._debugeeExecutionControl.resume();
    }

    public pause(): Promise<void> {
        return this._debugeeExecutionControl.pause();
    }

    private async onProvideActionForWhenPaused(_paused: PausedEvent): Promise<IActionToTakeWhenPaused> {
        return new NoActionIsNeededForThisPause(this);
    }

    public async restartFrame(callFrame: ScriptCallFrame): Promise<void> {
        this._status = this._status.startStepping();
        await this._debugeeStepping.restartFrame(callFrame);
        await this._debugeeStepping.stepInto({ breakOnAsyncCall: true });
    }

    private createSteppingMethod(steppingAction: SteppingAction): (() => Promise<void>) {
        return async () => {
            this._status = this._status.startStepping();
            await steppingAction();
            this._status = new CurrentlyIdle();
        };
    }
}