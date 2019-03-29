/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { inject, injectable } from 'inversify';
import { TYPES } from '../../dependencyInjection.ts/types';
import { BaseCDAState } from './baseCDAState';
import { IDebuggeeLauncher } from '../../debugeeStartup/debugeeLauncher';
import { ChromeConnection } from '../../chromeConnection';
import { ConnectedCDA, ConnectedCDAProvider } from './connectedCDA';
import { ConnectedCDAConfiguration } from './cdaConfiguration';
import { ITelemetryPropertyCollector } from '../../../telemetry';

export type ConnectingCDAProvider = (configuration: ConnectedCDAConfiguration) => ConnectingCDA;

@injectable()
export class ConnectingCDA extends BaseCDAState {
    constructor(
        @inject(TYPES.IDebuggeeLauncher) private readonly _debuggeeLauncher: IDebuggeeLauncher,
        @inject(TYPES.ConnectedCDAProvider) private readonly _connectedCDAProvider: ConnectedCDAProvider,
        @inject(TYPES.ChromeConnection) private readonly _chromeConnection: ChromeConnection,
        @inject(TYPES.ConnectedCDAConfiguration) private readonly _configuration: ConnectedCDAConfiguration,
    ) {
        super([], {});
    }

    public async connect(telemetryPropertyCollector: ITelemetryPropertyCollector): Promise<ConnectedCDA> {
        const result = await this._debuggeeLauncher.launch(this._configuration.args, telemetryPropertyCollector);
        await this._chromeConnection.attach(result.address, result.port, result.url, this._configuration.args.timeout, this._configuration.args.extraCRDPChannelPort);
        if (this._chromeConnection.api === undefined) {
            throw new Error('Expected the Chrome API object to be properly initialized by now');
        }

        const newState = this._connectedCDAProvider(this._chromeConnection.api);
        await newState.install();
        return newState;
    }
}