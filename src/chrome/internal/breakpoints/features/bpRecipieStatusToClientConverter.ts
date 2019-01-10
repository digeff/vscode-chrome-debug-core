import { IBPRecipeStatus, BPRecipeHasBoundSubstatuses } from '../bpRecipeStatus';

import { DebugProtocol } from 'vscode-debugprotocol';
import { IBPRecipe } from '../bpRecipe';
import { HandlesRegistry } from '../../../client/handlesRegistry';
import { SourcesRetriever } from '../../sources/sourcesRetriever';
import { LocationInSourceToClientConverter } from '../../../client/locationInSourceToClientConverter';
import { inject } from 'inversify';
import { TYPES } from '../../../dependencyInjection.ts/types';
import { LineColTransformer } from '../../../../transformers/lineNumberTransformer';
import { ISource } from '../../sources/source';

export class BPRecipieStatusToClientConverter {
    private readonly _locationInSourceToClientConverter = new LocationInSourceToClientConverter(this._handlesRegistry, this._lineColTransformer);

    constructor(
        @inject(HandlesRegistry) private readonly _handlesRegistry: HandlesRegistry,
        @inject(TYPES.LineColTransformer) private readonly _lineColTransformer: LineColTransformer,
        private readonly _sourcesLogic: SourcesRetriever) { }

    public async toBPRecipeStatus(bpRecipeStatus: IBPRecipeStatus): Promise<DebugProtocol.Breakpoint> {
        const clientStatus = {
            id: this.toBreakpointId(bpRecipeStatus.recipe),
            verified: bpRecipeStatus.isVerified(),
            message: bpRecipeStatus.statusDescription
        };

        if (bpRecipeStatus instanceof BPRecipeHasBoundSubstatuses) {
            await this._locationInSourceToClientConverter.toLocationInSource(bpRecipeStatus.actualLocationInSource, clientStatus);
        }

        return clientStatus;
    }

    public toBreakpointId(recipe: IBPRecipe<ISource>): number {
        return this._handlesRegistry.breakpoints.getIdByObject(recipe);
    }
}