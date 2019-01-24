import { ISource } from '../sources/source';
import { Location, ScriptOrSourceOrURLOrURLRegexp, LocationInUrl, LocationInUrlRegexp, LocationInScript, ILocation } from '../locations/location';
import { ILoadedSource } from '../sources/loadedSource';
import { IScript } from '../scripts/script';
import { IBPActionWhenHit, AlwaysBreak } from './bpActionWhenHit';
import { utils } from '../../..';
import { CDTPScriptUrl } from '../sources/resourceIdentifierSubtypes';
import { IResourceIdentifier, URL } from '../sources/resourceIdentifier';
import { URLRegexp, createURLRegexp } from '../locations/subtypes';
import { IEquivalenceComparable } from '../../utils/equivalence';

export interface IBPRecipie<TResource extends ScriptOrSourceOrURLOrURLRegexp, TBPActionWhenHit extends IBPActionWhenHit = IBPActionWhenHit>
    extends IEquivalenceComparable {
    readonly location: Location<TResource>;
    readonly bpActionWhenHit: TBPActionWhenHit;

    readonly unmappedBPRecipie: AnyBPRecipie; // Original bpRecipie before any mapping was done
}

export type AnyBPRecipie = IBPRecipie<ScriptOrSourceOrURLOrURLRegexp>;

abstract class BPRecipieCommonLogic<TResource extends ScriptOrSourceOrURLOrURLRegexp, TBPActionWhenHit extends IBPActionWhenHit = IBPActionWhenHit> {
    public abstract get bpActionWhenHit(): TBPActionWhenHit;

    constructor(
        public readonly location: Location<TResource>) { }

    public toString(): string {
        return `BP @ ${this.location} do: ${this.bpActionWhenHit}`;
    }
}

abstract class UnmappedBPRecipieCommonLogic<TResource extends ScriptOrSourceOrURLOrURLRegexp, TBPActionWhenHit extends IBPActionWhenHit = IBPActionWhenHit>
    extends BPRecipieCommonLogic<TResource, TBPActionWhenHit> {

    public get unmappedBPRecipie(): IBPRecipie<TResource, TBPActionWhenHit> {
        return this;
    }

    public isEquivalentTo(right: IBPRecipie<TResource>): boolean {
        // TODO: Figure out how to remove the <ILocation<TResource>> casts
        return (<ILocation<TResource>>this.location).isEquivalentTo(<ILocation<TResource>>right.location)
            && this.bpActionWhenHit.isEquivalentTo(right.bpActionWhenHit);
    }

    constructor(
        location: Location<TResource>,
        public readonly bpActionWhenHit: TBPActionWhenHit) {
        super(location);
    }
}

abstract class MappedBPRecipieCommonLogic<TResource extends ScriptOrSourceOrURLOrURLRegexp, TBPActionWhenHit extends IBPActionWhenHit = IBPActionWhenHit> {
    public get bpActionWhenHit(): TBPActionWhenHit {
        return this.unmappedBPRecipie.bpActionWhenHit;
    }

    public isEquivalentTo(right: IBPRecipie<TResource, TBPActionWhenHit>): boolean {
        return (<ILocation<TResource>>this.location).isEquivalentTo(<ILocation<TResource>>right.location)
            && right.unmappedBPRecipie.isEquivalentTo(this.unmappedBPRecipie);
    }

    constructor(public readonly unmappedBPRecipie: IBPRecipie<ISource, TBPActionWhenHit>,
        public readonly location: Location<TResource>) { }

    public toString(): string {
        return `BP @ ${this.location} do: ${this.bpActionWhenHit}`;
    }
}

export class BPRecipieInSource<TBPActionWhenHit extends IBPActionWhenHit = IBPActionWhenHit> extends UnmappedBPRecipieCommonLogic<ISource, TBPActionWhenHit> implements IBPRecipie<ISource, TBPActionWhenHit> {
    public withAlwaysBreakAction(): BPRecipieInSource<AlwaysBreak> {
        return new BPRecipieInSource<AlwaysBreak>(this.location, new AlwaysBreak());
    }

    public tryResolvingSource<R>(
        succesfulAction: (breakpointInLoadedSource: BPRecipieInLoadedSource) => R,
        failedAction: (breakpointInUnbindedSource: BPRecipieInSource) => R): R {
        return this.location.tryResolvingSource(
            locationInLoadedSource => succesfulAction(new BPRecipieInLoadedSource(this, locationInLoadedSource)),
            () => failedAction(this));
    }

    public resolvedToLoadedSource(): BPRecipieInLoadedSource {
        return this.tryResolvingSource(
            breakpointInLoadedSource => breakpointInLoadedSource,
            () => { throw new Error(`Failed to convert ${this} into a breakpoint in a loaded source`); });
    }

    public resolvedWithLoadedSource(source: ILoadedSource<string>): BPRecipieInLoadedSource {
        return new BPRecipieInLoadedSource(this, this.location.resolvedWith(source));
    }
}

export class BPRecipieInLoadedSource<TBPActionWhenHit extends IBPActionWhenHit = IBPActionWhenHit>
    extends MappedBPRecipieCommonLogic<ILoadedSource, TBPActionWhenHit> implements IBPRecipie<ILoadedSource, TBPActionWhenHit> {

    public mappedToScript(): BPRecipieInScript<TBPActionWhenHit>[] {
        return this.location.mappedToScript().map(location => new BPRecipieInScript<TBPActionWhenHit>(this.unmappedBPRecipie, location));
    }
}

export type IBreakpointRecipieInLoadedSource = IBPRecipie<ILoadedSource>;
export type IBreakpointRecipieInUnbindedSource = IBPRecipie<ISource>;

// TODO: Are we missing the IBPActionWhenHit parameter here?
export type BPRecipie<TResource extends ScriptOrSourceOrURLOrURLRegexp> =
    TResource extends ISource ? BPRecipieInSource :
    TResource extends ILoadedSource ? BPRecipieInLoadedSource :
    TResource extends IScript ? BPRecipieInScript :
    TResource extends IResourceIdentifier ? BPRecipieInUrl :
    TResource extends URLRegexp ? BPRecipieInUrlRegexp :
    never;

export class BPRecipieInScript<TBPActionWhenHit extends IBPActionWhenHit = IBPActionWhenHit>
    extends MappedBPRecipieCommonLogic<IScript, TBPActionWhenHit> implements IBPRecipie<IScript, TBPActionWhenHit> {

    public withLocationReplaced(newLocation: LocationInScript): BPRecipieInScript<TBPActionWhenHit> {
        return new BPRecipieInScript<TBPActionWhenHit>(this.unmappedBPRecipie, newLocation);
    }

    public mappedToUrlRegexp(): BPRecipieInUrlRegexp<TBPActionWhenHit> {
        const urlRegexp = createURLRegexp(utils.pathToRegex(this.location.script.url, `${Math.random() * 100000000000000}`));
        return new BPRecipieInUrlRegexp<TBPActionWhenHit>(this.unmappedBPRecipie,
            new LocationInUrlRegexp(urlRegexp, this.location.position));
    }

    public mappedToUrl(): BPRecipieInUrl<TBPActionWhenHit> {
        const url = this.location.script.runtimeSource.identifier;
        return new BPRecipieInUrl<TBPActionWhenHit>(this.unmappedBPRecipie,
            new LocationInUrl(url, this.location.position));
    }
}

export class BPRecipieInUrl<TBPActionWhenHit extends IBPActionWhenHit = IBPActionWhenHit>
    extends MappedBPRecipieCommonLogic<URL<CDTPScriptUrl>, TBPActionWhenHit> implements IBPRecipie<URL<CDTPScriptUrl>, TBPActionWhenHit> {
}

export class BPRecipieInUrlRegexp<TBPActionWhenHit extends IBPActionWhenHit = IBPActionWhenHit>
    extends MappedBPRecipieCommonLogic<URLRegexp, TBPActionWhenHit> implements IBPRecipie<URLRegexp, TBPActionWhenHit> {
}
