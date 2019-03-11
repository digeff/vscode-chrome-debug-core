/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { ISource } from '../../sources/source';
import { IBPRecipe } from '../bpRecipe';
import { CDTPBPRecipe } from '../../../cdtpDebuggee/cdtpPrimitives';
import { ValidatedMultiMap } from '../../../collections/validatedMultiMap';

type ClientBPRecipe = IBPRecipe<ISource>;
type DebuggeeBPRecipe = CDTPBPRecipe;

export class DebuggeeBPRsSetForClientBPRFinder {
    private readonly _clientBPRToDebuggeeBPRItSet = new ValidatedMultiMap<ClientBPRecipe, DebuggeeBPRecipe>();

    public debuggeeBPRsWasSet(clientBPRecipe: ClientBPRecipe, debuggeeBPRecipe: DebuggeeBPRecipe): void {
        /**
         * If we load the same script two times, we'll try to register the same client BP
         * with the same debuggee BP twice, so we need to allow duplicates
         */
        this._clientBPRToDebuggeeBPRItSet.addAndIgnoreDuplicates(clientBPRecipe, debuggeeBPRecipe);
    }

    public debuggeeBPRsWasRemoved(clientBPRecipe: ClientBPRecipe, debuggeeBPRecipe: DebuggeeBPRecipe): void {
        this._clientBPRToDebuggeeBPRItSet.removeValue(clientBPRecipe, debuggeeBPRecipe);
    }

    public clientBPRWasRemoved(clientBPRecipe: ClientBPRecipe): void {
        const debuggeBPRecipies = this._clientBPRToDebuggeeBPRItSet.get(clientBPRecipe);
        if (debuggeBPRecipies.size >= 1) {
            throw new Error(`Tried to remove a Client breakpoint recipe (${clientBPRecipe}) which still had some `
                + `associated debuggee breakpoint recipes (${debuggeBPRecipies})`);
        }

        this._clientBPRToDebuggeeBPRItSet.delete(clientBPRecipe);
    }

    public findDebuggeeBPRsSet(clientBPRecipe: ClientBPRecipe): DebuggeeBPRecipe[] {
        // TODO: Review if it's okay to use getOr here, or if we should use get instead
        return Array.from(this._clientBPRToDebuggeeBPRItSet.getOr(clientBPRecipe, () => new Set()));
    }

    public toString(): string {
        return `Debuggee BPRs set for Client BPR: ${this._clientBPRToDebuggeeBPRItSet}`;
    }
}
