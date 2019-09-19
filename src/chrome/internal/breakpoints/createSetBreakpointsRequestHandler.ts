import { Protocol as CDTP } from 'devtools-protocol';
import { SetBreakpointsRequestHandler } from './features/setBreakpointsRequestHandler';
import { DependencyInjection, ComponentCustomizationCallback } from '../../dependencyInjection.ts/di';
import { Logging, ILoggingConfiguration } from '../services/logging';
import { LogLevel } from 'vscode-debugadapter/lib/logger';
import { telemetry, ITelemetryPropertyCollector } from '../../../telemetry';
import { TYPES } from '../../dependencyInjection.ts/types';
import { IConnectedCDAConfiguration } from '../../client/chromeDebugAdapter/cdaConfiguration';
import { ILaunchResult, IDebuggeeLauncher, IDebuggeeRunner, TerminatingReasonID } from '../../../chrome/debugeeStartup/debugeeLauncher';
import { ILaunchRequestArgs, IAttachRequestArgs, IInitializeRequestArgs } from '../../../debugAdapterInterfaces';
import { OnlyProvideCustomLauncherExtensibilityPoints, IExtensibilityPoints } from '../../extensibility/extensibilityPoints';
import { ISession } from '../../client/session';
import { ScenarioType } from '../../client/chromeDebugAdapter/unconnectedCDA';

class DummyDebuggeeLauncher implements IDebuggeeLauncher {
    stop(_reasonToStop: TerminatingReasonID): Promise<void> {
        throw new Error('Method not implemented.');
    }

    launch(_args: ILaunchRequestArgs, _telemetryPropertyCollector: ITelemetryPropertyCollector): Promise<ILaunchResult> {
        throw new Error('Method not implemented.');
    }
}

class DummyDebuggeeRunner implements IDebuggeeRunner {
    run(_telemetryPropertyCollector: ITelemetryPropertyCollector): Promise<void> {
        throw new Error('Method not implemented.');
    }

    waitUntilRunning(): Promise<void> {
        throw new Error('Method not implemented.');
    }

    stop(): Promise<void> {
        throw new Error('Method not implemented.');
    }

}

export class BreakpointsConfiguration implements IConnectedCDAConfiguration {
    public get args(): ILaunchRequestArgs | IAttachRequestArgs {
        return { enableSourceMapCaching: true };
    }

    public get isVSClient(): boolean {
        throw new Error('Not yet implemented');
    }

    public get extensibilityPoints(): IExtensibilityPoints {
        return new OnlyProvideCustomLauncherExtensibilityPoints('%temp%\\mylog.txt', DummyDebuggeeLauncher, DummyDebuggeeRunner, (_id, c) => c, undefined);
    }

    public get loggingConfiguration(): ILoggingConfiguration {
        throw new Error('Not yet implemented');
    }

    public get session(): ISession {
        throw new Error('Not yet implemented');
    }

    public get clientCapabilities(): IInitializeRequestArgs {
        return { linesStartAt1: true, columnsStartAt1: true, adapterID: 'some_id' };
    }

    public get scenarioType(): ScenarioType {
        throw new Error('Not yet implemented');
    }

    public get userRequestedUrl(): string | null {
        throw new Error('Not yet implemented');
    }
}

export function createSetBreakpointsRequestHandler(protocolApi: CDTP.ProtocolApi, session: ISession): SetBreakpointsRequestHandler {
    const componentCustomizationCallback: ComponentCustomizationCallback = (_identifier, component) => component;
    const diContainer = new DependencyInjection('ChromeDebugAdapter', componentCustomizationCallback);
    diContainer.configureValue<CDTP.ProtocolApi>(TYPES.CDTPClient, protocolApi);
    diContainer.configureValue<IConnectedCDAConfiguration>(TYPES.ConnectedCDAConfiguration, new BreakpointsConfiguration());

    const logging = new Logging().install(undefined, { logLevel: LogLevel.Log, shouldLogTimestamps: true });
    diContainer.configureValue<Logging>(TYPES.ILogger, logging);
    diContainer.configureValue<ISession>(TYPES.ISession, session);
    diContainer.configureValue(TYPES.ITelemetryReporter, telemetry);
    diContainer.bindAll();
    const result = diContainer.createComponent(SetBreakpointsRequestHandler);
    return result;
}
