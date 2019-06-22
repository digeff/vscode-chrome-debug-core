import { RangeInResource, Range } from './rangeInScript';
import { LocationInScript } from './location';
import { printArray } from '../../collections/printing';
import { IFutureScript } from '../scripts/IFutureScript';
import { IScript } from '../scripts/script';

export interface IMappedTokensInScript<T extends IFutureScript = IFutureScript> {
    readonly script: T;
    readonly enclosingRange: RangeInResource<T>;

    isEmpty(): boolean;
}

export class MappedTokensInScript<T extends IFutureScript = IFutureScript> implements IMappedTokensInScript<T> {
    public constructor(public readonly script: T, private readonly _ranges: Range[]) {
        if (this._ranges.length === 0) {
            throw new Error(`Expected the mapped tokens to have a non empty list of ranges where the tokens are located`);
        }

        const emptyRanges = this._ranges.filter(range => range.isEmpty());
        if (emptyRanges.length > 0) {
            throw new Error(`Expected all the ranges of mapped tokens to have a list of non empty ranges, yet these ranges were empty: ${printArray('', emptyRanges)}`);
        }
    }

    public static characterAt(characterLocation: LocationInScript): IMappedTokensInScript<IScript> {
        return new MappedTokensInScript(characterLocation.script, [Range.at(characterLocation.position)]);
    }

    public static untilNextLine(characterLocation: LocationInScript): IMappedTokensInScript<IScript> {
        return new MappedTokensInScript(characterLocation.script, [Range.untilNextLine(characterLocation.position)]);
    }

    public get enclosingRange(): RangeInResource<T> {
        return new RangeInResource(this.script, Range.enclosingAll(this._ranges));
    }

    public isEmpty(): boolean {
        return false;
    }

    public toString(): string {
        return printArray('Mapped to script tokens at:', this._ranges);
    }
}

export class NoMappedTokensInScript<T extends IFutureScript = IFutureScript> implements IMappedTokensInScript<T> {
    public constructor(public readonly script: T) { }

    public get ranges(): never {
        throw new Error(`Can't get the ranges when the source mapped to no tokens on the script`);
    }

    public get enclosingRange(): never {
        throw new Error(`Can't get the enclosing range when the source mapped to no tokens on the script`);
    }

    public isEmpty(): boolean {
        return true;
    }

    public toString(): string {
        return `Didn't map to any script tokens`;
    }
}