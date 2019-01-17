import { LineNumber, ColumnNumber, createColumnNumber, createLineNumber } from '../locations/subtypes';
import { SourceMap } from '../../../sourceMaps/sourceMap';

export interface ISourceToScriptMapper {
    getPositionInScript(positionInSource: IPositionInSource): IPositionInScript | null;
}

export interface ISourcesMapper extends ISourceToScriptMapper {
    readonly sources: string[];
    getPositionInSource(positionInScript: IPositionInScript): IPositionInSource | null;
}

interface IPositionInSource {
    readonly source: string;
    readonly line: LineNumber;
    readonly column?: ColumnNumber;
}

interface IPositionInScript {
    readonly line: LineNumber;
    readonly column?: ColumnNumber;
}

/** This class maps locations from a script into the sources form which it was compiled, and back. */
export class SourcesMapper implements ISourcesMapper {
    public getPositionInSource(positionInScript: IPositionInScript): IPositionInSource | null {
        const mappedPosition = this._sourceMap.authoredPositionFor(positionInScript.line, positionInScript.column || 0);
        return mappedPosition && mappedPosition.source && mappedPosition.line
            ? { source: mappedPosition.source, line: createLineNumber(mappedPosition.line), column: createColumnNumber(mappedPosition.column) }
            : null;
    }

    public getPositionInScript(positionInSource: IPositionInSource): IPositionInScript | null {
        const mappedPosition = this._sourceMap.generatedPositionFor(positionInSource.source,
            positionInSource.line, positionInSource.column || 0);
        return mappedPosition && mappedPosition.line
            ? { line: createLineNumber(mappedPosition.line), column: createColumnNumber(mappedPosition.column) }
            : null;
    }

    public get sources(): string[] {
        return this._sourceMap.authoredSources || [];
    }

    constructor(private readonly _sourceMap: SourceMap) { }

}

export class NoSourceMapping implements ISourcesMapper {
    public getPositionInSource(_: IPositionInScript): null {
        return null;
    }

    public getPositionInScript(_: IPositionInSource): null {
        return null;
    }

    public get sources(): [] {
        return [];
    }
}