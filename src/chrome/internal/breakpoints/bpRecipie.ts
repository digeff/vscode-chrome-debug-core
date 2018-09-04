import { ISourceResolver } from '../sources/sourceResolver';
import { LocationInResource, ScriptOrSourceOrIdentifierOrUrlRegexp, LocationInUrl, LocationInUrlRegexp, LocationInScript } from '../locations/locationInResource';
import { ILoadedSource } from '../sources/loadedSource';
import { IScript } from '../scripts/script';
import { IBPActionWhenHit } from './bpActionWhenHit';
import { utils } from '../../..';
import { IResourceIdentifier } from '../sources/resourceIdentifier';

export interface IBPRecipie<TResource extends ScriptOrSourceOrIdentifierOrUrlRegexp, Behavior extends IBPActionWhenHit = IBPActionWhenHit> {
    readonly locationInResource: LocationInResource<TResource>;
    readonly behavior: Behavior;

    readonly unmappedBpRecipie: IBPRecipie<ScriptOrSourceOrIdentifierOrUrlRegexp>; // Original bpRecipie before any mapping was done
}

abstract class BreakpointRecipieCommonLogic<TResource extends ScriptOrSourceOrIdentifierOrUrlRegexp, BehaviorRecipie extends IBPActionWhenHit = IBPActionWhenHit> {
    public abstract get behavior(): BehaviorRecipie;

    constructor(
        public readonly locationInResource: LocationInResource<TResource>) { }

    public toString(): string {
        return `BP @ ${this.locationInResource} do: ${this.behavior}`;
    }
}

abstract class UnamppedBreakpointRecipieCommonLogic<TResource extends ScriptOrSourceOrIdentifierOrUrlRegexp, BehaviorRecipie extends IBPActionWhenHit = IBPActionWhenHit>
    extends BreakpointRecipieCommonLogic<TResource, BehaviorRecipie> {

    public get unmappedBpRecipie(): IBPRecipie<TResource, BehaviorRecipie> {
        return this;
    }

    constructor(
        locationInResource: LocationInResource<TResource>,
        public readonly behavior: BehaviorRecipie) {
        super(locationInResource);
    }
}

abstract class MappedBreakpointRecipieCommonLogic<TResource extends ScriptOrSourceOrIdentifierOrUrlRegexp, BehaviorRecipie extends IBPActionWhenHit = IBPActionWhenHit> {
    public get behavior(): BehaviorRecipie {
        return this.unmappedBpRecipie.behavior;
    }

    constructor(public readonly unmappedBpRecipie: IBPRecipie<ISourceResolver, BehaviorRecipie>,
        public readonly locationInResource: LocationInResource<TResource>) { }

    public toString(): string {
        return `BP @ ${this.locationInResource} do: ${this.behavior}`;
    }
}

export class BPRecipieInLoadedSource<BehaviorRecipie extends IBPActionWhenHit = IBPActionWhenHit>
    extends MappedBreakpointRecipieCommonLogic<ILoadedSource, BehaviorRecipie> implements IBPRecipie<ILoadedSource, BehaviorRecipie> {

    public asBPInScriptRecipie(): BPRecipieInScript<BehaviorRecipie> {
        return new BPRecipieInScript<BehaviorRecipie>(this.unmappedBpRecipie, this.locationInResource.asLocationInScript());
    }
}

export class BPRecipieInUnbindedSource<BehaviorRecipie extends IBPActionWhenHit = IBPActionWhenHit> extends UnamppedBreakpointRecipieCommonLogic<ISourceResolver, BehaviorRecipie> implements IBPRecipie<ISourceResolver, BehaviorRecipie> {
    public tryGettingBreakpointInLoadedSource<R>(
        whenSuccesfulDo: (breakpointInLoadedSource: BPRecipieInLoadedSource) => R,
        whenFailedDo: (breakpointInUnbindedSource: BPRecipieInUnbindedSource) => R): R {
        return this.locationInResource.tryGettingLocationInLoadedSource(
            locationInLoadedSource => whenSuccesfulDo(new BPRecipieInLoadedSource(this, locationInLoadedSource)),
            () => whenFailedDo(this));
    }

    public asBreakpointInLoadedSource(): BPRecipieInLoadedSource {
        return this.tryGettingBreakpointInLoadedSource(
            breakpointInLoadedSource => breakpointInLoadedSource,
            () => { throw new Error(`Failed to convert ${this} into a breakpoint in a loaded source`); });
    }

    public asBreakpointWithLoadedSource(source: ILoadedSource<string>): BPRecipieInLoadedSource {
        return new BPRecipieInLoadedSource(this, this.locationInResource.asLocationWithLoadedSource(source));
    }
}

export type IBreakpointRecipieInLoadedSource = IBPRecipie<ILoadedSource>;
export type IBreakpointRecipieInUnbindedSource = IBPRecipie<ISourceResolver>;

export type BPRecipie<TResource extends ScriptOrSourceOrIdentifierOrUrlRegexp> =
    TResource extends ISourceResolver ? BPRecipieInUnbindedSource :
    TResource extends ILoadedSource ? BPRecipieInLoadedSource :
    TResource extends IScript ? BPRecipieInScript :
    TResource extends IResourceIdentifier ? BPRecipieInUrl :
    TResource extends URLRegexp ? BPRecipieInUrlRegexp :
    never;

export class BPRecipieInScript<BehaviorRecipie extends IBPActionWhenHit = IBPActionWhenHit>
    extends MappedBreakpointRecipieCommonLogic<IScript, BehaviorRecipie> implements IBPRecipie<IScript, BehaviorRecipie> {

    public atLocation(newLocation: LocationInScript): BPRecipieInScript<BehaviorRecipie> {
        return new BPRecipieInScript<BehaviorRecipie>(this.unmappedBpRecipie, newLocation);
    }

    public asBPInUrlRegexpRecipie(): BPRecipieInUrlRegexp<BehaviorRecipie> {
        const urlRegexp = new URLRegexp(utils.pathToRegex(this.locationInResource.script.url));
        return new BPRecipieInUrlRegexp<BehaviorRecipie>(this.unmappedBpRecipie,
            new LocationInUrlRegexp(urlRegexp, this.locationInResource.location));
    }

    public asBPInUrlRecipie(): BPRecipieInUrl<BehaviorRecipie> {
        const url = this.locationInResource.script.runtimeSource.identifier;
        return new BPRecipieInUrl<BehaviorRecipie>(this.unmappedBpRecipie,
            new LocationInUrl(url, this.locationInResource.location));
    }
}

export class BPRecipieInUrl<BehaviorRecipie extends IBPActionWhenHit = IBPActionWhenHit>
    extends MappedBreakpointRecipieCommonLogic<IResourceIdentifier, BehaviorRecipie> implements IBPRecipie<IResourceIdentifier, BehaviorRecipie> {
}

export class BPRecipieInUrlRegexp<BehaviorRecipie extends IBPActionWhenHit = IBPActionWhenHit>
    extends MappedBreakpointRecipieCommonLogic<URLRegexp, BehaviorRecipie> implements IBPRecipie<URLRegexp, BehaviorRecipie> {
}

export class URLRegexp {
    constructor(public readonly textRepresentation: string) { }

    public toString(): string {
        return `BP @ ${this.textRepresentation}`;
    }
}