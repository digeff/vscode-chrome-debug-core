import { IScript } from '../internal/scripts/script';
import { Crdp } from '../..';
import { ScriptOrLoadedSource } from '../internal/locations/location';
import { ValidatedMap } from '../collections/validatedMap';
import { ICallFrame } from '../internal/stackTraces/callFrame';
import { injectable } from 'inversify';

@injectable()
export class CallFrameRegistry {
    private readonly _callFrameToId = new ValidatedMap<ICallFrame<IScript>, Crdp.Debugger.CallFrameId>();

    public getFrameId(frame: ICallFrame<ScriptOrLoadedSource>): Crdp.Debugger.CallFrameId {
        return this._callFrameToId.get(frame.unmappedCallFrame);
    }
}