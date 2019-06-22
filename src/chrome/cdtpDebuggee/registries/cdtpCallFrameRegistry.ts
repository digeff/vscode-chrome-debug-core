/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

 import { Protocol as CDTP } from 'devtools-protocol';
import { ScriptCallFrame, CallFrameWithState } from '../../internal/stackTraces/callFrame';
import { injectable } from 'inversify';
import { BidirectionalMap } from '../../collections/bidirectionalMap';

@injectable()
export class CDTPCallFrameRegistry {
    private readonly _callFrameToId = new BidirectionalMap<ScriptCallFrame<CallFrameWithState>, CDTP.Debugger.CallFrameId>();

    private getFrameOrRegisterIfNew(callFrameId: CDTP.Debugger.CallFrameId, frame: ScriptCallFrame<CallFrameWithState>): void {
        this._callFrameToId.set(frame, callFrameId);
    }

    public getFrameId(frame: ScriptCallFrame<CallFrameWithState>): CDTP.Debugger.CallFrameId {
        return this._callFrameToId.getByLeft(frame);
    }
}