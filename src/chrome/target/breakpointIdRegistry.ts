import { BidirectionalMap } from '../collections/bidirectionalMap';
import { BPRecipie } from '../internal/breakpoints/bpRecipie';
import { ScriptOrSourceOrIdentifierOrUrlRegexp } from '../internal/locationInResource';
import { Crdp } from '../..';

export class BreakpointIdRegistry {
    // TODO DIEGO: Figure out how to handle if two breakpoint rules set a breakpoint in the same location so it ends up being the same breakpoint id
    private readonly _recipieToBreakpointId = new BidirectionalMap<BPRecipie<ScriptOrSourceOrIdentifierOrUrlRegexp>, Crdp.Debugger.BreakpointId>();

    public registerRecipie(cdtpBreakpointId: Crdp.Debugger.BreakpointId, bpRecipie: BPRecipie<ScriptOrSourceOrIdentifierOrUrlRegexp>): void {
        this._recipieToBreakpointId.set(bpRecipie, cdtpBreakpointId);
    }

    public getBreakpointId(bpRecipie: BPRecipie<ScriptOrSourceOrIdentifierOrUrlRegexp>): Crdp.Debugger.BreakpointId {
        return this._recipieToBreakpointId.getByLeft(bpRecipie);
    }

    public getRecipieByBreakpointId(cdtpBreakpointId: Crdp.Debugger.BreakpointId): BPRecipie<ScriptOrSourceOrIdentifierOrUrlRegexp> {
        return this._recipieToBreakpointId.getByRight(cdtpBreakpointId);
    }

    public toString(): string {
        return `Breakpoint ID Registry:\nRecipie to BP ID: ${this._recipieToBreakpointId}`;
    }
}