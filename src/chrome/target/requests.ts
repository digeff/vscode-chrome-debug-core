import { Crdp } from '../..';
import { LocationInScript } from '../internal/locations/location';
import { ICallFrame, ScriptOrLoadedSource } from '../internal/stackTraces/callFrame';

export interface INewSetBreakpointResult {
    readonly breakpointId?: Crdp.Debugger.BreakpointId;
    readonly actualLocation?: LocationInScript;
}

export interface INewAddBreakpointsResult {
    readonly breakpointId?: Crdp.Debugger.BreakpointId;
    readonly actualLocation?: LocationInScript & { scriptId?: Crdp.Runtime.ScriptId }; // TODO: node-debug2 is currently using the scriptId property
}

export interface EvaluateOnCallFrameRequest {
    readonly frame: ICallFrame<ScriptOrLoadedSource>;
    readonly expression: string;
    readonly objectGroup?: string;
    readonly includeCommandLineAPI?: boolean;
    readonly silent?: boolean;
    readonly returnByValue?: boolean;
    readonly generatePreview?: boolean;
    readonly throwOnSideEffect?: boolean;
    readonly timeout?: Crdp.Runtime.TimeDelta;
}