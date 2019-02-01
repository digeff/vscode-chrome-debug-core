import { createColumnNumber, createLineNumber } from '../locations/subtypes';
import { SourceMap } from '../../../sourceMaps/sourceMap';
import { IScript } from './script';
import { ILoadedSource } from '../sources/loadedSource';
import { LocationInScript, LocationInLoadedSource, Position } from '../locations/location';
import { parseResourceIdentifier } from '../sources/resourceIdentifier';

export interface ISourceToScriptMapper {
    getPositionInScript(positionInSource: LocationInLoadedSource): LocationInScript | null;
}

export interface IScriptToSourceMapper {
    getPositionInSource(positionInScript: LocationInScript): LocationInLoadedSource | null;
}

export interface ISourceMapper extends ISourceToScriptMapper, IScriptToSourceMapper { }

export interface IMappedSourcesMapper extends ISourceMapper {
    readonly sources: string[];
}

/** This class maps locations from a script into the sources form which it was compiled, and back. */
export class MappedSourcesMapper implements IMappedSourcesMapper {
    public getPositionInSource(positionInScript: LocationInScript): LocationInLoadedSource | null {
        const scriptPositionInResource = this._script.rangeInSource.start.position;

        // All the lines need to be adjusted by the relative position of the script in the resource (in an .html if the script starts in line 20, the first line is 20 rather than 0)
        const lineNumberRelativeToScript = positionInScript.position.lineNumber - scriptPositionInResource.lineNumber;

        // The columns on the first line need to be adjusted. Columns on all other lines don't need any adjustment.
        const columnNumberRelativeToScript = (lineNumberRelativeToScript === 0 ? scriptPositionInResource.columnNumber : 0) + (positionInScript.position.columnNumber || 0);

        const mappedPosition = this._sourceMap.authoredPositionFor(lineNumberRelativeToScript, columnNumberRelativeToScript);

        if (mappedPosition && mappedPosition.source && mappedPosition.line) {
            const position = new Position(createLineNumber(mappedPosition.line), createColumnNumber(mappedPosition.column));
            return new LocationInLoadedSource(positionInScript.script.getSource(parseResourceIdentifier(mappedPosition.source)), position);
        } else {
            return null;
        }
    }

    public getPositionInScript(positionInSource: LocationInLoadedSource): LocationInScript | null {
        const mappedPositionRelativeToScript = this._sourceMap.generatedPositionFor(positionInSource.source.identifier.textRepresentation,
            positionInSource.position.lineNumber, positionInSource.position.columnNumber || 0);

        if (mappedPositionRelativeToScript && mappedPositionRelativeToScript.line) {

            const scriptPositionInResource = this._script.rangeInSource.start.position;

            // All the lines need to be adjusted by the relative position of the script in the resource (in an .html if the script starts in line 20, the first line is 20 rather than 0)
            const lineNumberRelativeToEntireResource = createLineNumber(mappedPositionRelativeToScript.line + scriptPositionInResource.lineNumber);

            // The columns on the first line need to be adjusted. Columns on all other lines don't need any adjustment.
            const columnNumberRelativeToEntireResource = createColumnNumber((mappedPositionRelativeToScript.line === 0 ? scriptPositionInResource.columnNumber : 0) + mappedPositionRelativeToScript.column);

            const position = new Position(createLineNumber(lineNumberRelativeToEntireResource), createColumnNumber(columnNumberRelativeToEntireResource));
            return new LocationInScript(this._script, position);
        } else {
            return null;
        }
    }

    public get sources(): string[] {
        return this._sourceMap.authoredSources || [];
    }

    constructor(private readonly _script: IScript, private readonly _sourceMap: SourceMap) { }
}

export class NoMappedSourcesMapper implements IMappedSourcesMapper {
    constructor(private readonly _script: IScript) {

    }

    public getPositionInSource(positionInScript: LocationInScript): LocationInLoadedSource {
        return new LocationInLoadedSource(this._script.developmentSource, positionInScript.position);
    }

    public getPositionInScript(positionInSource: LocationInLoadedSource): LocationInScript {
        if (positionInSource.resource === this._script.developmentSource || positionInSource.resource === this._script.runtimeSource) {
            return new LocationInScript(this._script, positionInSource.position);
        } else {
            throw new Error(`This source mapper can only map locations from the runtime or development scripts of ${this._script} yet the location provided was ${positionInSource}`);
        }
    }

    public get sources(): string[] {
        return [];
    }
}

export class UnmappedSourceMapper implements ISourceMapper {
    public getPositionInSource(positionInScript: LocationInScript): LocationInLoadedSource {
        return new LocationInLoadedSource(this._source, positionInScript.position);
    }

    public getPositionInScript(positionInSource: LocationInLoadedSource): LocationInScript {
        return new LocationInScript(this._script, positionInSource.position);
    }

    constructor(private readonly _script: IScript, private readonly _source: ILoadedSource) { }
}
