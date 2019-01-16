/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

 import { IEventsConsumedByStackTrace } from '../../internal/stackTraces/stackTracesLogic';
import { IEventsConsumedBySkipFilesLogic } from '../../internal/features/skipFiles';
import { EventsConsumedByBreakpointsLogic } from '../../internal/breakpoints/features/breakpointsLogic';
import { ICommunicator } from '../../communication/communicator';
import { Internal } from '../../communication/internalChannels';
import { Target } from '../../communication/targetChannels';
import { ILoadedSource } from '../../internal/sources/loadedSource';
import { asyncMap } from '../../collections/async';
import { IEventsConsumedByPauseOnException } from '../../internal/exceptions/pauseOnException';
import { IEventsConsumedByTakeProperActionOnPausedEvent } from '../../internal/features/takeProperActionOnPausedEvent';
import { IEventsConsumedBySourceResolver } from '../../internal/sources/sourceResolver';
import { IEventsConsumedBySmartStepLogic } from '../../internal/features/smartStep';
import { IEventsConsumedByAsyncStepping } from '../../internal/stepping/features/asyncStepping';
// import { EventsConsumedBySyncStepping } from '../../internal/stepping/features/syncStepping';

export interface IEventsConsumedByConnectedCDA extends IEventsConsumedByPauseOnException,
    IEventsConsumedByStackTrace, IEventsConsumedByTakeProperActionOnPausedEvent, IEventsConsumedBySkipFilesLogic,
    IEventsConsumedBySourceResolver, IEventsConsumedBySmartStepLogic,
    IEventsConsumedByAsyncStepping { }

export class ConnectedCDAEventsCreator {
    constructor(private readonly communicator: ICommunicator) { }

    public create(): IEventsConsumedByConnectedCDA {
        return {
            onResumed: this.communicator.getSubscriber(Target.Debugger.OnResumed),
            // onPaused: this.communicator.getSubscriber(Target.Debugger.OnPaused),
            onScriptParsed: this.communicator.getSubscriber(Target.Debugger.OnScriptParsed),

            subscriberForAskForInformationAboutPaused: this.communicator.getSubscriber(Internal.Breakpoints.OnPausedOnBreakpoint),
            askForInformationAboutPause: this.communicator.getPublisher(Internal.Breakpoints.OnPausedOnBreakpoint),
            publishGoingToPauseClient: this.communicator.getPublisher(Internal.Breakpoints.OnGoingToPauseClient)
        };
    }
}
