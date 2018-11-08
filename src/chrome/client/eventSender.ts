import { ILoadedSource } from '../internal/sources/loadedSource';
import { ISession } from './session';
import { LoadedSourceEvent, OutputEvent, BreakpointEvent } from 'vscode-debugadapter';
import { InternalToClient } from './internalToClient';
import { DebugProtocol } from 'vscode-debugprotocol';
import { LocationInLoadedSource } from '../internal/locations/location';
import { ICommunicator } from '../communication/communicator';
import { Client } from '../communication/clientChannels';
import { IBPRecipieStatus } from '../internal/breakpoints/bpRecipieStatus';
import { IFormattedExceptionLineDescription } from '../internal/formattedExceptionParser';
import { StoppedEvent2, ReasonType } from '../stoppedEvent';
import { Crdp, ChromeDebugLogic } from '../..';

export interface OutputParameters {
    readonly output: NonNullable<string>;
    readonly category: NonNullable<string>;
    readonly variablesReference?: number;
    readonly location?: LocationInLoadedSource;
}

export interface SourceWasLoadedParameters {
    readonly reason: 'new' | 'changed' | 'removed';
    readonly source: ILoadedSource;
}

export interface BPStatusChangedParameters {
    readonly reason: string;
    readonly bpRecipieStatus: IBPRecipieStatus;
}

export interface ExceptionThrownParameters {
    readonly exceptionStackTrace: IFormattedExceptionLineDescription[];
    readonly category: string;
    readonly location?: LocationInLoadedSource;
}

export interface DebugeeIsStoppedParameters {
    reason: ReasonType;
    exception?: Crdp.Runtime.RemoteObject;
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
        const clientSource = await this._internalToClient.toSource(params.source);
        const event = new LoadedSourceEvent(params.reason, clientSource);

        this._session.sendEvent(event);
    }

    public async sendBPStatusChanged(params: BPStatusChangedParameters): Promise<void> {
        const breakpointStatus = await this._internalToClient.toBPRecipieStatus(params.bpRecipieStatus);
        const event = new BreakpointEvent(params.reason, breakpointStatus);

        this._session.sendEvent(event);
    }

    public async sendExceptionThrown(params: ExceptionThrownParameters): Promise<void> {
        return this.sendOutput({
            output: this._internalToClient.toExceptionStackTracePrintted(params.exceptionStackTrace),
            category: params.category,
            location: params.location
        });
    }

    public async sendDebugeeIsStopped(params: DebugeeIsStoppedParameters): Promise<void> {
        return this._session.sendEvent(new StoppedEvent2(params.reason, /*threadId=*/ChromeDebugLogic.THREAD_ID, params.exception));
    }

    public static createWithHandlers(communicator: ICommunicator, session: ISession, internalToClient: InternalToClient): EventSender {
        const eventSender = new EventSender(session, internalToClient);
        communicator.registerHandler(Client.EventSender.SendOutput, (params: OutputParameters) => eventSender.sendOutput(params));
        communicator.registerHandler(Client.EventSender.SendSourceWasLoaded, (params: SourceWasLoadedParameters) => eventSender.sendSourceWasLoaded(params));
        communicator.registerHandler(Client.EventSender.SendBPStatusChanged, params => eventSender.sendBPStatusChanged(params));
        communicator.registerHandler(Client.EventSender.SendDebugeeIsStopped, params => eventSender.sendDebugeeIsStopped(params));
        return eventSender;
    }

    constructor(private readonly _session: ISession, private readonly _internalToClient: InternalToClient) { }
}
