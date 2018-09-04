import { CDTPDiagnosticsModule } from './cdtpDiagnosticsModule';
import { Crdp, utils } from '../..';
import { LocationInScript, ScriptOrSourceOrIdentifierOrUrlRegexp } from '../internal/locations/locationInResource';
import { PausedEvent, SetVariableValueRequest, ScriptParsedEvent } from './events';
import { IScript } from '../internal/scripts/script';
import { EvaluateOnCallFrameRequest } from './requests';
import { TargetToInternal } from './targetToInternal';
import { InternalToTarget } from './internalToTarget';
import { BPRecipieInScript, BPRecipieInUrl, BPRecipieInUrlRegexp, BPRecipie } from '../internal/breakpoints/bpRecipie';
import { AlwaysBreak, ConditionalBreak } from '../internal/breakpoints/bpActionWhenHit';
import { Breakpoint, BreakpointInScript, BreakpointInUrl, BreakpointInUrlRegexp } from '../internal/breakpoints/breakpoint';
import { asyncMap } from '../collections/async';
import { ICallFrame } from '../internal/stackTraces/callFrame';
import { RangeInScript } from '../internal/locations/rangeInScript';
import { Listeners } from '../communication/listeners';

export type ScriptParsedListener = (params: ScriptParsedEvent) => void;

export class CDTPDebugger extends CDTPDiagnosticsModule<Crdp.DebuggerApi> {
    private _firstScriptWasParsed = utils.promiseDefer<Crdp.Runtime.ScriptId>();
    private _onScriptParsedListeners = new Listeners<ScriptParsedEvent, void>();
    private _onPausedListeners = new Listeners<PausedEvent, void>();
    private _onPausedDueToInstrumentationListeners = new Listeners<PausedEvent, void>();

    public onBreakpointResolved(listener: (breakpoint: Breakpoint<ScriptOrSourceOrIdentifierOrUrlRegexp>) => void): void {
        return this.api.on('breakpointResolved', async params => {
            const bpRecipie = this._crdpToInternal.toBPRecipie(params.breakpointId);
            const breakpoint = new Breakpoint(bpRecipie,
                await this._crdpToInternal.toLocationInScript(params.location));
            listener(breakpoint);
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

    public async getPossibleBreakpoints(rangeInScript: RangeInScript): Promise<LocationInScript[]> {
        const response = await this.api.getPossibleBreakpoints({
            start: this._internalToCRDP.toCrdpLocation(rangeInScript.startInScript),
            end: this._internalToCRDP.toCrdpLocation(rangeInScript.endInScript)
        });

        return asyncMap(response.locations, async location => await this._crdpToInternal.toLocationInScript(location));
    }

    public setBlackboxedRanges(script: IScript, positions: Crdp.Debugger.ScriptPosition[]): Promise<void> {
        return this.api.setBlackboxedRanges({ scriptId: this._internalToCRDP.getScriptId(script), positions: positions });
    }

    public setBlackboxPatterns(params: Crdp.Debugger.SetBlackboxPatternsRequest): Promise<void> {
        return this.api.setBlackboxPatterns(params);
    }

    public async removeBreakpoint(bpRecipie: BPRecipie<ScriptOrSourceOrIdentifierOrUrlRegexp>): Promise<void> {
        await this.api.removeBreakpoint({ breakpointId: this._internalToCRDP.getBreakpointId(bpRecipie) });
        this._crdpToInternal.unregisterBreakpointId(bpRecipie);
    }

    public async setBreakpoint(bpRecipie: BPRecipieInScript<AlwaysBreak | ConditionalBreak>): Promise<BreakpointInScript> {
        const condition = this._internalToCRDP.getBPRecipieCondition(bpRecipie);

        const response = await this.api.setBreakpoint({ location: this._internalToCRDP.toCrdpLocation(bpRecipie.locationInResource), condition });

        // We need to call registerRecipie sync with the response, before any awaits so if we get an event witha breakpointId we'll be able to resolve it properly
        this._crdpToInternal.registerBreakpointId(response.breakpointId, bpRecipie);

        return this._crdpToInternal.toBreakpointInScript(bpRecipie, response);
    }

    public async setBreakpointByUrl(bpRecipie: BPRecipieInUrl<AlwaysBreak | ConditionalBreak>): Promise<BreakpointInUrl[]> {
        const condition = this._internalToCRDP.getBPRecipieCondition(bpRecipie);
        const url = bpRecipie.locationInResource.resource.textRepresentation;
        const location = bpRecipie.locationInResource.location;

        const response = await this.api.setBreakpointByUrl({ url, lineNumber: location.lineNumber, columnNumber: location.columnNumber, condition });

        // We need to call registerRecipie sync with the response, before any awaits so if we get an event witha breakpointId we'll be able to resolve it properly
        this._crdpToInternal.registerBreakpointId(response.breakpointId, bpRecipie);

        return Promise.all(response.locations.map(cdtpLocation => this._crdpToInternal.toBreakpointInUrl(bpRecipie, cdtpLocation)));
    }

    public async setBreakpointByUrlRegexp(bpRecipie: BPRecipieInUrlRegexp<AlwaysBreak | ConditionalBreak>): Promise<BreakpointInUrlRegexp[]> {
        const condition = this._internalToCRDP.getBPRecipieCondition(bpRecipie);
        const urlRegex = bpRecipie.locationInResource.resource.textRepresentation;
        const location = bpRecipie.locationInResource.location;

        const response = await this.api.setBreakpointByUrl({ urlRegex, lineNumber: location.lineNumber, columnNumber: location.columnNumber, condition });

        // We need to call registerRecipie sync with the response, before any awaits so if we get an event witha breakpointId we'll be able to resolve it properly
        this._crdpToInternal.registerBreakpointId(response.breakpointId, bpRecipie);

        return Promise.all(response.locations.map(cdtpLocation => this._crdpToInternal.toBreakpointInUrlRegexp(bpRecipie, cdtpLocation)));
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
            expression: this._internalToCRDP.addURLIfMissing(params.expression),
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

    public restartFrame(frame: ICallFrame<IScript>): Promise<Crdp.Debugger.RestartFrameResponse> {
        return this.api.restartFrame({ callFrameId: this._internalToCRDP.getFrameId(frame) });
    }

    protected onApiAvailable(): void {
        this.api.on('scriptParsed', async params => {
            // We resolve the promise waiting for the first script parse. This is used to detect column breakpoints support
            this._firstScriptWasParsed.resolve(params.scriptId);

            await this._crdpToInternal.createAndRegisterScript(params);

            this._onScriptParsedListeners.call(await this._crdpToInternal.toScriptParsedEvent(params));
        });

        return this.api.on('paused', async params => {
            if (params.callFrames.length === 0) {
                throw new Error(`Expected a pause event to have at least a single call frame: ${JSON.stringify(params)}`);
            }

            const callFrames = await asyncMap(params.callFrames, (callFrame, index) => this._crdpToInternal.toCallFrame(index, callFrame));
            const internalPaused = new PausedEvent(callFrames, params.reason, params.data,
                this._crdpToInternal.getBPsFromIDs(params.hitBreakpoints),
                params.asyncStackTrace && await this._crdpToInternal.toStackTraceCodeFlow(params.asyncStackTrace),
                params.asyncStackTraceId, params.asyncCallStackTraceId);

            if (this.isInstrumentationPause(params)) {
                this._onPausedDueToInstrumentationListeners.call(internalPaused);
            } else {
                this._onPausedListeners.call(internalPaused);
            }
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

    public onScriptParsed(listener: ScriptParsedListener): void {
        this._onScriptParsedListeners.add(listener);
    }

    public onPaused(listener: (params: PausedEvent) => void): void {
        this._onPausedListeners.add(listener);
    }

    public onPausedDueToInstrumentation(listener: (params: PausedEvent) => void): void {
        this._onPausedDueToInstrumentationListeners.add(listener);
    }

    private isInstrumentationPause(notification: Crdp.Debugger.PausedEvent): boolean {
        return (notification.reason === 'EventListener' && notification.data.eventName.startsWith('instrumentation:')) ||
            (notification.reason === 'ambiguous' && Array.isArray(notification.data.reasons) &&
                notification.data.reasons.every((r: any) => r.reason === 'EventListener' && r.auxData.eventName.startsWith('instrumentation:')));
    }

    constructor(
        apiGetter: () => Crdp.DebuggerApi,
        private readonly _crdpToInternal: TargetToInternal,
        private readonly _internalToCRDP: InternalToTarget) {
        super(apiGetter);
    }
}
