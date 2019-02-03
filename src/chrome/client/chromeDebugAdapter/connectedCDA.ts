/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as errors from '../../../errors';
import { DebugProtocol } from 'vscode-debugprotocol';
import { ChromeDebugLogic } from '../../chromeDebugAdapter';
import { ClientToInternal } from '../clientToInternal';
import { InternalToClient } from '../internalToClient';
import { IGetLoadedSourcesResponseBody, IDebugAdapterState, PromiseOrNot, ISetBreakpointsResponseBody, IStackTraceResponseBody, IScopesResponseBody, IVariablesResponseBody, ISourceResponseBody, IThreadsResponseBody, IEvaluateResponseBody, IExceptionInfoResponseBody, ILaunchRequestArgs, IAttachRequestArgs } from '../../../debugAdapterInterfaces';
import { StackTracesLogic } from '../../internal/stackTraces/stackTracesLogic';
import { SourcesLogic } from '../../internal/sources/sourcesLogic';
import { BreakpointsLogic } from '../../internal/breakpoints/features/breakpointsLogic';
import { CDTPScriptsRegistry } from '../../cdtpDebuggee/registries/cdtpScriptsRegistry';
import { PauseOnExceptionOrRejection } from '../../internal/exceptions/pauseOnException';
import { Stepping } from '../../internal/stepping/stepping';
import { DotScriptCommand } from '../../internal/sources/features/dotScriptsCommand';
import { inject, injectable } from 'inversify';
import { TYPES } from '../../dependencyInjection.ts/types';
import { SkipFilesLogic } from '../../internal/features/skipFiles';
import { TakeProperActionOnPausedEvent } from '../../internal/features/takeProperActionOnPausedEvent';
import { SmartStepLogic } from '../../internal/features/smartStep';
import { NotifyClientOfLoadedSources } from '../../internal/sources/features/notifyClientOfLoadedSources';
import { CDTPOnScriptParsedEventProvider } from '../../cdtpDebuggee/eventsProviders/cdtpOnScriptParsedEventProvider';
import { Target } from '../../communication/targetChannels';
import { IDebuggeeRunner } from '../../debugeeStartup/debugeeLauncher';
import { StepProgressEventsEmitter } from '../../../executionTimingsReporter';
import { TelemetryPropertyCollector, ITelemetryPropertyCollector } from '../../../telemetry';
import { ICommunicator, utils, IToggleSkipFileStatusArgs } from '../../..';
import { CallFramePresentation } from '../../internal/stackTraces/callFramePresentation';
import { asyncMap } from '../../collections/async';

// TODO DIEGO: Remember to call here and only here         this._lineColTransformer.convertDebuggerLocationToClient(stackFrame); for all responses
@injectable()
export class ConnectedCDA implements IDebugAdapterState {
    private readonly events = new StepProgressEventsEmitter();

    public static SCRIPTS_COMMAND = '.scripts';

    constructor(
        @inject(TYPES.ChromeDebugLogic) protected readonly _chromeDebugAdapter: ChromeDebugLogic,
        @inject(TYPES.SourcesLogic) private readonly _sourcesLogic: SourcesLogic,
        @inject(TYPES.CDTPScriptsRegistry) protected _scriptsLogic: CDTPScriptsRegistry,
        @inject(TYPES.ClientToInternal) protected readonly _clientToInternal: ClientToInternal,
        @inject(TYPES.InternalToClient) private readonly _internalToVsCode: InternalToClient,
        @inject(TYPES.StackTracesLogic) private readonly _stackTraceLogic: StackTracesLogic,
        @inject(TYPES.BreakpointsLogic) protected readonly _breakpointsLogic: BreakpointsLogic,
        @inject(TYPES.PauseOnExceptionOrRejection) public readonly _pauseOnException: PauseOnExceptionOrRejection,
        @inject(TYPES.Stepping) private readonly _stepping: Stepping,
        @inject(TYPES.DotScriptCommand) public readonly _dotScriptCommand: DotScriptCommand,
        @inject(SkipFilesLogic) public readonly _skipFilesLogic: SkipFilesLogic,
        @inject(SmartStepLogic) public readonly _smartStepLogic: SmartStepLogic,
        @inject(TakeProperActionOnPausedEvent) public readonly _takeProperActionOnPausedEvent: TakeProperActionOnPausedEvent,
        @inject(NotifyClientOfLoadedSources) public readonly _notifyClientOfLoadedSources: NotifyClientOfLoadedSources,
        @inject(TYPES.IScriptParsedProvider) public readonly _cdtpOnScriptParsedEventProvider: CDTPOnScriptParsedEventProvider,
        @inject(TYPES.communicator) public readonly _communicator: ICommunicator,
        @inject(TYPES.IDebugeeRunner) public readonly _debugeeRunner: IDebuggeeRunner,
    ) { }

    public async install(): Promise<this> {
        await this._chromeDebugAdapter.install();
        await this._sourcesLogic.install();
        await this._stackTraceLogic.install();
        await this._breakpointsLogic.install();
        await this._pauseOnException.install();
        await this._stepping.install();
        // await this._dotScriptCommand.install(configuration);
        await this._skipFilesLogic.install();
        await this._smartStepLogic.install();
        await this._takeProperActionOnPausedEvent.install();
        await this._notifyClientOfLoadedSources.install();

        const publishScriptParsed = this._communicator.getPublisher(Target.Debugger.OnScriptParsed);
        this._cdtpOnScriptParsedEventProvider.onScriptParsed(publishScriptParsed);
        return this;
    }

    public shutdown(): void {
        return this._chromeDebugAdapter.shutdown();
    }

    public disconnect(_: DebugProtocol.DisconnectArguments): PromiseOrNot<void> {
        return this._chromeDebugAdapter.disconnect();
    }

    public async setBreakpoints(args: DebugProtocol.SetBreakpointsArguments, telemetryPropertyCollector?: ITelemetryPropertyCollector): Promise<ISetBreakpointsResponseBody> {
        if (args.breakpoints) {
            const desiredBPRecipies = this._clientToInternal.toBPRecipies(args);
            const bpRecipiesStatus = await this._breakpointsLogic.updateBreakpointsForFile(desiredBPRecipies, telemetryPropertyCollector);
            return { breakpoints: await asyncMap(bpRecipiesStatus, bprs => this._internalToVsCode.toBPRecipieStatus(bprs)) };
        } else {
            throw new Error(`Expected the set breakpoints arguments to have a list of breakpoints yet it was ${args.breakpoints}`);
        }
    }

    public async setExceptionBreakpoints(args: DebugProtocol.SetExceptionBreakpointsArguments, _?: ITelemetryPropertyCollector, _2?: number): Promise<void> {
        const exceptionsStrategy = this._clientToInternal.toPauseOnExceptionsStrategy(args.filters);
        const promiseRejectionsStrategy = this._clientToInternal.toPauseOnPromiseRejectionsStrategy(args.filters);
        await this._pauseOnException.setExceptionsStrategy(exceptionsStrategy);
        this._pauseOnException.setPromiseRejectionStrategy(promiseRejectionsStrategy);
    }

    public async configurationDone(): Promise<void> {
        await this._debugeeRunner.run(new TelemetryPropertyCollector());
        this.events.emitMilestoneReached('RequestedNavigateToUserPage'); // TODO DIEGO: Make sure this is reported
    }

    public continue(): PromiseOrNot<void> {
        return this._stepping.continue();
    }

    public next(): PromiseOrNot<void> {
        return this._stepping.next();
    }

    public stepIn(): PromiseOrNot<void> {
        return this._stepping.stepIn();
    }

    public stepOut(): PromiseOrNot<void> {
        return this._stepping.stepOut();
    }

    public pause(): PromiseOrNot<void> {
        return this._stepping.pause();
    }

    public async restartFrame(args: DebugProtocol.RestartFrameRequest): Promise<void> {
        const callFrame = this._clientToInternal.getCallFrameById(args.arguments.frameId);
        if (callFrame instanceof CallFramePresentation) {
            return this._stepping.restartFrame(callFrame.callFrame.unmappedCallFrame);
        } else {
            throw new Error(`Cannot restart to a frame that doesn't have state information`);
        }
    }

    public async stackTrace(args: DebugProtocol.StackTraceArguments, _?: ITelemetryPropertyCollector, _2?: number): Promise<IStackTraceResponseBody> {
        const stackTracePresentation = await this._stackTraceLogic.stackTrace(args);
        const clientStackTracePresentation = {
            stackFrames: await this._internalToVsCode.toStackFrames(stackTracePresentation.stackFrames),
            totalFrames: stackTracePresentation.totalFrames
        };
        return clientStackTracePresentation;
    }

    public scopes(args: DebugProtocol.ScopesArguments, _?: ITelemetryPropertyCollector, _2?: number): PromiseOrNot<IScopesResponseBody> {
        const frame = this._clientToInternal.getCallFrameById(args.frameId);
        if (frame instanceof CallFramePresentation) {
            return this._chromeDebugAdapter.scopes(frame.callFrame);
        } else {
            throw new Error(`Can't get scopes for the frame because a label frame is only a description of the different sections of the call stack`);
        }
    }

    public variables(args: DebugProtocol.VariablesArguments, _?: ITelemetryPropertyCollector, _2?: number): PromiseOrNot<IVariablesResponseBody> {
        return this._chromeDebugAdapter.variables(args);
    }

    public async source(args: DebugProtocol.SourceArguments, _telemetryPropertyCollector?: ITelemetryPropertyCollector, _requestSeq?: number): Promise<ISourceResponseBody> {
        if (args.source) {
            const source = this._clientToInternal.toSource(args.source);
            const sourceText = await this._sourcesLogic.getText(source);
            return {
                content: sourceText,
                mimeType: 'text/javascript'
            };
        } else {
            throw new Error(`Expected the source request to have a source argument yet it was ${args.source}`);
        }
    }

    public threads(): PromiseOrNot<IThreadsResponseBody> {
        return this._chromeDebugAdapter.threads();
    }

    public async evaluate(args: DebugProtocol.EvaluateArguments, _telemetryPropertyCollector?: ITelemetryPropertyCollector, _requestSeq?: number): Promise<IEvaluateResponseBody> {
        if (args.expression.startsWith(ConnectedCDA.SCRIPTS_COMMAND)) {
            const scriptsRest = utils.lstrip(args.expression, ConnectedCDA.SCRIPTS_COMMAND).trim();
            await this._dotScriptCommand.handleScriptsCommand(scriptsRest);
            return <IEvaluateResponseBody>{
                result: '',
                variablesReference: 0
            };
        } else {
            return this._chromeDebugAdapter.evaluate(args);
        }
    }

    public async loadedSources(): Promise<IGetLoadedSourcesResponseBody> {
        return { sources: await asyncMap(await this._sourcesLogic.getLoadedSourcesTrees(), st => this._internalToVsCode.toSourceTree(st)) };
    }

    public setFunctionBreakpoints(_args: DebugProtocol.SetFunctionBreakpointsArguments, _telemetryPropertyCollector?: ITelemetryPropertyCollector, _requestSeq?: number): PromiseOrNot<DebugProtocol.SetFunctionBreakpointsResponse> {
        throw new Error('Method not implemented.');
    }

    public setVariable(_args: DebugProtocol.SetVariableArguments, _telemetryPropertyCollector?: ITelemetryPropertyCollector, _requestSeq?: number): PromiseOrNot<DebugProtocol.SetVariableResponse> {
        throw new Error('Method not implemented.');
    }

    public async exceptionInfo(args: DebugProtocol.ExceptionInfoArguments): Promise<IExceptionInfoResponseBody> {
        if (args.threadId !== ChromeDebugLogic.THREAD_ID) {
            throw errors.invalidThread(args.threadId);
        }

        return this._internalToVsCode.toExceptionInfo(await this._pauseOnException.latestExceptionInfo());
    }

    public async toggleSkipFileStatus(args: IToggleSkipFileStatusArgs): Promise<void> {
        return this._skipFilesLogic.toggleSkipFileStatus(args);
    }

    public async toggleSmartStep(): Promise<void> {
        return this._smartStepLogic.toggleSmartStep();
    }

    public launch(_args: ILaunchRequestArgs, _telemetryPropertyCollector?: ITelemetryPropertyCollector, _requestSeq?: number): never {
        throw new Error("Can't launch to a new target while connected to a previous target");
    }

    public attach(_args: IAttachRequestArgs, _telemetryPropertyCollector?: ITelemetryPropertyCollector, _requestSeq?: number): never {
        throw new Error("Can't attach to a new target while connected to a previous target");
    }

    public initialize(_args: DebugProtocol.InitializeRequestArguments, _telemetryPropertyCollector?: ITelemetryPropertyCollector, _requestSeq?: number): PromiseOrNot<{ capabilities: DebugProtocol.Capabilities; newState: IDebugAdapterState; }> {
        throw new Error('The debug adapter is already initialized. Calling initialize again is not supported.');
    }
}
