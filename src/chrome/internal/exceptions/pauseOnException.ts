/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { BaseNotifyClientOfPause, ActionToTakeWhenPausedProvider, IActionToTakeWhenPaused, NoActionIsNeededForThisPause } from '../features/actionToTakeWhenPaused';
import { IComponentWithAsyncInitialization } from '../features/components';
import * as errors from '../../../errors';
import { FormattedExceptionParser, IFormattedExceptionLineDescription } from '../formattedExceptionParser';
import { IPauseOnPromiseRejectionsStrategy, IPauseOnExceptionsStrategy } from './strategies';
import { injectable, inject } from 'inversify';
import { TYPES } from '../../dependencyInjection.ts/types';
import { IEventsToClientReporter } from '../../client/eventSender';
import { DeleteMeScriptsRegistry } from '../scripts/scriptsRegistry';
import { PausedEvent } from '../../cdtpDebuggee/eventsProviders/cdtpDebuggeeExecutionEventsProvider';
import { IPauseOnExceptionsConfigurer } from '../../cdtpDebuggee/features/cdtpPauseOnExceptionsConfigurer';
import * as utils from '../../../utils';
import { IDebugeeSteppingController } from '../../cdtpDebuggee/features/cdtpDebugeeSteppingController';
import { IDebuggeePausedHandler } from '../features/takeProperActionWhenPaused';

type ExceptionBreakMode = 'never' | 'always' | 'unhandled' | 'userUnhandled';

export interface IExceptionInformationDetails {
    readonly stackTrace: IFormattedExceptionLineDescription[];
    readonly message: string;
    readonly formattedDescription: string;
    readonly typeName: string;
}

export interface IExceptionInformation {
    readonly exceptionId: string;
    readonly description?: string;
    readonly breakMode: ExceptionBreakMode;
    readonly details?: IExceptionInformationDetails;
}

export class ExceptionWasThrown extends BaseNotifyClientOfPause {
    public readonly reason = 'exception'; // There is an issue of how the .d.ts is generated for this file, so we need to type that explicitly

    constructor(protected readonly _eventsToClientReporter: IEventsToClientReporter) {
        super();
    }
}

export class PromiseWasRejected extends BaseNotifyClientOfPause {
    public readonly reason: 'promise_rejection' = 'promise_rejection'; // There is an issue of how the .d.ts is generated for this file, so we need to type that explicitly

    constructor(protected readonly _eventsToClientReporter: IEventsToClientReporter) {
        super();
    }
}

@injectable()
export class PauseOnExceptionOrRejection {
    private _promiseRejectionsStrategy: IPauseOnPromiseRejectionsStrategy;

    private _lastException: any;

    constructor(
        @inject(TYPES.IDebuggeePausedHandler) private readonly _debuggeePausedHandler: IDebuggeePausedHandler,
        @inject(TYPES.DeleteMeScriptsRegistry) private readonly _scriptsLogic: DeleteMeScriptsRegistry,
        @inject(TYPES.IPauseOnExceptions) private readonly _pauseOnExceptions: IPauseOnExceptionsConfigurer,
        @inject(TYPES.IEventsToClientReporter) private readonly _eventsToClientReporter: IEventsToClientReporter) {
        this._debuggeePausedHandler.registerActionProvider(paused => this.onProvideActionForWhenPaused(paused));
    }

    public setExceptionsStrategy(strategy: IPauseOnExceptionsStrategy): Promise<void> {
        return this._pauseOnExceptions.setPauseOnExceptions(strategy);
    }

    public setPromiseRejectionStrategy(promiseRejectionsStrategy: IPauseOnPromiseRejectionsStrategy): void {
        this._promiseRejectionsStrategy = promiseRejectionsStrategy;
    }

    public async onProvideActionForWhenPaused(paused: PausedEvent): Promise<IActionToTakeWhenPaused> {
        if (paused.reason === 'exception') {
            // If we are here is because we either configured the debugee to pauser on unhandled or handled exceptions
            this._lastException = paused.data;
            return new ExceptionWasThrown(this._eventsToClientReporter);
        } else if (paused.reason === 'promiseRejection' && this._promiseRejectionsStrategy.shouldPauseOnRejections()) {
            // TODO: Figure out if it makes sense to move this into it's own class
            this._lastException = paused.data;
            return new PromiseWasRejected(this._eventsToClientReporter);
        } else {
            this._lastException = null;
            return new NoActionIsNeededForThisPause(this);
        }
    }

    public async latestExceptionInfo(): Promise<IExceptionInformation> {
        if (this._lastException) {
            const isError = this._lastException.subtype === 'error';
            const message = isError ? utils.firstLine(this._lastException.description) : (this._lastException.description || this._lastException.value);
            const formattedMessage = message && message.replace(/\*/g, '\\*');
            const response: IExceptionInformation = {
                exceptionId: this._lastException.className || this._lastException.type || 'Error',
                breakMode: 'unhandled',
                details: {
                    stackTrace: this._lastException.description && await new FormattedExceptionParser(this._scriptsLogic, this._lastException.description).parse(),
                    message,
                    formattedDescription: formattedMessage, // VS workaround - see https://github.com/Microsoft/client/issues/34259
                    typeName: this._lastException.subtype || this._lastException.type
                }
            };

            return response;
        } else {
            throw errors.noStoredException();
        }
    }
}