import * as Validation from '../../../validation';
import * as utils from '../../../utils';
import { IScript, isScript } from '../scripts/script';
import { ISource, isSource } from '../sources/source';
import { ILoadedSource, isLoadedSource } from '../sources/loadedSource';
import { logger } from 'vscode-debugadapter';
import { ColumnNumber, LineNumber, URLRegexp, createURLRegexp, createLineNumber, createColumnNumber } from './subtypes';
import { CDTPScriptUrl } from '../sources/resourceIdentifierSubtypes';
import { IResourceIdentifier, parseResourceIdentifier, URL } from '../sources/resourceIdentifier';
import { IEquivalenceComparable } from '../../utils/equivalence';
import { printArray } from '../../collections/printing';
import { breakWhileDebugging } from '../../../validation';

export type integer = number;

export class Position implements IEquivalenceComparable {
    constructor(
        public readonly lineNumber: LineNumber,
        public readonly columnNumber?: ColumnNumber) {
        Validation.zeroOrPositive('Line number', lineNumber);
        if (columnNumber !== undefined) {
            Validation.zeroOrPositive('Column number', columnNumber);
        }
    }

    public isEquivalentTo(location: Position): boolean {
        return this.lineNumber === location.lineNumber
            && this.columnNumber === location.columnNumber;
    }

    public toString(): string {
        return this.columnNumber !== undefined
            ? `${this.lineNumber}:${this.columnNumber}`
            : `${this.lineNumber}`;
    }
}

export interface ILocation<T extends ScriptOrSourceOrURLOrURLRegexp> extends IEquivalenceComparable {
    readonly position: Position;
    readonly resource: T;
}

export type ScriptOrSourceOrURLOrURLRegexp = IScript | ILoadedSource | ISource | URLRegexp | URL<CDTPScriptUrl>;

export type Location<T extends ScriptOrSourceOrURLOrURLRegexp> =
    T extends ISource ? LocationInSource : // Used when receiving locations from the client
    T extends ILoadedSource ? LocationInLoadedSource : // Used to translate between locations on the client and the debugee
    T extends IScript ? LocationInScript : // Used when receiving locations from the debugee
    T extends URLRegexp ? LocationInUrlRegexp : // Used when setting a breakpoint by URL in a local file path in windows, to make it case insensitive
    T extends URL<CDTPScriptUrl> ? LocationInUrl : // Used when setting a breakpoint by URL for case-insensitive URLs
    ILocation<never>; // TODO: Figure out how to replace this by never (We run into some issues with the isEquivalentTo call if we do)

export function createLocation<T extends ScriptOrSourceOrURLOrURLRegexp>(resource: T, position: Position): Location<T> {
    if (isSource(resource)) {
        return <Location<T>>new LocationInSource(resource, position); // TODO: Figure out how to remove this cast
    } else if (isScript(resource)) {
        return <Location<T>>new LocationInScript(resource, position);
    } else if (isLoadedSource(resource)) {
        return <Location<T>>new LocationInLoadedSource(resource, position);
    } else {
        Validation.breakWhileDebugging();
        throw new Error(`Support for resource ${resource} hasn't been implemented yet`);
    }
}

abstract class LocationCommonLogic<T extends ScriptOrSourceOrURLOrURLRegexp> implements ILocation<T> {
    public isEquivalentTo(right: this): boolean {
        if (this.position.isEquivalentTo(right.position)) {
            if (typeof this.resource === 'string' || typeof right.resource === 'string') {
                return this.resource === right.resource;
            } else {
                return (<any>this.resource).isEquivalentTo(right.resource); // TODO: Make this any safer
            }
            return true;
        }
        return false;
    }

    public toString(): string {
        return `${this.resource}:${this.position}`;
    }

    constructor(
        public readonly resource: T,
        public readonly position: Position) { }
}

export class LocationInSource extends LocationCommonLogic<ISource> implements ILocation<ISource> {
    public get identifier(): ISource {
        return this.resource;
    }

    public tryResolvingSource<R>(
        whenSuccesfulDo: (locationInLoadedSource: LocationInLoadedSource) => R,
        whenFailedDo: (locationInSource: LocationInSource) => R): R {
        return this.identifier.tryResolving(
            loadedSource => whenSuccesfulDo(new LocationInLoadedSource(loadedSource, this.position)),
            () => whenFailedDo(this));
    }

    public resolvedWith(loadedSource: ILoadedSource): LocationInLoadedSource {
        if (this.resource.sourceIdentifier.isEquivalentTo(loadedSource.identifier)) {
            return new LocationInLoadedSource(loadedSource, this.position);
        } else {
            throw new Error(`Can't resolve a location with a source (${this}) to a location with a loaded source that doesn't match the unresolved source: ${loadedSource}`);
        }
    }
}

export class LocationInScript extends LocationCommonLogic<IScript> {
    public mappedToUrlRegexp(): LocationInUrlRegexp {
        // DIEGO TODO: Use a better regexp id
        const urlRegexp = createURLRegexp(utils.pathToRegex(this.script.url, `${Math.random() * 100000000000000}`));
        return new LocationInUrlRegexp(urlRegexp, this.script.rangeInSource.start.position);
    }

    public get script(): IScript {
        return this.resource;
    }

    public mappedToSource(): LocationInLoadedSource {
        const mapped = this.script.sourcesMapper.getPositionInSource({ line: this.position.lineNumber, column: this.position.columnNumber });
        if (mapped) {
            const loadedSource = this.script.getSource(parseResourceIdentifier(mapped.source));
            const result = new LocationInLoadedSource(loadedSource, new Position(mapped.line, mapped.column));
            logger.verbose(`SourceMap: ${this} to ${result}`);
            return result;
        } else {
            return new LocationInLoadedSource(this.script.developmentSource, this.position);
        }
    }

    public isSameAs(locationInScript: LocationInScript): boolean {
        return this.script === locationInScript.script &&
            this.position.isEquivalentTo(locationInScript.position);
    }

    public toString(): string {
        return `${this.resource}:${this.position}`;
    }
}

export class LocationInLoadedSource extends LocationCommonLogic<ILoadedSource> {
    public get source(): ILoadedSource {
        return this.resource;
    }

    public mappedToScript(): LocationInScript[] {
        const mappedLocations = this.source.currentScriptRelationships().scripts.map(script => {
            const positionInScriptRelativeToScript = script.sourcesMapper.getPositionInScript({
                source: this.source.identifier.textRepresentation,
                line: this.position.lineNumber,
                column: this.position.columnNumber
            });

            const scriptPositionInResource = script.rangeInSource.start.position;

            // All the lines need to be adjusted by the relative position of the script in the resource (in an .html if the script starts in line 20, the first line is 20 rather than 0)
            const lineNumberRelativeToEntireResource = createLineNumber(positionInScriptRelativeToScript.line + scriptPositionInResource.lineNumber);

            // The columns on the first line need to be adjusted. Columns on all other lines don't need any adjustment.
            const columnNumberRelativeToEntireResource = createColumnNumber((positionInScriptRelativeToScript.line === 0 ? scriptPositionInResource.columnNumber : 0) + positionInScriptRelativeToScript.column);

            const locationInScript = positionInScriptRelativeToScript ? new LocationInScript(script, new Position(lineNumberRelativeToEntireResource, columnNumberRelativeToEntireResource)) : null;
            return locationInScript;
        }).filter(position => !!position);
        if (mappedLocations.length) {
            logger.verbose(printArray(`SourceMap: ${this} to `, mappedLocations));
            return mappedLocations;
        } else {
            breakWhileDebugging();
            throw new Error(`Couldn't map the location (${this.position}) in the source $(${this.source}) to a script file`);
        }
    }
}

export class LocationInUrl extends LocationCommonLogic<IResourceIdentifier<CDTPScriptUrl>> {
    public get url(): URL<CDTPScriptUrl> {
        return this.resource;
    }
}

export class LocationInUrlRegexp extends LocationCommonLogic<URLRegexp> {
    public get urlRegexp(): URLRegexp {
        return this.resource;
    }
}
