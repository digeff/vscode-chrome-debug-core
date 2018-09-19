import { RequestChannelIdentifier } from './requestsCommunicator';
import { BPRecipiesInUnbindedSource } from '../internal/breakpoints/bpRecipies';
import { IBPRecipieStatus } from '../internal/breakpoints/bpRecipieStatus';
import { NotificationChannelIdentifier } from './notificationsCommunicator';
import { BPRecipie, BPRecipieInLoadedSource } from '../internal/breakpoints/bpRecipie';
import { ScriptOrSourceOrIdentifierOrUrlRegexp } from '../internal/locations/locationInResource';
import { ConditionalBreak, AlwaysBreak } from '../internal/breakpoints/bpBehavior';
import { IBreakpoint } from '../internal/breakpoints/breakpoint';
import { registerChannels } from './channel';
import { PausedEvent } from '../target/events';

const _breakpoints = {
    // Notifications
    OnUnbounBPRecipieIsNowBound: new NotificationChannelIdentifier<BPRecipie<ScriptOrSourceOrIdentifierOrUrlRegexp>>(),
    OnPausedOnBreakpoint: new NotificationChannelIdentifier<PausedEvent>(),

    // Requests
    UpdateBreakpointsForFile: new RequestChannelIdentifier<BPRecipiesInUnbindedSource, Promise<IBPRecipieStatus[]>>(),
    AddBreakpointForLoadedSource: new RequestChannelIdentifier<BPRecipieInLoadedSource<ConditionalBreak | AlwaysBreak>, Promise<IBreakpoint<ScriptOrSourceOrIdentifierOrUrlRegexp>[]>>(),
};

const Breakpoints: Readonly<typeof _breakpoints> = _breakpoints;

const _Internal = {
    Breakpoints
};

export const Internal: Readonly<typeof _Internal> = _Internal;

registerChannels(Internal, 'Internal');
