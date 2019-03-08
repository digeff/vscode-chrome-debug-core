/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { DebugProtocol } from 'vscode-debugprotocol';
import { TerminatedEvent, ContinuedEvent, logger, } from 'vscode-debugadapter';

import {
    ICommonRequestArgs, ILaunchRequestArgs, IScopesResponseBody, IVariablesResponseBody,
    IThreadsResponseBody, IEvaluateResponseBody, ISetVariableResponseBody,
    ICompletionsResponseBody, IRestartRequestArgs, ITimeTravelRuntime
} from '../debugAdapterInterfaces';

import { ChromeConnection } from './chromeConnection';
import * as ChromeUtils from './chromeUtils';
import { Protocol as CDTP } from 'devtools-protocol';
import { PropertyContainer, ScopeContainer, ExceptionContainer, isIndexedPropName, IVariableContainer } from './variables';
import * as variables from './variables';
import { formatConsoleArguments, formatExceptionDetails, clearConsoleCode } from './consoleHelper';
import { ReasonType } from './stoppedEvent';
import { stackTraceWithoutLogpointFrame } from './internalSourceBreakpoint';

import * as errors from '../errors';
import * as utils from '../utils';
import { telemetry, BatchTelemetryReporter } from '../telemetry';
import { StepProgressEventsEmitter } from '../executionTimingsReporter';

import { LineColTransformer } from '../transformers/lineNumberTransformer';
import { BasePathTransformer } from '../transformers/basePathTransformer';
import { BaseSourceMapTransformer } from '../transformers/baseSourceMapTransformer';
import { BreakOnLoadHelper } from './breakOnLoadHelper';
import * as sourceMapUtils from '../sourceMaps/sourceMapUtils';

import * as nls from 'vscode-nls';
import { ISession } from './client/session';
import { IScript } from './internal/scripts/script';

import { LocationInLoadedSource } from './internal/locations/location';
import { IEvaluateArguments, ICompletionsArguments } from './internal/requests';
import { EventSender } from './client/eventSender';
import { LoadedSourceCallFrame } from './internal/stackTraces/callFrame';
import { CodeFlowStackTrace } from './internal/stackTraces/codeFlowStackTrace';
import { IResourceIdentifier, parseResourceIdentifier } from './internal/sources/resourceIdentifier';
import { FormattedExceptionParser } from './internal/formattedExceptionParser';
import { DeleteMeScriptsRegistry } from './internal/scripts/scriptsRegistry';
import { injectable, inject } from 'inversify';
import { TYPES } from './dependencyInjection.ts/types';
import { ICDTPDebuggeeExecutionEventsProvider, PausedEvent } from './cdtpDebuggee/eventsProviders/cdtpDebuggeeExecutionEventsProvider';
import { ILogEntry, CDTPLogEventsProvider } from './cdtpDebuggee/eventsProviders/cdtpLogEventsProvider';
import { IConsoleEventsProvider, IConsoleAPICalledEvent } from './cdtpDebuggee/eventsProviders/cdtpConsoleEventsProvider';
import { IPauseOnExceptionsConfigurer } from './cdtpDebuggee/features/CDTPPauseOnExceptionsConfigurer';
import { CDTPExceptionThrownEventsProvider, IExceptionThrownEvent } from './cdtpDebuggee/eventsProviders/cdtpExceptionThrownEventsProvider';
import { CDTPExecutionContextEventsProvider } from './cdtpDebuggee/eventsProviders/cdtpExecutionContextEventsProvider';
import { IDebugeeStateSetter } from './cdtpDebuggee/features/cdtpDebugeeStateSetter';
import { IEvaluateOnCallFrameRequest, IDebugeeStateInspector } from './cdtpDebuggee/features/cdtpDebugeeStateInspector';
import { ConnectedCDAConfiguration } from './client/chromeDebugAdapter/cdaConfiguration';

// export class ChromeDebugAdapter extends ChromeDebugAdapterClass {
//     /** These methods are called by the ChromeDebugAdapter subclass in chrome-debug. We need to redirect them like this
//      * until we complete the refactor in chrome-debug and we make these methods work in a proper way
//      */
//     protected hookConnectionEvents(): void {
//         return this.chromeDebugAdapter.hookConnectionEvents();
//     }
//     public commonArgs(args: ICommonRequestArgs): void {
//         return this.chromeDebugAdapter.commonArgs(args);
//     }
//     protected onResumed(): void {
//         return this.chromeDebugAdapter.onResumed();
//     }
//     protected terminateSession(reason: string, restart?: IRestartRequestArgs): Promise<void> {
//         return this.chromeDebugAdapter.terminateSession(reason, restart);
//     }
//     protected globalEvaluate(args: CDTP.Runtime.EvaluateRequest): Promise<CDTP.Runtime.EvaluateResponse> {
//         return this.chromeDebugAdapter.globalEvaluate(args);
//     }
//     protected get _launchAttachArgs(): ICommonRequestArgs {
//         return this.chromeDebugAdapter._launchAttachArgs;
//     }
//     protected set _expectingStopReason(value: ReasonType) {
//         this.chromeDebugAdapter._expectingStopReason = value;
//     }
//     protected get _domains(): Map<CrdpDomain, CDTP.Schema.Domain> {
//         return this.chromeDebugAdapter._domains;
//     }
//     protected get _hasTerminated(): boolean {
//         return this.chromeDebugAdapter._hasTerminated;
//     }
//     protected get _session(): ISession {
//         return this.chromeDebugAdapter._session;
//     }

//     /** These methods are called by the NodeDebugAdapter subclass in node-debug2. We need to redirect them like this
//      * until we complete the refactor in node-debug2 and we make these methods work in a proper way
//      */
//     protected get _attachMode(): boolean {
//         return this.chromeDebugAdapter._attachMode;
//     }
//     protected set _promiseRejectExceptionFilterEnabled(value: boolean) {
//         this.chromeDebugAdapter._promiseRejectExceptionFilterEnabled = value;
//     }
//     protected get _pathTransformer(): BasePathTransformer {
//         return this.chromeDebugAdapter._pathTransformer;
//     }
//     protected get _inShutdown(): boolean {
//         return this.chromeDebugAdapter._inShutdown;
//     }
//     protected get _port(): number {
//         return this.chromeDebugAdapter._port;
//     }

//     protected get _sourceMapTransformer(): BaseSourceMapTransformer {
//         return this.chromeDebugAdapter.sourceMapTransformer;
//     }

//     protected static get EVAL_NAME_PREFIX(): string {
//         return ChromeDebugLogic.EVAL_NAME_PREFIX;
//     }

//     protected onConsoleAPICalled(event: ConsoleAPICalledEvent): void {
//         return this.chromeDebugAdapter.onConsoleAPICalled(event);
//     }
//     // DIEGO START
// }

let localize = nls.loadMessageBundle();

interface IPropCount {
    indexedVariables: number;
    namedVariables: number;
}

/**
 * Represents a reference to a source/script. `contents` is set if there are inlined sources.
 * Otherwise, scriptId can be used to retrieve the contents from the runtime.
 */
export interface ISourceContainer {
    /** The runtime-side scriptId of this script */
    scriptId?: IScript;
    /** The contents of this script, if they are inlined in the sourcemap */
    contents?: string;
    /** The authored path to this script (only set if the contents are inlined) */
    mappedPath?: string;
}

export type VariableContext = 'variables' | 'watch' | 'repl' | 'hover';

export type CrdpScript = CDTP.Debugger.ScriptParsedEvent;

export type CrdpDomain = string;

export type LoadedSourceEventReason = 'new' | 'changed' | 'removed';

@injectable()
export class ChromeDebugLogic {
    public static EVAL_NAME_PREFIX = ChromeUtils.EVAL_NAME_PREFIX;
    public static EVAL_ROOT = '<eval>';

    public static THREAD_ID = 1;
    static HITCONDITION_MATCHER: any;

    public _session: ISession;
    public _domains = new Map<CrdpDomain, CDTP.Schema.Domain>();
    private _clientAttached: boolean;
    private _exception: CDTP.Runtime.RemoteObject | undefined;
    private _expectingResumedEvent: boolean;
    public _expectingStopReason: ReasonType | undefined;
    private _waitAfterStep = Promise.resolve();

    private _variableHandles: variables.VariableHandles;

    private _lineColTransformer: LineColTransformer;
    protected _chromeConmer: BaseSourceMapTransformer;
    public _pathTransformer: BasePathTransformer;

    public _hasTerminated: boolean;
    public _inShutdown: boolean;
    public _attachMode: boolean;
    public readonly _launchAttachArgs: ICommonRequestArgs = this._configuration.args;
    public _port: number;

    private _currentStep = Promise.resolve();
    private _currentLogMessage = Promise.resolve();
    privaRejectExceptionFilterEnabled = false;

    private _batchTelemetryReporter: BatchTelemetryReporter;

    public readonly events: StepProgressEventsEmitter;

    protected _breakOnLoadHelper: BreakOnLoadHelper | null;

    private readonly _chromeConnection: ChromeConnection;
    private readonly _sourceMapTransformer: BaseSourceMapTransformer;
    public _promiseRejectExceptionFilterEnabled = false;
    public _pauseOnPromiseRejections = true;

    public constructor(
        @inject(TYPES.LineColTransformer) lineColTransformer: LineColTransformer,
        @inject(TYPES.BaseSourceMapTransformer) sourceMapTransformer: BaseSourceMapTransformer,
        @inject(TYPES.BasePathTransformer) pathTransformer: BasePathTransformer,
        @inject(TYPES.ISession) session: ISession,
        @inject(TYPES.ChromeConnection) chromeConnection: ChromeConnection,
        @inject(TYPES.DeleteMeScriptsRegistry) private readonly _scriptsLogic: DeleteMeScriptsRegistry,
        @inject(TYPES.IEventsToClientReporter) private readonly _eventSender: EventSender,
        @inject(TYPES.ExceptionThrownEventProvider) private readonly _exceptionThrownEventProvider: CDTPExceptionThrownEventsProvider,
        @inject(TYPES.ExecutionContextEventsProvider) private readonly _executionContextEventsProvider: CDTPExecutionContextEventsProvider,
        @inject(TYPES.IInspectDebugeeState) private readonly _inspectDebugeeState: IDebugeeStateInspector,
        @inject(TYPES.IUpdateDebugeeState) private readonly _updateDebugeeState: IDebugeeStateSetter,
        @inject(TYPES.ConnectedCDAConfiguration) private readonly _configuration: ConnectedCDAConfiguration,
        @inject(TYPES.ICDTPDebuggeeExecutionEventsProvider) private readonly _debuggerEvents: ICDTPDebuggeeExecutionEventsProvider,
        @inject(TYPES.IConsoleEventsProvider) private readonly _consoleEventsProvider: IConsoleEventsProvider,
        @inject(TYPES.ILogEventsProvider) private readonly _logEventsProvider: CDTPLogEventsProvider,
        @inject(TYPES.IPauseOnExceptions) private readonly _pauseOnExceptions: IPauseOnExceptionsConfigurer,
    ) {
        telemetry.setupEventHandler(e => session.sendEvent(e));
        this._batchTelemetryReporter = new BatchTelemetryReporter(telemetry);
        this._session = session;
        this._chromeConnection = chromeConnection;
        this.events = new StepProgressEventsEmitter(this._chromeConnection.events ? [this._chromeConnection.events] : []);

        this._variableHandles = new variables.VariableHandles();

        this._lineColTransformer = lineColTransformer;
        this._sourceMapTransformer = sourceMapTransformer;
        this._pathTransformer = pathTransformer;

        this.clearTargetContext();
    }

    public get pathTransformer(): BasePathTransformer {
        return this._pathTransformer;
    }

    public get sourceMapTransformer(): BaseSourceMapTransformer {
        return this._sourceMapTransformer;
    }

    /**
     * Called on 'clearEverything' or on a navigation/refresh
     */
    protected clearTargetContext(): void {
        this._sourceMapTransformer.clearTargetContext();
        this._pathTransformer.clearTargetContext();
    }

    /* __GDPR__
        "ClientRequest/configurationDone" : {
            "${include}": [
                "${IExecutionResultTelemetryProperties}",
                "${DebugCommonProperties}"
            ]
        }
    */
    public configurationDone(): Promise<void> {
        return Promise.resolve();
    }

    public get breakOnLoadActive(): boolean {
        return !!this._breakOnLoadHelper;
    }

    public shutdown(): void {
        this._batchTelemetryReporter.finalize();
        this._inShutdown = true;
        this._session.shutdown();
    }

    public async terminateSession(reason: string, restart?: IRestartRequestArgs): Promise<void> {
        logger.log(`Terminated: ${reason}`);

        if (!this._hasTerminated) {
            logger.log(`Waiting for any pending steps or log messages.`);
            await this._currentStep;
            await this._currentLogMessage;
            logger.log(`Current step and log messages complete`);

            /* __GDPR__
               "debugStopped" : {
                  "reason" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
                  "${include}": [ "${DebugCommonProperties}" ]
               }
             */
            telemetry.reportEvent('debugStopped', { reason });
            this._hasTerminated = true;
            if (this._clientAttached || (this._launchAttachArgs && (<ILaunchRequestArgs>this._launchAttachArgs).noDebug)) {
                this._session.sendEvent(new TerminatedEvent(restart));
            }

            if (this._chromeConnection.isAttached) {
                this._chromeConnection.close();
            }
        }
    }

    /**
     * Hook up all connection events
     */
    public install(): ChromeDebugLogic {
        this._debuggerEvents.onResumed(() => this.onResumed());
        this._debuggerEvents.onPaused(paused => this.onPaused(paused));
        this._consoleEventsProvider.onMessageAdded(params => this.onMessageAdded(params));
        this._consoleEventsProvider.onConsoleAPICalled(params => this.onConsoleAPICalled(params));
        this._exceptionThrownEventProvider.onExceptionThrown(params => this.onExceptionThrown(params));
        this._executionContextEventsProvider.onExecutionContextsCleared(() => this.clearTargetContext());
        this._logEventsProvider.onEntryAdded(entry => this.onLogEntryAdded(entry));

        this._chromeConnection.onClose(() => this.terminateSession('websocket closed'));

        return this;
    }

    // private async runAndMeasureProcessingTime<Result>(notificationName: string, procedure: () => Promise<Result>): Promise<Result> {
    //     const startTime = Date.now();
    //     const startTimeMark = process.hrtime();
    //     let properties: IExecutionResultTelemetryProperties = {
    //         startTime: startTime.toString()
    //     };

    //     try {
    //         return await procedure();
    //         properties.successful = 'true';
    //     } catch (e) {
    //         properties.successful = 'false';
    //         properties.exceptionType = 'firstChance';
    //         utils.fillErrorDetails(properties, e);
    //         throw e;
    //     } finally {
    //         const elapsedTime = utils.calculateElapsedTime(startTimeMark);
    //         properties.timeTakenInMilliseconds = elapsedTime.toString();

    //         // Callers set GDPR annotation
    //         this._batchTelemetryReporter.reportEvent(notificationName, properties);
    //     }
    // }

    public onResumed(): void {
        if (this._expectingResumedEvent) {
            this._expectingResumedEvent = false;

            // Need to wait to eval just a little after each step, because of #148
            this._waitAfterStep = utils.promiseTimeout(null, 50);
        } else {
            let resumedEvent = new ContinuedEvent(ChromeDebugLogic.THREAD_ID);
            this._session.sendEvent(resumedEvent);
        }
    }

    public onConsoleAPICalled(event: IConsoleAPICalledEvent): void {
        if (this._launchAttachArgs._suppressConsoleOutput) {
            return;
        }

        const result = formatConsoleArguments(event.type, event.args, event.stackTrace);
        const stack = stackTraceWithoutLogpointFrame(event.stackTrace);
        if (result) {
            this.logObjects(result.args, result.isError, stack);
        }
    }

    private onLogEntryAdded(entry: ILogEntry): void {
        // The Debug Console doesn't give the user a way to filter by level, just ignore 'verbose' logs
        if (entry.level === 'verbose') {
            return;
        }

        const args = entry.args || [];

        let text = entry.text || '';
        if (entry.url && !entry.stackTrace) {
            if (text) {
                text += ' ';
            }

            text += `[${entry.url}]`;
        }

        if (text) {
            args.unshift({
                type: 'string',
                value: text
            });
        }

        const type = entry.level === 'error' ? 'error' :
            entry.level === 'warning' ? 'warning' :
                'log';
        const result = formatConsoleArguments(type, args, entry.stackTrace);
        const stack = entry.stackTrace;
        if (result) {
            this.logObjects(result.args, result.isError, stack);
        }
    }

    private async logObjects(objs: CDTP.Runtime.RemoteObject[], isError = false, stackTrace?: CodeFlowStackTrace): Promise<void> {
        // This is an asynchronous method, so ensure that we handle one at a time so that they are sent out in the same order that they came in.
        this._currentLogMessage = this._currentLogMessage
            .then(async () => {
                const category = isError ? 'stderr' : 'stdout';

                let location: LocationInLoadedSource = null;
                if (stackTrace && stackTrace.codeFlowFrames.length) {
                    location = stackTrace.codeFlowFrames[0].location.mappedToSource();
                }

                // Shortcut the common log case to reduce unnecessary back and forth
                if (objs.length === 1 && objs[0].type === 'string') {
                    let msg: string = objs[0].value;
                    if (isError) {
                        const stackTrace = await new FormattedExceptionParser(this._scriptsLogic, msg).parse();
                        this._eventSender.sendExceptionThrown({ exceptionStackTrace: stackTrace, category, location });
                    } else {
                        if (!msg.endsWith(clearConsoleCode)) {
                            // If this string will clear the console, don't append a \n
                            msg += '\n';
                        }
                        this._eventSender.sendOutput({ output: msg, category, location });
                    }
                } else {
                    const variablesReference = this._variableHandles.create(new variables.LoggedObjects(objs), 'repl');
                    this._eventSender.sendOutput({ output: 'output', category, variablesReference, location });
                }

            })
            .catch(err => logger.error(err.toString()));
    }

    protected async onExceptionThrown(params: IExceptionThrownEvent): Promise<void> {
        if (this._launchAttachArgs._suppressConsoleOutput) {
            return;
        }

        return this._currentLogMessage = this._currentLogMessage.then(async () => {
            const formattedException = formatExceptionDetails(params.exceptionDetails);
            const exceptionStackTrace = await new FormattedExceptionParser(this._scriptsLogic, formattedException).parse();

            let location: LocationInLoadedSource = null;
            const stackTrace = params.exceptionDetails.stackTrace;
            if (stackTrace && stackTrace.codeFlowFrames.length) {
                location = stackTrace.codeFlowFrames[0].location.mappedToSource();
            }

            this._eventSender.sendExceptionThrown({ exceptionStackTrace: exceptionStackTrace, category: 'stderr', location });
        })
            .catch(err => logger.error(err.toString()));
    }

    /**
     * For backcompat, also listen to Console.messageAdded, only if it looks like the old format.
     */
    protected onMessageAdded(params: any): void {
        // message.type is undefined when Runtime.consoleAPICalled is being sent
        if (params && params.message && params.message.type) {
            const onConsoleAPICalledParams: IConsoleAPICalledEvent = {
                type: params.message.type,
                timestamp: params.message.timestamp,
                args: params.message.parameters || [{ type: 'string', value: params.message.text }],
                stackTrace: params.message.stack,
                executionContextId: 1
            };
            this.onConsoleAPICalled(onConsoleAPICalledParams);
        }
    }

    /* __GDPR__
        "ClientRequest/disconnect" : {
            "${include}": [
                "${IExecutionResultTelemetryProperties}",
                "${DebugCommonProperties}"
            ]
        }
    */
    public disconnect(): void {
        telemetry.reportEvent('FullSessionStatistics/SourceMaps/Overrides', { aspNetClientAppFallbackCount: sourceMapUtils.getAspNetFallbackCount() });
        this.shutdown();
        this.terminateSession('Got disconnect request');
    }

    /* __GDPR__
        "ClientRequest/setExceptionBreakpoints" : {
            "${include}": [
                "${IExecutionResultTelemetryProperties}",
                "${DebugCommonProperties}"
            ]
        }
    */
    public setExceptionBreakpoints(args: DebugProtocol.SetExceptionBreakpointsArguments): Promise<void> {
        let state: 'all' | 'uncaught' | 'none';
        if (args.filters.indexOf('all') >= 0) {
            state = 'all';
        } else if (args.filters.indexOf('uncaught') >= 0) {
            state = 'uncaught';
        } else {
            state = 'none';
        }

        if (args.filters.indexOf('promise_reject') >= 0) {
            this._pauseOnPromiseRejections = true;
        } else {
            this._pauseOnPromiseRejections = false;
        }

        return this._pauseOnExceptions.setPauseOnExceptions({ state })
            .then(() => { });
    }

    public stepBack(): Promise<void> {
        return (<ITimeTravelRuntime>this._chromeConnection.api).TimeTravel.stepBack()
            .then(() => { /* make void */ },
                () => { });
    }

    /* __GDPR__
        "ClientRequest/reverseContinue" : {
            "${include}": [
                "${IExecutionResultTelemetryProperties}",
                "${DebugCommonProperties}"
            ]
        }
    */
    public reverseContinue(): Promise<void> {
        return (<ITimeTravelRuntime>this._chromeConnection.api).TimeTravel.reverse()
            .then(() => { /* make void */ },
                () => { });
    }

    public getReadonlyOrigin(): string {
        // To override
        return undefined;
    }

    /**
     * Called when returning a stack trace, for the path for Sources that have a sourceReference, so consumers can
     * tweak it, since it's only for display.
     */
    protected realPathToDisplayPath(realPath: IResourceIdentifier): IResourceIdentifier {
        if (ChromeUtils.isEvalScript(realPath)) {
            return parseResourceIdentifier(`${ChromeDebugLogic.EVAL_ROOT}/${realPath}`);
        }

        return realPath;
    }

    /* __GDPR__
        "ClientRequest/scopes" : {
            "${include}": [
                "${IExecutionResultTelemetryProperties}",
                "${DebugCommonProperties}"
            ]
        }
    */
    public scopes(currentFrame: LoadedSourceCallFrame): IScopesResponseBody {
        if (!currentFrame || !currentFrame.location) {
            throw errors.stackFrameNotValid();
        }

        const scopes = currentFrame.scopeChain.map((scope, i) => {
            // The first scope should include 'this'. Keep the RemoteObject reference for use by the variables request
            const thisObj = i === 0 && currentFrame.frameThis;
            const returnValue = i === 0 && currentFrame.returnValue;
            const variablesReference = this._variableHandles.create(
                new ScopeContainer(currentFrame, i, scope.object.objectId, thisObj, returnValue));

            const resultScope = <DebugProtocol.Scope>{
                name: scope.type.substr(0, 1).toUpperCase() + scope.type.substr(1), // Take Chrome's scope, uppercase the first letter
                variablesReference,
                expensive: scope.type === 'global'
            };

            if (scope.startLocation && scope.endLocation) {
                resultScope.column = scope.startLocation.position.columnNumber;
                resultScope.line = scope.startLocation.position.lineNumber;
                resultScope.endColumn = scope.endLocation.position.columnNumber;
                resultScope.endLine = scope.endLocation.position.lineNumber;
            }

            return resultScope;
        });

        if (this._exception && currentFrame.index === 0) {
            scopes.unshift(<DebugProtocol.Scope>{
                name: localize('scope.exception', 'Exception'),
                variablesReference: this._variableHandles.create(ExceptionContainer.create(this._exception))
            });
        }

        const scopesResponse = { scopes };
        if (currentFrame.source.doesScriptHasUrl()) {
            this._sourceMapTransformer.scopesResponse(currentFrame.source.url, scopesResponse);
            this._lineColTransformer.scopeResponse(scopesResponse);
        }

        return scopesResponse;
    }

    /* __GDPR__
        "ClientRequest/variables" : {
            "${include}": [
                "${IExecutionResultTelemetryProperties}",
                "${DebugCommonProperties}"
            ]
        }
    */
    public variables(args: DebugProtocol.VariablesArguments): Promise<IVariablesResponseBody> {
        const handle = this._variableHandles.get(args.variablesReference);
        if (!handle) {
            return Promise.resolve<IVariablesResponseBody>(undefined);
        }

        return handle.expand(this, args.filter, args.start, args.count)
            .catch(err => {
                logger.log('Error handling variables request: ' + err.toString());
                return [];
            }).then(variables => {
                return { variables };
            });
    }

    public async propertyDescriptorToVariable(propDesc: CDTP.Runtime.PropertyDescriptor, owningObjectId?: string, parentEvaluateName?: string): Promise<DebugProtocol.Variable> {
        if (propDesc.get) {
            // Getter
            const grabGetterValue = 'function remoteFunction(propName) { return this[propName]; }';

            let response: CDTP.Runtime.CallFunctionOnResponse;
            try {
                response = await this._inspectDebugeeState.callFunctionOn({
                    objectId: owningObjectId,
                    functionDeclaration: grabGetterValue,
                    arguments: [{ value: propDesc.name }]
                });
            } catch (error) {
                logger.error(`Error evaluating getter for '${propDesc.name}' - ${error.toString()}`);
                return { name: propDesc.name, value: error.toString(), variablesReference: 0 };
            }

            if (response.exceptionDetails) {
                // Not an error, getter could be `get foo() { throw new Error('bar'); }`
                const exceptionMessage = ChromeUtils.errorMessageFromExceptionDetails(response.exceptionDetails);
                logger.verbose('Exception thrown evaluating getter - ' + exceptionMessage);
                return { name: propDesc.name, value: exceptionMessage, variablesReference: 0 };
            } else {
                return this.remoteObjectToVariable(propDesc.name, response.result, parentEvaluateName);
            }
        } else if (propDesc.set) {
            // setter without a getter, unlikely
            return { name: propDesc.name, value: 'setter', variablesReference: 0 };
        } else {
            // Non getter/setter
            return this.internalPropertyDescriptorToVariable(propDesc, parentEvaluateName);
        }
    }

    public getVariablesForObjectId(objectId: string, evaluateName?: string, filter?: string, start?: number, count?: number): Promise<DebugProtocol.Variable[]> {
        if (typeof start === 'number' && typeof count === 'number') {
            return this.getFilteredVariablesForObject(objectId, evaluateName, filter, start, count);
        }

        filter = filter === 'indexed' ? 'all' : filter;

        return Promise.all([
            // Need to make two requests to get all properties
            this.getRuntimeProperties({ objectId, ownProperties: false, accessorPropertiesOnly: true, generatePreview: true }),
            this.getRuntimeProperties({ objectId, ownProperties: true, accessorPropertiesOnly: false, generatePreview: true })
        ]).then(getPropsResponses => {
            // Sometimes duplicates will be returned - merge all descriptors by name
            const propsByName = new Map<string, CDTP.Runtime.PropertyDescriptor>();
            const internalPropsByName = new Map<string, CDTP.Runtime.InternalPropertyDescriptor>();
            getPropsResponses.forEach(response => {
                if (response) {
                    response.result.forEach(propDesc =>
                        propsByName.set(propDesc.name, propDesc));

                    if (response.internalProperties) {
                        response.internalProperties.forEach(internalProp => {
                            internalPropsByName.set(internalProp.name, internalProp);
                        });
                    }
                }
            });

            // Convert Chrome prop descriptors to DebugProtocol vars
            const variables: Promise<DebugProtocol.Variable>[] = [];
            propsByName.forEach(propDesc => {
                if (!filter || filter === 'all' || (isIndexedPropName(propDesc.name) === (filter === 'indexed'))) {
                    variables.push(this.propertyDescriptorToVariable(propDesc, objectId, evaluateName));
                }
            });

            internalPropsByName.forEach(internalProp => {
                if (!filter || filter === 'all' || (isIndexedPropName(internalProp.name) === (filter === 'indexed'))) {
                    variables.push(Promise.resolve(this.internalPropertyDescriptorToVariable(internalProp, evaluateName)));
                }
            });

            return Promise.all(variables);
        }).then(variables => {
            // Sort all variables properly
            return variables.sort((var1, var2) => ChromeUtils.compareVariableNames(var1.name, var2.name));
        });
    }

    private getRuntimeProperties(params: CDTP.Runtime.GetPropertiesRequest): Promise<CDTP.Runtime.GetPropertiesResponse> {
        return this._inspectDebugeeState.getProperties(params)
            .catch(err => {
                if (err.message.startsWith('Cannot find context with specified id')) {
                    // Hack to ignore this error until we fix https://github.com/Microsoft/client/issues/18001 to not request variables at unexpected times.
                    return null;
                } else {
                    throw err;
                }
            });
    }

    private internalPropertyDescriptorToVariable(propDesc: CDTP.Runtime.InternalPropertyDescriptor, parentEvaluateName: string): Promise<DebugProtocol.Variable> {
        return this.remoteObjectToVariable(propDesc.name, propDesc.value, parentEvaluateName);
    }

    private getFilteredVariablesForObject(objectId: string, evaluateName: string, filter: string, start: number, count: number): Promise<DebugProtocol.Variable[]> {
        // No ES6, in case we talk to an old runtime
        const getIndexedVariablesFn = `
            function getIndexedVariables(start, count) {
                var result = [];
                for (var i = start; i < (start + count); i++) result[i] = this[i];
                return result;
            }`;
        // TODO order??
        const getNamedVariablesFn = `
            function getNamedVariablesFn(start, count) {
                var result = [];
                var ownProps = Object.getOwnPropertyNames(this);
                for (var i = start; i < (start + count); i++) result[i] = ownProps[i];
                return result;
            }`;

        const getVarsFn = filter === 'indexed' ? getIndexedVariablesFn : getNamedVariablesFn;
        return this.getFilteredVariablesForObjectId(objectId, evaluateName, getVarsFn, filter, start, count);
    }

    private getFilteredVariablesForObjectId(objectId: string, evaluateName: string, getVarsFn: string, filter: string, start: number, count: number): Promise<DebugProtocol.Variable[]> {
        return this._inspectDebugeeState.callFunctionOn({
            objectId,
            functionDeclaration: getVarsFn,
            arguments: [{ value: start }, { value: count }],
            silent: true
        }).then<DebugProtocol.Variable[]>(evalResponse => {
            if (evalResponse.exceptionDetails) {
                const errMsg = ChromeUtils.errorMessageFromExceptionDetails(evalResponse.exceptionDetails);
                return Promise.reject(errors.errorFromEvaluate(errMsg));
            } else {
                // The eval was successful and returned a reference to the array object. Get the props, then filter
                // out everything except the index names.
                return this.getVariablesForObjectId(evalResponse.result.objectId, evaluateName, filter)
                    .then(variables => variables.filter(variable => isIndexedPropName(variable.name)));
            }
        },
            error => Promise.reject(errors.errorFromEvaluate(error.message)));
    }

    /* __GDPR__
        "ClientRequest/threads" : {
            "${include}": [
                "${IExecutionResultTelemetryProperties}",
                "${DebugCommonProperties}"
            ]
        }
    */
    public threads(): IThreadsResponseBody {
        return {
            threads: [
                {
                    id: ChromeDebugLogic.THREAD_ID,
                    name: this.threadName()
                }
            ]
        };
    }

    protected threadName(): string {
        return 'Thread ' + ChromeDebugLogic.THREAD_ID;
    }

    /* __GDPR__
        "ClientRequest/evaluate" : {
            "${include}": [
                "${IExecutionResultTelemetryProperties}",
                "${DebugCommonProperties}"
            ]
        }
    */
    public async evaluate(args: IEvaluateArguments): Promise<IEvaluateResponseBody> {
        const expression = args.expression.startsWith('{') && args.expression.endsWith('}')
            ? `(${args.expression})`
            : args.expression;

        const evalResponse = await this.waitThenDoEvaluate(expression, args.frame, { generatePreview: true });

        // Convert to a Variable object then just copy the relevant fields off
        const variable = await this.remoteObjectToVariable(expression, evalResponse.result, /*parentEvaluateName=*/undefined, /*stringify=*/undefined, <VariableContext>args.context);
        if (evalResponse.exceptionDetails) {
            let resultValue = variable.value;
            if (resultValue && (resultValue.startsWith('ReferenceError: ') || resultValue.startsWith('TypeError: ')) && args.context !== 'repl') {
                resultValue = errors.evalNotAvailableMsg;
            }

            return utils.errP(resultValue);
        }

        return <IEvaluateResponseBody>{
            result: variable.value,
            variablesReference: variable.variablesReference,
            indexedVariables: variable.indexedVariables,
            namedVariables: variable.namedVariables,
            type: variable.type
        };
    }

    /**
     * Allow consumers to override just because of https://github.com/nodejs/node/issues/8426
     */
    public globalEvaluate(args: CDTP.Runtime.EvaluateRequest): Promise<CDTP.Runtime.EvaluateResponse> {
        return this._inspectDebugeeState.evaluate(args);
    }

    private async waitThenDoEvaluate(expression: string, frame?: LoadedSourceCallFrame, extraArgs?: Partial<CDTP.Runtime.EvaluateRequest>): Promise<CDTP.Debugger.EvaluateOnCallFrameResponse | CDTP.Runtime.EvaluateResponse> {
        const waitThenEval = this._waitAfterStep.then(() => this.doEvaluate(expression, frame, extraArgs));
        this._waitAfterStep = waitThenEval.then(() => { }, () => { }); // to Promise<void> and handle failed evals
        return waitThenEval;
    }

    private async doEvaluate(expression: string, frame: LoadedSourceCallFrame, extraArgs?: Partial<CDTP.Runtime.EvaluateRequest>): Promise<CDTP.Debugger.EvaluateOnCallFrameResponse | CDTP.Runtime.EvaluateResponse> {
        if (frame) {
            if (!frame) {
                return utils.errP(errors.evalNotAvailableMsg);
            }

            return this.evaluateOnCallFrame(expression, frame, extraArgs);
        } else {
            let args: CDTP.Runtime.EvaluateRequest = {
                expression,
                // silent because of an issue where node will sometimes hang when breaking on exceptions in console messages. Fixed somewhere between 8 and 8.4
                silent: true,
                includeCommandLineAPI: true,
                objectGroup: 'console',
                userGesture: true
            };
            if (extraArgs) {
                args = Object.assign(args, extraArgs);
            }

            return this.globalEvaluate(args);
        }
    }

    public async evaluateOnCallFrame(expression: string, frame: LoadedSourceCallFrame, extraArgs?: Partial<CDTP.Runtime.EvaluateRequest>): Promise<CDTP.Debugger.EvaluateOnCallFrameResponse | CDTP.Runtime.EvaluateResponse> {
        let args: IEvaluateOnCallFrameRequest = {
            frame: frame.unmappedCallFrame,
            expression,
            // silent because of an issue where node will sometimes hang when breaking on exceptions in console messages. Fixed somewhere between 8 and 8.4
            silent: true,
            includeCommandLineAPI: true,
            objectGroup: 'console'
        };
        if (extraArgs) {
            args = Object.assign(args, extraArgs);
        }

        return this._inspectDebugeeState.evaluateOnCallFrame(args);
    }

    /* __GDPR__
        "ClientRequest/setVariable" : {
            "${include}": [
                "${IExecutionResultTelemetryProperties}",
                "${DebugCommonProperties}"
            ]
        }
    */
    public setVariable(args: DebugProtocol.SetVariableArguments): Promise<ISetVariableResponseBody> {
        const handle = this._variableHandles.get(args.variablesReference);
        if (!handle) {
            return Promise.reject(errors.setValueNotSupported());
        }

        return handle.setValue(this, args.name, args.value)
            .then(value => ({ value }));
    }

    public setVariableValue(frame: LoadedSourceCallFrame, scopeNumber: number, variableName: string, value: string): Promise<string> {
        let evalResultObject: CDTP.Runtime.RemoteObject;
        return this._inspectDebugeeState.evaluateOnCallFrame({ frame: frame.unmappedCallFrame, expression: value, silent: true }).then(evalResponse => {
            if (evalResponse.exceptionDetails) {
                const errMsg = ChromeUtils.errorMessageFromExceptionDetails(evalResponse.exceptionDetails);
                return Promise.reject(errors.errorFromEvaluate(errMsg));
            } else {
                evalResultObject = evalResponse.result;
                const newValue = ChromeUtils.remoteObjectToCallArgument(evalResultObject);
                return this._updateDebugeeState.setVariableValue({ frame: frame.unmappedCallFrame, scopeNumber, variableName, newValue });
            }
        },
            error => Promise.reject(errors.errorFromEvaluate(error.message)))
            // Temporary, Microsoft/vscode#12019
            .then(() => ChromeUtils.remoteObjectToValue(evalResultObject).value);
    }

    public setPropertyValue(objectId: string, propName: string, value: string): Promise<string> {
        const setPropertyValueFn = `function() { return this["${propName}"] = ${value} }`;
        return this._inspectDebugeeState.callFunctionOn({
            objectId, functionDeclaration: setPropertyValueFn,
            silent: true
        }).then(response => {
            if (response.exceptionDetails) {
                const errMsg = ChromeUtils.errorMessageFromExceptionDetails(response.exceptionDetails);
                return Promise.reject<string>(errors.errorFromEvaluate(errMsg));
            } else {
                // Temporary, Microsoft/vscode#12019
                return ChromeUtils.remoteObjectToValue(response.result).value;
            }
        },
            error => Promise.reject<string>(errors.errorFromEvaluate(error.message)));
    }

    public async remoteObjectToVariable(name: string, object: CDTP.Runtime.RemoteObject, parentEvaluateName?: string, stringify = true, context: VariableContext = 'variables'): Promise<DebugProtocol.Variable> {
        name = name || '""';

        if (object) {
            if (object.type === 'object') {
                return this.createObjectVariable(name, object, parentEvaluateName, context);
            } else if (object.type === 'function') {
                return this.createFunctionVariable(name, object, context, parentEvaluateName);
            } else {
                return this.createPrimitiveVariable(name, object, parentEvaluateName, stringify);
            }
        } else {
            return this.createPrimitiveVariableWithValue(name, '', parentEvaluateName);
        }
    }

    public createFunctionVariable(name: string, object: CDTP.Runtime.RemoteObject, context: VariableContext, parentEvaluateName?: string): DebugProtocol.Variable {
        let value: string;
        const firstBraceIdx = object.description.indexOf('{');
        if (firstBraceIdx >= 0) {
            value = object.description.substring(0, firstBraceIdx) + '{ … }';
        } else {
            const firstArrowIdx = object.description.indexOf('=>');
            value = firstArrowIdx >= 0 ?
                object.description.substring(0, firstArrowIdx + 2) + ' …' :
                object.description;
        }

        const evaluateName = ChromeUtils.getEvaluateName(parentEvaluateName, name);
        return <DebugProtocol.Variable>{
            name,
            value,
            type: utils.uppercaseFirstLetter(object.type),
            variablesReference: this._variableHandles.create(new PropertyContainer(object.objectId, evaluateName), context),
            evaluateName
        };
    }

    public createObjectVariable(name: string, object: CDTP.Runtime.RemoteObject, parentEvaluateName: string, context: VariableContext): Promise<DebugProtocol.Variable> {
        if ((<string>object.subtype) === 'internal#location') {
            // Could format this nicely later, see #110
            return Promise.resolve(this.createPrimitiveVariableWithValue(name, 'internal#location', parentEvaluateName));
        } else if (object.subtype === 'null') {
            return Promise.resolve(this.createPrimitiveVariableWithValue(name, 'null', parentEvaluateName));
        }

        const value = variables.getRemoteObjectPreview_object(object, context);
        let propCountP: Promise<IPropCount>;
        if (object.subtype === 'array' || object.subtype === 'typedarray') {
            if (object.preview && !object.preview.overflow) {
                propCountP = Promise.resolve(this.getArrayNumPropsByPreview(object));
            } else if (object.className === 'Buffer') {
                propCountP = this.getBufferNumPropsByEval(object.objectId);
            } else {
                propCountP = this.getArrayNumPropsByEval(object.objectId);
            }
        } else if (object.subtype === 'set' || object.subtype === 'map') {
            if (object.preview && !object.preview.overflow) {
                propCountP = Promise.resolve(this.getCollectionNumPropsByPreview(object));
            } else {
                propCountP = this.getCollectionNumPropsByEval(object.objectId);
            }
        } else {
            propCountP = Promise.resolve({
                indexedVariables: undefined,
                namedVariables: undefined
            });
        }

        const evaluateName = ChromeUtils.getEvaluateName(parentEvaluateName, name);
        const variablesReference = this._variableHandles.create(this.createPropertyContainer(object, evaluateName), context);
        return propCountP.then(({ indexedVariables, namedVariables }) => (<DebugProtocol.Variable>{
            name,
            value,
            type: utils.uppercaseFirstLetter(object.type),
            variablesReference,
            indexedVariables,
            namedVariables,
            evaluateName
        }));
    }

    protected createPropertyContainer(object: CDTP.Runtime.RemoteObject, evaluateName: string): IVariableContainer {
        return new PropertyContainer(object.objectId, evaluateName);
    }

    public createPrimitiveVariable(name: string, object: CDTP.Runtime.RemoteObject, parentEvaluateName?: string, stringify?: boolean): DebugProtocol.Variable {
        const value = variables.getRemoteObjectPreview_primitive(object, stringify);
        const variable = this.createPrimitiveVariableWithValue(name, value, parentEvaluateName);
        variable.type = object.type;

        return variable;
    }

    public createPrimitiveVariableWithValue(name: string, value: string, parentEvaluateName?: string): DebugProtocol.Variable {
        return {
            name,
            value,
            variablesReference: 0,
            evaluateName: ChromeUtils.getEvaluateName(parentEvaluateName, name)
        };
    }

    /* __GDPR__
        "ClientRequest/completions" : {
            "${include}": [
                "${IExecutionResultTelemetryProperties}",
                "${DebugCommonProperties}"
            ]
        }
    */
    public async completions(args: ICompletionsArguments): Promise<ICompletionsResponseBody> {
        const text = args.text;
        const column = args.column;

        // 1-indexed column
        const prefix = text.substring(0, column - 1);

        let expression: string;
        const dot = prefix.lastIndexOf('.');
        if (dot >= 0) {
            expression = prefix.substr(0, dot);
        }

        if (args.frame && !expression) {
            logger.verbose(`Completions: Returning global completions`);

            // If no expression was passed, we must be getting global completions at a breakpoint
            if (!args.frame) {
                return Promise.reject(errors.stackFrameNotValid());
            }

            const callFrame = args.frame;
            if (!callFrame) {
                // Async frame or label
                return { targets: [] };
            }

            const scopeExpandPs = callFrame.scopeChain
                .map(scope => new ScopeContainer(callFrame, undefined, scope.object.objectId).expand(this));
            return Promise.all(scopeExpandPs)
                .then((variableArrs: DebugProtocol.Variable[][]) => {
                    const targets = this.getFlatAndUniqueCompletionItems(
                        variableArrs.map(variableArr => variableArr.map(variable => variable.name)));
                    return { targets };
                });
        } else {
            expression = expression || 'this';

            logger.verbose(`Completions: Returning for expression '${expression}'`);
            const getCompletionsFn = `(function(x){var a=[];for(var o=x;o!==null&&typeof o !== 'undefined';o=o.__proto__){a.push(Object.getOwnPropertyNames(o))};return a})(${expression})`;
            const response = await this.waitThenDoEvaluate(getCompletionsFn, args.frame, { returnByValue: true });
            if (response.exceptionDetails) {
                return { targets: [] };
            } else {
                return { targets: this.getFlatAndUniqueCompletionItems(response.result.value) };
            }
        }
    }

    private getFlatAndUniqueCompletionItems(arrays: string[][]): DebugProtocol.CompletionItem[] {
        const set = new Set<string>();
        const items: DebugProtocol.CompletionItem[] = [];

        for (let i = 0; i < arrays.length; i++) {
            for (let name of arrays[i]) {
                if (!isIndexedPropName(name) && !set.has(name)) {
                    set.add(name);
                    items.push({
                        label: <string>name,
                        type: 'property'
                    });
                }
            }
        }

        return items;
    }

    private getArrayNumPropsByEval(objectId: string): Promise<IPropCount> {
        // +2 for __proto__ and length
        const getNumPropsFn = `function() { return [this.length, Object.keys(this).length - this.length + 2]; }`;
        return this.getNumPropsByEval(objectId, getNumPropsFn);
    }

    private getBufferNumPropsByEval(objectId: string): Promise<IPropCount> {
        // +2 for __proto__ and length
        // Object.keys doesn't return other props from a Buffer
        const getNumPropsFn = `function() { return [this.length, 0]; }`;
        return this.getNumPropsByEval(objectId, getNumPropsFn);
    }

    private getArrayNumPropsByPreview(object: CDTP.Runtime.RemoteObject): IPropCount {
        let indexedVariables = 0;
        const indexedProps = object.preview.properties
            .filter(prop => isIndexedPropName(prop.name));
        if (indexedProps.length) {
            // +1 because (last index=0) => 1 prop
            indexedVariables = parseInt(indexedProps[indexedProps.length - 1].name, 10) + 1;
        }

        const namedVariables = object.preview.properties.length - indexedProps.length + 2; // 2 for __proto__ and length
        return { indexedVariables, namedVariables };
    }

    private getCollectionNumPropsByEval(objectId: string): Promise<IPropCount> {
        const getNumPropsFn = `function() { return [0, Object.keys(this).length + 1]; }`; // +1 for [[Entries]];
        return this.getNumPropsByEval(objectId, getNumPropsFn);
    }

    private getCollectionNumPropsByPreview(object: CDTP.Runtime.RemoteObject): IPropCount {
        let indexedVariables = 0;
        let namedVariables = object.preview.properties.length + 1; // +1 for [[Entries]];

        return { indexedVariables, namedVariables };
    }

    private getNumPropsByEval(objectId: string, getNumPropsFn: string): Promise<IPropCount> {
        return this._inspectDebugeeState.callFunctionOn({
            objectId,
            functionDeclaration: getNumPropsFn,
            silent: true,
            returnByValue: true
        }).then(response => {
            if (response.exceptionDetails) {
                const errMsg = ChromeUtils.errorMessageFromExceptionDetails(response.exceptionDetails);
                return Promise.reject<IPropCount>(errors.errorFromEvaluate(errMsg));
            } else {
                const resultProps = response.result.value;
                if (resultProps.length !== 2) {
                    return Promise.reject<IPropCount>(errors.errorFromEvaluate('Did not get expected props, got ' + JSON.stringify(resultProps)));
                }

                return { indexedVariables: resultProps[0], namedVariables: resultProps[1] };
            }
        },
            error => Promise.reject<IPropCount>(errors.errorFromEvaluate(error.message)));
    }

    public async onPaused(_notification: PausedEvent): Promise<void> {
        this._variableHandles.onPaused();
    }

    public toString(): string {
        return 'ChromeDebugLogic';
    }
}
