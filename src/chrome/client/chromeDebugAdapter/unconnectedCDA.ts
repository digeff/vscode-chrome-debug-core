/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { InitializedEvent, Logger } from 'vscode-debugadapter';
import { IClientCapabilities, IDebugAdapterState, ILaunchRequestArgs, ITelemetryPropertyCollector, IAttachRequestArgs } from '../../../debugAdapterInterfaces';
import * as errors from '../../../errors';
import * as utils from '../../../utils';
import { EagerSourceMapTransformer } from '../../../transformers/eagerSourceMapTransformer';
import { FallbackToClientPathTransformer } from '../../../transformers/fallbackToClientPathTransformer';
import { RemotePathTransformer } from '../../../transformers/remotePathTransformer';
import { ChromeConnection } from '../../chromeConnection';
import { Communicator, LoggingCommunicator } from '../../communication/communicator';
import { DependencyInjection } from '../../dependencyInjection.ts/di';
import { TYPES } from '../../dependencyInjection.ts/types';
import { IExtensibilityPoints } from '../../extensibility/extensibilityPoints';
import { Logging, ILoggingConfiguration } from '../../internal/services/logging';
import { ExecutionLogger } from '../../logging/executionLogger';
import { DelayMessagesUntilInitializedSession } from '../delayMessagesUntilInitializedSession';
import { DoNotPauseWhileSteppingSession } from '../doNotPauseWhileSteppingSession';
import { ConnectedCDAConfiguration } from './cdaConfiguration';
import { ConnectedCDA } from './connectedCDA';
import { ConnectedCDAEventsCreator } from './connectedCDAEvents';
import { BaseUnconnectedCDA } from './unconnectedCDACommonLogic';
import { IDebuggeeLauncher } from '../../debugeeStartup/debugeeLauncher';
import { IDomainsEnabler } from '../../cdtpDebuggee/infrastructure/cdtpDomainsEnabler';
import { MethodsCalledLoggerConfiguration, ReplacementInstruction } from '../../logging/methodsCalledLogger';
import Uri from 'vscode-uri';
import * as path from 'path';
import { ChromeDebugLogic } from '../../chromeDebugAdapter';
import { LineColTransformer } from '../../../transformers/lineNumberTransformer';
import { ChromeDebugSession } from '../../chromeDebugSession';
import { BasePathTransformer } from '../../../transformers/basePathTransformer';
import { BaseSourceMapTransformer } from '../../../transformers/baseSourceMapTransformer';

export enum ScenarioType {
    Launch,
    Attach
}

export class UnconnectedCDA extends BaseUnconnectedCDA implements IDebugAdapterState {
    private readonly _session = new DelayMessagesUntilInitializedSession(new DoNotPauseWhileSteppingSession(this._basicSession));

    private configuration: ConnectedCDAConfiguration;

    public chromeDebugAdapter(): ChromeDebugLogic {
        throw new Error('The chrome debug adapter can only be used when the debug adapter is connected');
    }

    public async launch(args: ILaunchRequestArgs, telemetryPropertyCollector?: ITelemetryPropertyCollector, _requestSeq?: number): Promise<IDebugAdapterState> {
        return this.createConnection(ScenarioType.Launch, args, telemetryPropertyCollector);
    }

    public async attach(args: IAttachRequestArgs, telemetryPropertyCollector?: ITelemetryPropertyCollector, _requestSeq?: number): Promise<IDebugAdapterState> {
        const updatedArgs = Object.assign({}, { port: 9229 }, args);
        return this.createConnection(ScenarioType.Attach, updatedArgs, telemetryPropertyCollector);
    }

    private parseLoggingConfiguration(args: ILaunchRequestArgs | IAttachRequestArgs): ILoggingConfiguration {
        const traceMapping: { [key: string]: Logger.LogLevel | undefined } = { true: Logger.LogLevel.Warn, verbose: Logger.LogLevel.Verbose };
        const traceValue = args.trace && traceMapping[args.trace.toString().toLowerCase()];
        return { logLevel: traceValue, logFilePath: args.logFilePath, shouldLogTimestamps: args.logTimestamps };
    }

    private async createConnection(scenarioType: ScenarioType, args: ILaunchRequestArgs | IAttachRequestArgs, telemetryPropertyCollector?: ITelemetryPropertyCollector): Promise<IDebugAdapterState> {
        if (this._clientCapabilities.pathFormat !== 'path') {
            throw errors.pathFormat();
        }

        utils.setCaseSensitivePaths(this._clientCapabilities.clientID !== 'visualstudio'); // TODO DIEGO: Find a way to remove this
        const di = new DependencyInjection(this._extensibilityPoints.componentCustomizationCallback);

        const pathTransformerClass = this._clientCapabilities.supportsMapURLToFilePathRequest
            ? FallbackToClientPathTransformer
            : this._extensibilityPoints.pathTransformer || RemotePathTransformer;
        const sourceMapTransformerClass = this._extensibilityPoints.sourceMapTransformer || EagerSourceMapTransformer;
        const lineColTransformerClass = this._extensibilityPoints.lineColTransformer || LineColTransformer;
        const logging = new Logging().install(this._extensibilityPoints, this.parseLoggingConfiguration(args));

        const chromeConnection = new (this._chromeConnectionClass)(undefined, args.targetFilter || this._extensibilityPoints.targetFilter);
        const communicator = new LoggingCommunicator(new Communicator(), new ExecutionLogger(logging));

        const diContainer = this.getDIContainer(di, lineColTransformerClass, communicator, chromeConnection, pathTransformerClass, sourceMapTransformerClass, args, scenarioType);

        const debugeeLauncher = diContainer.createComponent<IDebuggeeLauncher>(TYPES.IDebuggeeLauncher);

        diContainer.unconfigure(TYPES.IDebuggeeLauncher); // TODO DIEGO: Remove this line and do this properly
        diContainer.configureValue(TYPES.IDebuggeeLauncher, debugeeLauncher); // TODO DIEGO: Remove this line and do this properly

        const result = await debugeeLauncher.launch(args, telemetryPropertyCollector);
        await chromeConnection.attach(result.address, result.port, result.url, args.timeout, args.extraCRDPChannelPort);

        if (chromeConnection.api === undefined) {
            throw new Error('Expected the Chrome API object to be properly initialized by now');
        }

        diContainer.configureValue(TYPES.CDTPClient, chromeConnection.api);

        const newState = di.createClassWithDI<ConnectedCDA>(ConnectedCDA);
        await newState.install();

        const domainsEnabler = di.createComponent<IDomainsEnabler>(TYPES.IDomainsEnabler);
        await domainsEnabler.enableDomains(); // Enables all the domains that were registered
        await chromeConnection.api.Runtime.runIfWaitingForDebugger();

        this._session.sendEvent(new InitializedEvent());

        return newState;
    }

    constructor(
        private readonly _extensibilityPoints: IExtensibilityPoints,
        private readonly _basicSession: ChromeDebugSession,
        private readonly _clientCapabilities: IClientCapabilities,
        private readonly _chromeConnectionClass: typeof ChromeConnection
    ) {
        super();
    }

    private getDIContainer(di: DependencyInjection, lineColTransformerClass: typeof LineColTransformer, communicator: LoggingCommunicator, chromeConnection: ChromeConnection, pathTransformerClass: (new (configuration: ConnectedCDAConfiguration) => BasePathTransformer), sourceMapTransformerClass: new (configuration: ConnectedCDAConfiguration) => BaseSourceMapTransformer, args: ILaunchRequestArgs | IAttachRequestArgs, scenarioType: ScenarioType): DependencyInjection {
        const configuration = this.createConfiguration(args, scenarioType);
        const workspace = args.pathMapping['/'];
        const workspaceRegexp = utils.pathToRegex(workspace);
        const replacements = [
            new ReplacementInstruction(new RegExp(workspaceRegexp, 'gi'), '%ws%'),
        ];
        const chromeUrl = (<any>args).url;
        if (chromeUrl) {
            replacements.push(new ReplacementInstruction(new RegExp((<any>args).url, 'gi'), '%url%'));
            const uri = Uri.parse(chromeUrl);
            const websitePath = path.dirname(uri.path);
            const websiteNoSeparator = websitePath[websitePath.length] === '/' ? websitePath.substr(0, -1) : websitePath;
            const website = uri.with({ path: websiteNoSeparator, query: '' }).toString();
            replacements.push(new ReplacementInstruction(new RegExp(website, 'gi'), '%website%'));
        }
        const loggingConfiguration = new MethodsCalledLoggerConfiguration(replacements);
        return di
            .bindAll(loggingConfiguration)
            .configureClass(LineColTransformer, lineColTransformerClass)
            .configureClass(TYPES.IDebugeeRunner, this._extensibilityPoints.debugeeRunner)
            .configureClass(TYPES.IDebuggeeLauncher, this._extensibilityPoints.debugeeLauncher)
            // .configureClass(TYPES.IDebugeeLauncher, debugeeLauncher)
            .configureValue(TYPES.communicator, communicator)
            .configureValue(TYPES.EventsConsumedByConnectedCDA, new ConnectedCDAEventsCreator(communicator).create())
            .configureValue(TYPES.ISession, this._session)
            .configureValue(TYPES.BasePathTransformer, new pathTransformerClass(configuration))
            .configureValue(TYPES.BaseSourceMapTransformer, new sourceMapTransformerClass(configuration))
            .configureValue(TYPES.ChromeConnection, chromeConnection)
            .configureValue(TYPES.ConnectedCDAConfiguration, configuration);
    }

    private createConfiguration(args: ILaunchRequestArgs | IAttachRequestArgs, scenarioType: ScenarioType): ConnectedCDAConfiguration {
        if (this.configuration === undefined) {
            this.configuration = new ConnectedCDAConfiguration(this._extensibilityPoints, this.parseLoggingConfiguration(args), this._session, this._clientCapabilities, this._chromeConnectionClass, scenarioType, args);
        }
        return this.configuration;
    }
}