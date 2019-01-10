/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { ChromeConnection, ITargetFilter } from '../chromeConnection';
import { BasePathTransformer } from '../../transformers/basePathTransformer';
import { BaseSourceMapTransformer } from '../../transformers/baseSourceMapTransformer';
import { LineColTransformer } from '../../transformers/lineNumberTransformer';
import { ILaunchRequestArgs, IAttachRequestArgs } from '../../debugAdapterInterfaces';
import { interfaces } from 'inversify';
import { IDebuggeeLauncher, IDebuggeeRunner } from '../debugeeStartup/debugeeLauncher';
import { ConnectedCDAConfiguration } from '../client/chromeDebugAdapter/cdaConfiguration';
import { ComponentCustomizationCallback } from '../dependencyInjection.ts/di';

export interface IExtensibilityPoints {
    componentCustomizationCallback: ComponentCustomizationCallback;
    isPromiseRejectExceptionFilterEnabled: boolean;
    debugeeLauncher: interfaces.Newable<IDebuggeeLauncher>;
    debugeeRunner: interfaces.Newable<IDebuggeeRunner>;

    targetFilter?: ITargetFilter;
    logFilePath: string;

    chromeConnection?: typeof ChromeConnection;
    pathTransformer?: { new(configuration: ConnectedCDAConfiguration): BasePathTransformer };
    sourceMapTransformer?: { new(configuration: ConnectedCDAConfiguration): BaseSourceMapTransformer };
    lineColTransformer?: { new(configuration: ConnectedCDAConfiguration): LineColTransformer };

    updateArguments<T extends ILaunchRequestArgs | IAttachRequestArgs>(argumentsFromClient: T): T;
}

export class OnlyProvideCustomLauncherExtensibilityPoints implements IExtensibilityPoints {
    public readonly isPromiseRejectExceptionFilterEnabled = false;

    targetFilter?: ITargetFilter;
    chromeConnection?: typeof ChromeConnection;
    pathTransformer?: new () => BasePathTransformer;
    sourceMapTransformer?: new (configuration: ConnectedCDAConfiguration) => BaseSourceMapTransformer;
    lineColTransformer?: new (configuration: ConnectedCDAConfiguration) => LineColTransformer;

    public updateArguments<T extends ILaunchRequestArgs | IAttachRequestArgs>(argumentsFromClient: T): T {
        return argumentsFromClient;
    }

    constructor(
        public readonly logFilePath: string,
        public readonly debugeeLauncher: interfaces.Newable<IDebuggeeLauncher>,
        public readonly debugeeRunner: interfaces.Newable<IDebuggeeRunner>,
        public readonly componentCustomizationCallback: ComponentCustomizationCallback) {
    }
}