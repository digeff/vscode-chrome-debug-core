import { CDTPDiagnosticsModule } from './cdtpDiagnosticsModule';
import { Crdp, utils } from '../..';
import { LocationInScript } from '../internal/locationInResource';
import { PausedEvent, SetVariableValueRequest, ScriptParsedEvent } from './events';
import { IScript } from '../internal/script';
import { EvaluateOnCallFrameRequest, INewSetBreakpointResult } from './requests';
import { CallFrame } from '../internal/stackTraces';
import { TargetToInternal } from './targetToInternal';
import { InternalToTarget } from './internalToTarget';

export type onScriptParsedListener = (params: ScriptParsedEvent) => void;

export class CDTPDebugger extends CDTPDiagnosticsModule<Crdp.DebuggerApi> {
    private _onScriptParsedListeners: onScriptParsedListener[] = [];
    private _firstScriptWasParsed = utils.promiseDefer<Crdp.Runtime.ScriptId>();

    public onScriptParsed(listener: onScriptParsedListener): void {
        this._onScriptParsedListeners.push(listener);
    }

    public onBreakpointResolved(listener: (breakpointId: Crdp.Debugger.BreakpointId, location: LocationInScript) => void): void {
        return this.api.on('breakpointResolved', async params => {
            listener(params.breakpointId, await this._crdpToInternal.toLocationInScript(params.location));
        });
    }

    public onPaused(listener: (params: PausedEvent) => void): void {
        return this.api.on('paused', async params => {
            listener({
                reason: params.reason, data: params.data, hitBreakpoints: params.hitBreakpoints,
                asyncStackTrace: params.asyncStackTrace && await this._crdpToInternal.toStackTraceCodeFlow(params.asyncStackTrace),
                asyncStackTraceId: params.asyncStackTraceId, asyncCallStackTraceId: params.asyncCallStackTraceId,
                callFrames: await Promise.all(params.callFrames.map((callFrame, index) => this._crdpToInternal.toCallFrame(index, callFrame)))
            });
        });
    }

    public onResumed(listener: () => void): void {
        return this.api.on('resumed', listener);
    }

    public on(event: 'scriptFailedToParse', listener: (params: Crdp.Debugger.ScriptFailedToParseEvent) => void): void {
        return this.api.on(event, listener);
    }

    public enable(): Promise<Crdp.Debugger.EnableResponse> {
        return this.api.enable();
    }

    public setAsyncCallStackDepth(params: Crdp.Debugger.SetAsyncCallStackDepthRequest): Promise<void> {
        return this.api.setAsyncCallStackDepth(params);
    }

    public pauseOnAsyncCall(params: Crdp.Debugger.PauseOnAsyncCallRequest): Promise<void> {
        return this.api.pauseOnAsyncCall(params);
    }

    public resume(): Promise<void> {
        return this.api.resume();
    }

    public getPossibleBreakpoints(params: { start: LocationInScript, end?: LocationInScript, restrictToFunction?: boolean }): Promise<Crdp.Debugger.GetPossibleBreakpointsResponse> {
        return this.api.getPossibleBreakpoints({
            start: this._internalToCRDP.toCrdpLocation(params.start),
            end: params.end && this._internalToCRDP.toCrdpLocation(params.end),
            restrictToFunction: params.restrictToFunction
        });
    }

    public setBlackboxedRanges(script: IScript, positions: Crdp.Debugger.ScriptPosition[]): Promise<void> {
        return this.api.setBlackboxedRanges({ scriptId: this._internalToCRDP.getScriptId(script), positions: positions });
    }

    public setBlackboxPatterns(params: Crdp.Debugger.SetBlackboxPatternsRequest): Promise<void> {
        return this.api.setBlackboxPatterns(params);
    }

    public removeBreakpoint(params: Crdp.Debugger.RemoveBreakpointRequest): Promise<void> {
        return this.api.removeBreakpoint(params);
    }

    public async setBreakpoint(location: LocationInScript, condition?: string): Promise<INewSetBreakpointResult> {
        const response = await this.api.setBreakpoint({ location: this._internalToCRDP.toCrdpLocation(location), condition });
        return { breakpointId: response.breakpointId, actualLocation: await this._crdpToInternal.toLocationInScript(response.actualLocation) };
    }

    public setBreakpointByUrl(params: Crdp.Debugger.SetBreakpointByUrlRequest): Promise<Crdp.Debugger.SetBreakpointByUrlResponse> {
        return this.api.setBreakpointByUrl(params);
    }

    public setPauseOnExceptions(params: Crdp.Debugger.SetPauseOnExceptionsRequest): Promise<void> {
        return this.api.setPauseOnExceptions(params);
    }

    public stepOver(): Promise<void> {
        return this.api.stepOver();
    }

    public stepInto(params: Crdp.Debugger.StepIntoRequest): Promise<void> {
        return this.api.stepInto(params);
    }

    public stepOut(): Promise<void> {
        return this.api.stepOut();
    }

    public pause(): Promise<void> {
        return this.api.pause();
    }

    public async getScriptSource(script: IScript): Promise<string> {
        return (await this.api.getScriptSource({ scriptId: this._internalToCRDP.getScriptId(script) })).scriptSource;
    }

    public evaluateOnCallFrame(params: EvaluateOnCallFrameRequest): Promise<Crdp.Debugger.EvaluateOnCallFrameResponse> {
        return this.api.evaluateOnCallFrame({
            callFrameId: this._internalToCRDP.getFrameId(params.frame.unmappedCallFrame),
            expression: params.expression,
            objectGroup: params.objectGroup,
            includeCommandLineAPI: params.includeCommandLineAPI,
            silent: params.silent,
            returnByValue: params.returnByValue,
            generatePreview: params.generatePreview,
            throwOnSideEffect: params.throwOnSideEffect,
            timeout: params.timeout,
        });
    }

    public setVariableValue(params: SetVariableValueRequest): Promise<void> {
        return this.api.setVariableValue({
            callFrameId: this._internalToCRDP.getFrameId(params.frame),
            scopeNumber: params.scopeNumber,
            variableName: params.variableName,
            newValue: params.newValue
        });
    }

    public restartFrame(frame: CallFrame<IScript>): Promise<Crdp.Debugger.RestartFrameResponse> {
        return this.api.restartFrame({ callFrameId: this._internalToCRDP.getFrameId(frame) });
    }

    protected onApiAvailable(): void {
        this.api.on('scriptParsed', async params => {
            // We resolve the promise waiting for the first script parse. This is used to detect column breakpoints support
            this._firstScriptWasParsed.resolve(params.scriptId);

            await this._crdpToInternal.createAndRegisterScript(params);

            this._onScriptParsedListeners.forEach(async listener => {
                listener(await this._crdpToInternal.toScriptParsedEvent(params));
            });

        });
    }

    public async supportsColumnBreakpoints(): Promise<boolean> {
        const scriptId = await this._firstScriptWasParsed.promise;

        try {
            await this.api.getPossibleBreakpoints({
                start: { scriptId, lineNumber: 0, columnNumber: 0 },
                end: { scriptId, lineNumber: 1, columnNumber: 0 },
                restrictToFunction: false
            });
            return true;
        } catch (e) {
            return false;
        }
    }

    constructor(
        apiGetter: () => Crdp.DebuggerApi,
        private readonly _crdpToInternal: TargetToInternal,
        private readonly _internalToCRDP: InternalToTarget) {
        super(apiGetter);
    }
}
