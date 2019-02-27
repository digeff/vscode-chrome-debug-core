/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { NotificationChannelIdentifier } from './notificationsCommunicator';
import { BPRecipe } from '../internal/breakpoints/bpRecipe';
import { ScriptOrSourceOrURLOrURLRegexp } from '../internal/locations/location';
import { registerChannels } from './channel';
import { IVote } from './collaborativeDecision';
import { PausedEvent } from '../cdtpDebuggee/eventsProviders/cdtpDebuggeeExecutionEventsProvider';

const _breakpoints = {
    // Notifications
    OnUnbounBPRecipeIsNowBound: new NotificationChannelIdentifier<BPRecipe<ScriptOrSourceOrURLOrURLRegexp>>(),
    OnPausedOnBreakpoint: new NotificationChannelIdentifier<PausedEvent, IVote<void>>(),
    OnNoPendingBreakpoints: new NotificationChannelIdentifier<void>(),
    OnGoingToPauseClient: new NotificationChannelIdentifier<void, void>(),
};

const Breakpoints: Readonly<typeof _breakpoints> = _breakpoints;

const _Internal = {
    Breakpoints,
};

export const Internal: Readonly<typeof _Internal> = _Internal;

registerChannels(Internal, 'Internal');
