import { injectable } from 'inversify';
import { ISource } from '../../sources/source';
import { IBPRecipie } from '../bpRecipie';
import { CDTPBPRecipie } from '../../../cdtpDebuggee/cdtpPrimitives';
import { BidirectionalMap } from '../../../collections/bidirectionalMap';
import { ValidatedMultiMap } from '../../../collections/validatedMultiMap';

type ClientBPRecipie = IBPRecipie<ISource>;
type DebuggeeBPRecipie = CDTPBPRecipie;

@injectable()
export class CDTPBPRecipiesRegistry {
    private readonly _clientRecipieToDebuggeeRecipie = new ValidatedMultiMap<ClientBPRecipie, DebuggeeBPRecipie>();

    public register(clientBPRecipie: ClientBPRecipie, debuggeeBPRecipie: DebuggeeBPRecipie): void {
        this._clientRecipieToDebuggeeRecipie.add(clientBPRecipie, debuggeeBPRecipie);
    }

    public unregister(clientBPRecipie: ClientBPRecipie): void {
        this._clientRecipieToDebuggeeRecipie.delete(clientBPRecipie);
    }

    public getDebuggeeBPRecipie(clientBPRecipie: ClientBPRecipie): DebuggeeBPRecipie[] {
        return Array.from(this._clientRecipieToDebuggeeRecipie.get(clientBPRecipie));
    }

    public toString(): string {
        return `Client to Debuggee BP Recipies: ${this._clientRecipieToDebuggeeRecipie}`;
    }
}
