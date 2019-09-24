/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { Protocol as CDTP } from 'devtools-protocol';
import { ITargetFilter } from '../chromeConnection';
import { BasePathTransformer } from '../../transformers/basePathTransformer';
import { LineColTransformer } from '../../transformers/lineNumberTransformer';
import { ILaunchRequestArgs, IAttachRequestArgs } from '../../debugAdapterInterfaces';
import { interfaces } from 'inversify';
import { IDebuggeeLauncher, IDebuggeeRunner, IDebuggeeInitializer, NoDebuggeeInitializer } from '../debugeeStartup/debugeeLauncher';
import { IConnectedCDAConfiguration } from '../client/chromeDebugAdapter/cdaConfiguration';
import { ComponentCustomizationCallback, DependencyInjection } from '../dependencyInjection.ts/di';
import { CommandText } from '../client/requests';
import { ScenarioType } from '../client/chromeDebugAdapter/unconnectedCDA';

export type RequestProcessorFunction = (args: unknown) => Promise<unknown>;

export interface IExtensibilityPoints {
    componentCustomizationCallback: ComponentCustomizationCallback;
    isPromiseRejectExceptionFilterEnabled: boolean;
    debuggeeLauncher: interfaces.Newable<IDebuggeeLauncher>;
    debuggeeInitializer: interfaces.Newable<IDebuggeeInitializer>;
    debuggeeRunner: interfaces.Newable<IDebuggeeRunner>;

    targetFilter?: ITargetFilter;
    logFilePath: string;

    pathTransformer?: { new(configuration: IConnectedCDAConfiguration): BasePathTransformer };
    lineColTransformer?: { new(configuration: IConnectedCDAConfiguration): LineColTransformer };

    bindAdditionalComponents(diContainer: DependencyInjection): void;
    customizeProtocolApi(protocolApi: CDTP.ProtocolApi): CDTP.ProtocolApi;
    updateArguments<T extends ILaunchRequestArgs | IAttachRequestArgs>(scenarioType: ScenarioType, argumentsFromClient: T): T;

    processRequest(requestName: CommandText, args: unknown, defaultRequestProcessor: RequestProcessorFunction): Promise<unknown>;
}

export class OnlyProvideCustomLauncherExtensibilityPoints implements IExtensibilityPoints {
    public readonly isPromiseRejectExceptionFilterEnabled = false;

    targetFilter?: ITargetFilter;
    pathTransformer?: new (configuration: IConnectedCDAConfiguration) => BasePathTransformer;
    lineColTransformer?: new (configuration: IConnectedCDAConfiguration) => LineColTransformer;

    constructor(
        public readonly logFilePath: string,
        public readonly debuggeeLauncher: interfaces.Newable<IDebuggeeLauncher>,
        public readonly debuggeeRunner: interfaces.Newable<IDebuggeeRunner>,
        public readonly componentCustomizationCallback: ComponentCustomizationCallback,
        public readonly debuggeeInitializer: interfaces.Newable<IDebuggeeInitializer> = NoDebuggeeInitializer) {
    }

    public customizeProtocolApi(protocolApi: CDTP.ProtocolApi): CDTP.ProtocolApi {
        return protocolApi;
    }

    public bindAdditionalComponents(_diContainer: DependencyInjection): void { }

    public updateArguments<T extends ILaunchRequestArgs | IAttachRequestArgs>(_scenarioType: ScenarioType, argumentsFromClient: T): T {
        return argumentsFromClient;
    }

    public processRequest(_requestName: CommandText, args: unknown, defaultRequestProcessor: RequestProcessorFunction): Promise<unknown> {
        return defaultRequestProcessor(args);
    }
}