/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { ILoadedSource } from '../internal/sources/loadedSource';
import { ISession } from './session';
import { LoadedSourceEvent, OutputEvent, BreakpointEvent } from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';
import { LocationInLoadedSource } from '../internal/locations/location';
import { IBPRecipeStatus } from '../internal/breakpoints/bpRecipeStatus';
import { IFormattedExceptionLineDescription } from '../internal/formattedExceptionParser';
import { StoppedEvent2, ReasonType } from '../stoppedEvent';
import { injectable, inject } from 'inversify';
import { TYPES } from '../dependencyInjection.ts/types';
import { Protocol as CDTP } from 'devtools-protocol';
import { ChromeDebugLogic } from '../chromeDebugAdapter';
import { ExceptionStackTracePrintter } from '../internal/exceptions/exceptionStackTracePrintter';
import { LocationInSourceToClientConverter } from './locationInSourceToClientConverter';
import { HandlesRegistry } from './handlesRegistry';
import { SourcesRetriever } from '../internal/sources/sourcesRetriever';
import { SourceToClientConverter } from './sourceToClientConverter';
import { BPRecipieStatusToClientConverter } from '../internal/breakpoints/features/bpRecipieStatusToClientConverter';
import { ConnectedCDAConfiguration } from './chromeDebugAdapter/cdaConfiguration';
import { LineColTransformer } from '../../transformers/lineNumberTransformer';

export interface IOutputParameters {
    readonly output: string;
    readonly category: string;
    readonly variablesReference?: number;
    readonly location?: LocationInLoadedSource;
}

export interface ISourceWasLoadedParameters {
    readonly reason: 'new' | 'changed' | 'removed';
    readonly source: ILoadedSource;
}

export interface IBPStatusChangedParameters {
    readonly reason: string;
    readonly bpRecipeStatus: IBPRecipeStatus;
}

export interface IExceptionThrownParameters {
    readonly exceptionStackTrace: IFormattedExceptionLineDescription[];
    readonly category: string;
    readonly location?: LocationInLoadedSource;
}

export interface IDebugeeIsStoppedParameters {
    reason: ReasonType;
    exception?: CDTP.Runtime.RemoteObject;
}

export interface IEventsToClientReporter {
    sendOutput(params: IOutputParameters): void;
    sendSourceWasLoaded(params: ISourceWasLoadedParameters): Promise<void>;
    sendBPStatusChanged(params: IBPStatusChangedParameters): Promise<void>;
    sendExceptionThrown(params: IExceptionThrownParameters): Promise<void>;
    sendDebugeeIsStopped(params: IDebugeeIsStoppedParameters): Promise<void>;
}

@injectable()
export class EventSender implements IEventsToClientReporter {
    private readonly _exceptionStackTracePrintter = new ExceptionStackTracePrintter(this._configuration);
    private readonly _locationInSourceToClientConverter = new LocationInSourceToClientConverter(this._handlesRegistry, this._lineColTransformer);
    private readonly _sourceToClientConverter = new SourceToClientConverter(this._handlesRegistry);
    private readonly _bpRecipieStatusToClientConverter = new BPRecipieStatusToClientConverter(this._handlesRegistry, this._lineColTransformer, this._sourcesLogic);

    constructor(
        @inject(TYPES.ConnectedCDAConfiguration) private readonly _configuration: ConnectedCDAConfiguration,
        @inject(TYPES.ISession) private readonly _session: ISession,
        @inject(HandlesRegistry) private readonly _handlesRegistry: HandlesRegistry,
        @inject(TYPES.LineColTransformer) private readonly _lineColTransformer: LineColTransformer,
        private readonly _sourcesLogic: SourcesRetriever) { }

    public sendOutput(params: IOutputParameters): void {
        const event = new OutputEvent(params.output, params.category) as DebugProtocol.OutputEvent;

        if (params.variablesReference) {
            event.body.variablesReference = params.variablesReference;
        }

        if (params.location) {
            this._locationInSourceToClientConverter.toLocationInSource(params.location, event.body);
        }

        this._session.sendEvent(event);
    }

    public async sendSourceWasLoaded(params: ISourceWasLoadedParameters): Promise<void> {
        const clientSource = await this._sourceToClientConverter.toSource(params.source);
        const event = new LoadedSourceEvent(params.reason, clientSource);

        this._session.sendEvent(event);
    }

    public async sendBPStatusChanged(params: IBPStatusChangedParameters): Promise<void> {
        const breakpointStatus = await this._bpRecipieStatusToClientConverter.toBPRecipeStatus(params.bpRecipeStatus);
        const event = new BreakpointEvent(params.reason, breakpointStatus);

        this._session.sendEvent(event);
    }

    public async sendExceptionThrown(params: IExceptionThrownParameters): Promise<void> {
        return this.sendOutput({
            output: this._exceptionStackTracePrintter.toExceptionStackTracePrintted(params.exceptionStackTrace),
            category: params.category,
            location: params.location
        });
    }

    public async sendDebugeeIsStopped(params: IDebugeeIsStoppedParameters): Promise<void> {
        return this._session.sendEvent(new StoppedEvent2(params.reason, /*threadId=*/ChromeDebugLogic.THREAD_ID, params.exception));
    }
}
