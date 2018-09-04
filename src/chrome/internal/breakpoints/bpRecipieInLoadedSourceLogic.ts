import { BPRecipieInLoadedSource, BPRecipie, BPRecipieInScript, BPRecipieInUrl, BPRecipieInUrlRegexp, URLRegexp } from './bpRecipie';
import { ConditionalBreak, AlwaysBreak } from './bpActionWhenHit';
import { IBreakpoint, Breakpoint } from './breakpoint';
import { ScriptOrSourceOrIdentifierOrUrlRegexp, LocationInScript, ZeroBasedLocation } from '../locations/locationInResource';
import { ISourceResolver } from '../sources/sourceResolver';
import { chromeUtils, logger } from '../../..';
import { ColumnNumber, LineNumber } from '../locations/subtypes';
import { RangeInScript } from '../locations/rangeInScript';
import { BreakpointsRegistry } from './breakpointsRegistry';
import { IScript } from '../scripts/script';
import { IResourceIdentifier } from '../sources/resourceIdentifier';

export interface BPRInLoadedSourceLogicDependencies {
    setBreakpoint(params: BPRecipieInScript<AlwaysBreak | ConditionalBreak>): Promise<Breakpoint<IScript>>;
    setBreakpointByUrl(params: BPRecipieInUrl<AlwaysBreak | ConditionalBreak>): Promise<Breakpoint<IResourceIdentifier>[]>;
    setBreakpointByUrlRegexp(params: BPRecipieInUrlRegexp<AlwaysBreak | ConditionalBreak>): Promise<Breakpoint<URLRegexp>[]>;
    getPossibleBreakpoints(params: RangeInScript): Promise<LocationInScript[]>;
    removeBreakpoint(params: BPRecipie<ISourceResolver>): Promise<void>;
    doesTargetSupportColumnBreakpoints(): Promise<boolean>;
}

export class BPRecipieInLoadedSourceLogic {
    private readonly doesTargetSupportColumnBreakpointsCached: Promise<boolean>;

    public async addBreakpoint(bpRecipie: BPRecipieInLoadedSource<ConditionalBreak | AlwaysBreak>): Promise<IBreakpoint<ScriptOrSourceOrIdentifierOrUrlRegexp>[]> {
        const bpInScriptRecipie = bpRecipie.asBPInScriptRecipie();
        const bestLocation = await this.considerColumnAndSelectBestBPLocation(bpInScriptRecipie.locationInResource);
        const bpRecipieInBestLocation = bpInScriptRecipie.atLocation(bestLocation);

        const runtimeSource = bpInScriptRecipie.locationInResource.script.runtimeSource;
        this._breakpointRegistry.registerBPRecipie(bpRecipie);

        let breakpoints: IBreakpoint<ScriptOrSourceOrIdentifierOrUrlRegexp>[];
        if (!runtimeSource.doesScriptHasUrl()) {
            breakpoints = [await this._dependencies.setBreakpoint(bpRecipieInBestLocation)];
        } else if (runtimeSource.identifier.isLocalFilePath()) {
            breakpoints = await this._dependencies.setBreakpointByUrlRegexp(bpRecipieInBestLocation.asBPInUrlRegexpRecipie());
        } else { // The script has a URL and it's not a local file path, so we can leave it as-is
            breakpoints = await this._dependencies.setBreakpointByUrl(bpRecipieInBestLocation.asBPInUrlRecipie());
        }

        breakpoints.forEach(breakpoint => this._breakpointRegistry.registerBreakpointAsBinded(breakpoint));
        return breakpoints;
    }

    public removeBreakpoint(bpRecipie: BPRecipie<ISourceResolver>): Promise<void> {
        return this._dependencies.removeBreakpoint(bpRecipie);
    }

    private async considerColumnAndSelectBestBPLocation(location: LocationInScript): Promise<LocationInScript> {
        if (await this.doesTargetSupportColumnBreakpointsCached) {
            const thisLineStart = new ZeroBasedLocation(location.location.lineNumber, 0 as ColumnNumber);
            const nextLineStart = new ZeroBasedLocation((location.location.lineNumber + 1) as LineNumber, 0 as ColumnNumber);
            const thisLineRange = new RangeInScript(location.script, thisLineStart, nextLineStart);

            const possibleLocations = await this._dependencies.getPossibleBreakpoints(thisLineRange);

            if (possibleLocations.length > 0) {
                const bestLocation = chromeUtils.selectBreakpointLocation(location.lineNumber, location.columnNumber, possibleLocations);
                logger.verbose(`PossibleBreakpoints: Best location for ${location} is ${bestLocation}`);
                return bestLocation;
            }
        }

        return location;
    }

    constructor(
        private readonly _dependencies: BPRInLoadedSourceLogicDependencies,
        private readonly _breakpointRegistry: BreakpointsRegistry) {
        this.doesTargetSupportColumnBreakpointsCached = this._dependencies.doesTargetSupportColumnBreakpoints();
    }
}