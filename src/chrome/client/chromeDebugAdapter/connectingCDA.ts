/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { inject, injectable } from 'inversify';
import { TYPES } from '../../dependencyInjection.ts/types';
import { BaseCDAState } from './baseCDAState';
import { IChromeConnection } from '../../chromeConnection';
import { ConnectedCDA, ConnectedCDAProvider } from './connectedCDA';
import { ConnectedCDAConfiguration } from './cdaConfiguration';
import { ITelemetryPropertyCollector } from '../../../telemetry';
import { ISession } from '../session';
import { StepProgressEventsEmitter, IExecutionTimingsReporter } from '../../../executionTimingsReporter';

export type ConnectingCDAProvider = (configuration: ConnectedCDAConfiguration) => ConnectingCDA;

@injectable()
export class ConnectingCDA extends BaseCDAState {
    private readonly events = new StepProgressEventsEmitter();

    constructor(
        @inject(TYPES.ISession) protected readonly _session: ISession,
        @inject(TYPES.ConnectedCDAProvider) private readonly _connectedCDAProvider: ConnectedCDAProvider,
        @inject(TYPES.ExecutionTimingsReporter) reporter: IExecutionTimingsReporter,
        @inject(TYPES.ChromeConnection) private readonly _chromeConnection: IChromeConnection,
    ) {
        super([], {});
        reporter.subscribeTo(this.events);
    }

    public async connect(telemetryPropertyCollector: ITelemetryPropertyCollector): Promise<ConnectedCDA> {
        await this._chromeConnection.open(telemetryPropertyCollector);
        const newState = this._connectedCDAProvider(this._chromeConnection.api);
        await newState.install();
        return newState;
    }

    public toString(): string {
        return `Connecting to the debuggee`;
    }
}
