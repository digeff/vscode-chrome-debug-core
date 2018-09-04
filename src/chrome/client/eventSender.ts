import { ILoadedSource } from '../internal/loadedSource';
import { ISession } from './delayMessagesUntilInitializedSession';
import { LoadedSourceEvent, OutputEvent, BreakpointEvent } from 'vscode-debugadapter';
import { InternalToClient } from './internalToClient';
import { DebugProtocol } from 'vscode-debugprotocol';
import { LocationInLoadedSource } from '../internal/locationInResource';
import { Communicator } from '../communication/communicator';
import { Client } from '../communication/clientChannels';
import { IBPRecipieStatus } from '../internal/breakpoints/bpRecipieStatus';

export interface OutputParameters {
    output: NonNullable<string>;
    category: NonNullable<string>;
    variablesReference?: number;
    location?: LocationInLoadedSource;
}

export interface SourceWasLoadedParameters {
    reason: 'new' | 'changed' | 'removed';
    source: ILoadedSource;
}

export interface BPStatusChangedParameters {
    reason: string;
    bpRecipieStatus: IBPRecipieStatus;
}

export class EventSender {
    public sendOutput(params: OutputParameters): void {
        const event = new OutputEvent(params.output, params.category) as DebugProtocol.OutputEvent;
        if (params.variablesReference) {
            event.body.variablesReference = params.variablesReference;
        }
        if (params.location) {
            this._internalToClient.toLocationInSource(params.location, event.body);
        }
        this._session.sendEvent(event);
    }

    public async sendSourceWasLoaded(params: SourceWasLoadedParameters): Promise<void> {
        // TODO DIEGO: Should we be using the source tree instead of the source here?
        const vsCodeSource = await this._internalToClient.toSource(params.source);
        const event = new LoadedSourceEvent(params.reason, vsCodeSource);

        this._session.sendEvent(event);
    }

    public async sendBPStatusChanged(params: BPStatusChangedParameters): Promise<void> {
        const breakpointStatus = await this._internalToClient.toBPRecipieStatus(params.bpRecipieStatus);
        const event = new BreakpointEvent(params.reason, breakpointStatus);

        this._session.sendEvent(event);
    }

    constructor(private readonly _session: ISession, private readonly _internalToClient: InternalToClient) {
    }
}

export function registerEventSenderHandlers(communicator: Communicator, eventSender: EventSender): void {
    communicator.registerHandler(Client.EventSender.SendOutput, (params: OutputParameters) => eventSender.sendOutput(params));
    communicator.registerHandler(Client.EventSender.SendSourceWasLoaded, (params: SourceWasLoadedParameters) => eventSender.sendSourceWasLoaded(params));
}