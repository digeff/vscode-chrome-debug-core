/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { ITelemetryPropertyCollector } from '../../telemetry';
import { ILaunchRequestArgs } from '../../debugAdapterInterfaces';
import { injectable } from 'inversify';

export interface ILaunchResult {
    address?: string;
    port?: number;
    url?: string;
}

export enum TerminatingReasonID {
    DisconnectedFromWebsocket,
    ClientRequestedToDisconnect
}

export class TerminatingReason {
    public constructor(public readonly id: TerminatingReasonID) {}
}

export interface IDebuggeeLauncher {
    launch(args: ILaunchRequestArgs, telemetryPropertyCollector: ITelemetryPropertyCollector): Promise<ILaunchResult>;
    stop(reasonToStop: TerminatingReasonID): Promise<void>;
}

export interface IDebuggeeInitializer {
    initialize(): Promise<void>;
}

@injectable()
export class NoDebuggeeInitializer implements IDebuggeeInitializer {
    public async initialize(): Promise<void> {}
}

export interface IDebuggeeRunner {
    run(telemetryPropertyCollector: ITelemetryPropertyCollector): Promise<void>;
    waitUntilRunning(): Promise<void>;
    stop(): Promise<void>;
}