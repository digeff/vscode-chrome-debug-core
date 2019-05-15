import * as ChromeUtils from '../../chromeUtils';
import { BPRecipeInLoadedSource, BPRecipeInScript } from '../breakpoints/baseMappedBPRecipe';
import { ConditionalPause, AlwaysPause } from '../breakpoints/bpActionWhenHit';
import { injectable, inject } from 'inversify';
import { IBreakpointFeaturesSupport } from '../../cdtpDebuggee/features/cdtpBreakpointFeaturesSupport';
import { LocationInScript } from '../locations/location';
import { RangeInScript, RangeInResource } from '../locations/rangeInScript';
import { logger } from 'vscode-debugadapter/lib/logger';
import { IDebuggeeBreakpointsSetter } from '../../cdtpDebuggee/features/cdtpDebuggeeBreakpointsSetter';
import { printArray } from '../../collections/printing';
import { asyncMap } from '../../collections/async';
import { TYPES } from '../../dependencyInjection.ts/types';
import { IScript } from '../scripts/script';

@injectable()
export class SourceToScriptMapper {
    private readonly doesTargetSupportColumnBreakpointsCached: Promise<boolean>;

    constructor(
        @inject(TYPES.IBreakpointFeaturesSupport) private readonly _breakpointFeaturesSupport: IBreakpointFeaturesSupport,
        @inject(TYPES.IDebuggeeBreakpointsSetter) private readonly _targetBreakpoints: IDebuggeeBreakpointsSetter) {
        this.doesTargetSupportColumnBreakpointsCached = this._breakpointFeaturesSupport.supportsColumnBreakpoints;
    }

    public async mapBPRecipe(bpRecipe: BPRecipeInLoadedSource<ConditionalPause | AlwaysPause>, onlyKeepIfScript: (script: IScript) => boolean = () => true): Promise<BPRecipeInScript[]> {
        const tokensInManyScripts = bpRecipe.location.tokensWhenMappedToScript().filter(tokens => onlyKeepIfScript(tokens.script));
        return asyncMap(tokensInManyScripts, async manyTokensInScript => {
            const bestLocation = await this.doesTargetSupportColumnBreakpointsCached
                ? await this.findBestLocationForBP(manyTokensInScript.enclosingRange)
                : manyTokensInScript.enclosingRange.start; // If we don't support column breakpoints we set the breakpoint at the start of the range
            const bpRecipeAtBestLocation = new BPRecipeInScript(bpRecipe.unmappedBPRecipe, bestLocation);
            return bpRecipeAtBestLocation;
        });
    }

    private async findBestLocationForBP(range: RangeInScript): Promise<LocationInScript> {
        const possibleLocations = await this._targetBreakpoints.getPossibleBreakpoints(range);

        if (possibleLocations.length > 0) {
            // I'm assuming that the first location will always be the earliest/leftmost location. If that is not the case we'll need to fix this code
            const choosenLocation = possibleLocations[0];
            if (possibleLocations.length === 1) {
                logger.verbose(`Breakpoint at ${range} mapped to the only option: ${choosenLocation}`);
            } else {
                logger.verbose(`Breakpoint at ${range} can be mapped to ${printArray('many options:', possibleLocations)}. Chose the first one: ${choosenLocation}`);
            }

            return choosenLocation;
        } else {
            // TODO: Report telemetry here
            /**
             * If trying to search for the exact range doesn't work, expand the range to include the whole line, and try to find the first place
             * to break just before the start of our range...
             */
            const lineNumber = range.start.position.lineNumber;
            const wholeLineRange = RangeInResource.wholeLine(range.resource, lineNumber);
            const manyPossibleLocations = await this._targetBreakpoints.getPossibleBreakpoints(wholeLineRange);
            return ChromeUtils.selectBreakpointLocation(lineNumber, range.start.position.columnNumber, manyPossibleLocations);
        }
    }
}
