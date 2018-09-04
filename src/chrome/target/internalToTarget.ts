import { ScriptsRegistry } from '../internal/scripts/scriptsRegistry';
import { IScript } from '../internal/scripts/script';
import { Crdp } from '../..';
import { LocationInScript, ScriptOrSource, ScriptOrSourceOrIdentifierOrUrlRegexp } from '../internal/locations/locationInResource';
import { ValidatedMap } from '../collections/validatedMap';
import { IBPRecipie, BPRecipie } from '../internal/breakpoints/bpRecipie';
import { AlwaysBreak, ConditionalBreak } from '../internal/breakpoints/bpBehavior';
import { BreakpointIdRegistry } from './breakpointIdRegistry';
import { CallFrame } from '../internal/stackTraces/callFrame';

export class InternalToTarget {
    private nextEvaluateScriptId = 0;

    public getBPRecipieCondition(bpRecipie: IBPRecipie<ScriptOrSourceOrIdentifierOrUrlRegexp, AlwaysBreak | ConditionalBreak>): string | undefined {
        return bpRecipie.behavior.execute({
            alwaysBreak: () => undefined,
            conditionalBreak: conditionalBreak => conditionalBreak.expressionOfWhenToBreak
        });
    }

    public getBreakpointId(bpRecipie: BPRecipie<ScriptOrSourceOrIdentifierOrUrlRegexp>): Crdp.Debugger.BreakpointId {
        return this._breakpointIdRegistry.getBreakpointId(bpRecipie);
    }

    public getFrameId(frame: CallFrame<ScriptOrSource>): Crdp.Debugger.CallFrameId {
        return this._callFrameToId.get(frame.unmappedCallFrame);
    }

    public getScriptId(script: IScript): Crdp.Runtime.ScriptId {
        return this._scriptsLogic.getCrdpId(script);
    }

    public toCrdpLocation(location: LocationInScript): Crdp.Debugger.Location {
        return {
            scriptId: this.getScriptId(location.script),
            lineNumber: location.lineNumber,
            columnNumber: location.columnNumber
        };
    }

    public addURLIfMissing(expression: string): string {
        const sourceUrlPrefix = '\n//# sourceURL=';

        if (expression.indexOf(sourceUrlPrefix) < 0) {
            expression += `${sourceUrlPrefix}<debugger-internal>/id=${this.nextEvaluateScriptId++}`;
        }

        return expression;
    }

    constructor(
        private readonly _scriptsLogic: ScriptsRegistry,
        private readonly _callFrameToId: ValidatedMap<CallFrame<IScript>, Crdp.Debugger.CallFrameId>,
        private readonly _breakpointIdRegistry: BreakpointIdRegistry) { }
}