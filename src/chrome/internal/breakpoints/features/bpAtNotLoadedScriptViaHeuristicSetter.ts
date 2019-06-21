import { BPRecipeInSource } from '../bpRecipeInSource';
import { IBPActionWhenHit } from '../bpActionWhenHit';
import { BaseSourceMapTransformer } from '../../../../transformers/baseSourceMapTransformer';
import { inject, injectable } from 'inversify';
import { TYPES } from '../../../dependencyInjection.ts/types';
import { MappedSourcesMapper } from '../../scripts/sourcesMapper';
import { IFutureScript } from '../../scripts/IFutureScript';
import { IDebuggeeBreakpointsSetter, IEventsConsumer } from '../../../cdtpDebuggee/features/cdtpDebuggeeBreakpointsSetter';
import { mapToUrlRegexp, BPRecipeInUrlRegexp } from '../baseMappedBPRecipe';
import { LocationInUrl, LocationInLoadedSource, Position } from '../../locations/location';
import { CDTPScriptUrl } from '../../sources/resourceIdentifierSubtypes';
import { IResourceIdentifier } from '../../sources/resourceIdentifier';
import { IdentifiedLoadedSource } from '../../sources/identifiedLoadedSource';
import { SourceMap } from '../../../../sourceMaps/sourceMap';
import { ValidatedMap } from '../../../collections/validatedMap';

// TODO: Make sure breakpoints hit when files are really not loaded, and are removed after the script is loaded

@injectable()
export class BPAtNotLoadedScriptViaHeuristicSetter {
    private readonly _bprToHeuristicBPR = new ValidatedMap<BPRecipeInSource, BPRecipeInUrlRegexp>();

    public constructor(
        @inject(TYPES.BaseSourceMapTransformer) private readonly _sourceMapTransformer: BaseSourceMapTransformer,
        @inject(TYPES.IDebuggeeBreakpointsSetter) private readonly _targetBreakpoints: IDebuggeeBreakpointsSetter) { }

    public async addBPRecipe(requestedBP: BPRecipeInSource, eventsConsumer: IEventsConsumer): Promise<void> {
        const location = await this.getBPRInUrlRegexpPosition(requestedBP);
        const heuristicBPRecipe = mapToUrlRegexp(requestedBP, location.url.textRepresentation, location.position, <LocationInLoadedSource><unknown>null);

        this._bprToHeuristicBPR.set(requestedBP, heuristicBPRecipe);
        await this._targetBreakpoints.setBreakpointByUrlRegexp(heuristicBPRecipe, eventsConsumer);
    }

    public async removeBPRecipeIfNeeded(requestedBP: BPRecipeInSource): Promise<void> {
        const heuristicBPR = this._bprToHeuristicBPR.tryGetting(requestedBP);
        if (heuristicBPR !== undefined) {
            await this._targetBreakpoints.removeBreakpoint(heuristicBPR);
            this._bprToHeuristicBPR.delete(requestedBP);
        }
    }

    private async getBPRInUrlRegexpPosition(requestedBP: BPRecipeInSource<IBPActionWhenHit>): Promise<LocationInUrl> {
        const sourceIdentifier = requestedBP.location.resource.sourceIdentifier;
        const sourceMap = await this._sourceMapTransformer.getSourceMapFromAuthoredPath(sourceIdentifier);
        if (sourceMap !== null) {
            const script = new SourceWithSourceMap(sourceMap);
            const sourceMapper = new MappedSourcesMapper(script, sourceMap);
            const mappedLocation = sourceMapper.getPositionInScript(requestedBP.location);
            return new LocationInUrl(<IResourceIdentifier<CDTPScriptUrl>>sourceMap.generatedPath, mappedLocation.enclosingRange.range.start);
        }

        // We don't know if this cast is correct or not. If it's not, the breakpoint will not bind, as designed
        return new LocationInUrl(<IResourceIdentifier<CDTPScriptUrl>>sourceIdentifier, requestedBP.location.position);
    }
}

export class SourceWithSourceMap implements IFutureScript {
    public constructor(private readonly _sourceMap: SourceMap) { }

    public get mappedSources(): IdentifiedLoadedSource<string>[] {
        throw new Error(`Not yet implemented: mappedSources`);
    }

    public get startPositionInSource(): Position {
        return Position.origin; // TODO: Try to figure out an heuristic for .html files
    }

    public toString(): string {
        return `Source with map: ${this._sourceMap.generatedPath}`;
    }
}