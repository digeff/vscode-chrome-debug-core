/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { NotificationChannelIdentifier } from '../../../communication/notificationsCommunicator';
import { registerChannels } from '../../../communication/channel';
import { BPRecipeInSource } from '../bpRecipeInSource';
import { CDTPBPRecipe } from '../../../cdtpDebuggee/cdtpPrimitives';

const _breakpointsEvents = {
    OnClientBPRecipeAdded: new NotificationChannelIdentifier<BPRecipeInSource>(),
    OnClientBPRecipeRemoved: new NotificationChannelIdentifier<BPRecipeInSource>(),
    OnDebuggeeBPRecipeAdded: new NotificationChannelIdentifier<CDTPBPRecipe>(),
    OnDebuggeeBPRecipeRemoved: new NotificationChannelIdentifier<CDTPBPRecipe>(),
    OnBPRecipeIsBoundForRuntimeSource: new NotificationChannelIdentifier<BPRecipeInSource>(),
    OnBPRecipeIsUnboundForRuntimeSource: new NotificationChannelIdentifier<BPRecipeInSource>(),
};

export const BreakpointsEvents: Readonly<typeof _breakpointsEvents> = _breakpointsEvents;
registerChannels(BreakpointsEvents, 'BreakpointsEvents');
