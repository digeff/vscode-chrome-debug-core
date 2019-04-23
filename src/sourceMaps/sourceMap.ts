/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { SourceMapConsumer, MappedPosition, NullablePosition, RawSourceMap } from 'source-map';
import * as path from 'path';

import * as sourceMapUtils from './sourceMapUtils';
import * as utils from '../utils';
import { logger } from 'vscode-debugadapter';
import { IPathMapping } from '../debugAdapterInterfaces';
import { Position } from '../chrome/internal/locations/location';
import { createLineNumber, createColumnNumber, LineNumber, ColumnNumber } from '../chrome/internal/locations/subtypes';
import { newResourceIdentifierMap, IResourceIdentifier, parseResourceIdentifier, parseResourceIdentifiers, newResourceIdentifierSet } from '../chrome/internal/sources/resourceIdentifier';
import * as _ from 'lodash';
import { IValidatedMap } from '../chrome/collections/validatedMap';
import { Range } from '../chrome/internal/locations/rangeInScript';
import { SetUsingProjection } from '../chrome/collections/setUsingProjection';

export type MappedPosition = MappedPosition;

/**
 * A pair of the original path in the sourcemap, and the full absolute path as inferred
 */
export interface ISourcePathDetails {
    originalPath: IResourceIdentifier;
    inferredPath: IResourceIdentifier;
    startPosition: IGeneratedPosition;
}

export interface NonNullablePosition extends NullablePosition {
    line: number;
    column: number;
    lastColumn: number | null;
}

export interface IAuthoredPosition {
    source: IResourceIdentifier;
    line: LineNumber;
    column: ColumnNumber;
}

export interface IGeneratedPosition {
    source: IResourceIdentifier;
    line: LineNumber;
    column: ColumnNumber;
}

class SourcePathMappingCalculator {
    public constructor(private _sourceMap: SourceMap, private _originalSourceRoot: string | undefined,
        private _originalSourcesInOrder: string[], private readonly _normalizedSourcesInOrder: IResourceIdentifier[]) { }

    /**
     * Returns list of ISourcePathDetails for all sources in this sourcemap, sorted by their
     * positions within the sourcemap.
     */
    public get allSourcePathDetails(): ISourcePathDetails[] {
        // Lazy compute because the source-map lib handles the bulk of the sourcemap parsing lazily, and this info
        // is not always needed.
        return this._normalizedSourcesInOrder.map((inferredPath: IResourceIdentifier, i: number) => {
            const originalSource = this._originalSourcesInOrder[i];
            const originalPath = this._originalSourceRoot
                ? sourceMapUtils.getFullSourceEntry(this._originalSourceRoot, originalSource)
                : originalSource;
            return <ISourcePathDetails>{
                inferredPath,
                originalPath,
                startPosition: this._sourceMap.generatedPositionFor(inferredPath, 0, 0)
            };
        }).sort((a, b) => {
            // https://github.com/Microsoft/vscode-chrome-debug/issues/353
            if (!a.startPosition) {
                logger.log(`Could not map start position for: ${a.inferredPath}`);
                return -1;
            } else if (!b.startPosition) {
                logger.log(`Could not map start position for: ${b.inferredPath}`);
                return 1;
            }

            if (a.startPosition.line === b.startPosition.line) {
                return a.startPosition.column - b.startPosition.column;
            } else {
                return a.startPosition.line - b.startPosition.line;
            }
        });
    }
}

export class SourceMap {
    private readonly _sourcePathMappingCalculator: SourcePathMappingCalculator;

    public constructor(
        private readonly _generatedPath: string,
        sourceMap: RawSourceMap,
        normalizedSourcesInOrder: IResourceIdentifier[],
        private readonly _sources: SetUsingProjection<IResourceIdentifier, string>, // list of authored files (absolute paths)
        private readonly _smc: SourceMapConsumer // the source map
    ) {
        this._sourcePathMappingCalculator = new SourcePathMappingCalculator(this, sourceMap.sourceRoot, sourceMap.sources, normalizedSourcesInOrder);
    }

    /**
     * generatedPath: an absolute local path or a URL
     * json: sourcemap contents as string
     */
    public static create(generatedPath: string, json: string, pathMapping?: IPathMapping,
        sourceMapPathOverrides?: utils.IStringDictionary<string>, isVSClient = false): Promise<SourceMap> {
        const sourceMap: RawSourceMap = JSON.parse(json);
        logger.log(`SourceMap: creating for ${generatedPath}`);
        logger.log(`SourceMap: sourceRoot: ${sourceMap.sourceRoot}`);
        if (sourceMap.sourceRoot && sourceMap.sourceRoot.toLowerCase() === '/source/') {
            logger.log('Warning: if you are using gulp-sourcemaps < 2.0 directly or indirectly, you may need to set sourceRoot manually in your build config, if your files are not actually under a directory called /source');
        }
        logger.log(`SourceMap: sources: ${JSON.stringify(sourceMap.sources)}`);
        if (pathMapping) {
            logger.log(`SourceMap: pathMapping: ${JSON.stringify(pathMapping)}`);
        }

        // Absolute path
        const computedSourceRoot = sourceMapUtils.getComputedSourceRoot(sourceMap.sourceRoot, generatedPath, pathMapping);

        // sm.sources are initially relative paths, file:/// urls, made-up urls like webpack:///./app.js, or paths that start with /.
        // resolve them to file:/// urls, using computedSourceRoot, to be simpler and unambiguous, since
        // it needs to look them up later in exactly the same format.
        const normalizedSources = sourceMap.sources.map(sourcePath => {
            if (sourceMapPathOverrides) {
                const fullSourceEntry = sourceMapUtils.getFullSourceEntry(sourceMap.sourceRoot, sourcePath);
                const mappedFullSourceEntry = sourceMapUtils.applySourceMapPathOverrides(fullSourceEntry.textRepresentation, sourceMapPathOverrides, isVSClient);
                if (fullSourceEntry.textRepresentation !== mappedFullSourceEntry) {
                    return mappedFullSourceEntry;
                }
            }

            return path.resolve(computedSourceRoot, sourcePath);
        });
        const identifiers = parseResourceIdentifiers(normalizedSources);

        // Overwrite the sourcemap's sourceRoot with the version that's resolved to an absolute path,
        // so the work above only has to be done once
        sourceMap.sourceRoot = undefined;

        const setOfNormalizedSources = newResourceIdentifierSet(identifiers);

        const normalizedSourceMap = Object.assign({}, sourceMap, { sources: identifiers.map(i => i.canonicalized) });
        return new SourceMapConsumer(normalizedSourceMap).then(sourceMapConsumer => {
            sourceMapConsumer.computeColumnSpans(); // So allGeneratedPositionsFor will return the last column info
            return new SourceMap(generatedPath, sourceMap, parseResourceIdentifiers(sourceMapConsumer.sources), setOfNormalizedSources, sourceMapConsumer);
        });
    }

    /**
     * Returns list of ISourcePathDetails for all sources in this sourcemap, sorted by their
     * positions within the sourcemap.
     */
    public get allSourcePathDetails(): ISourcePathDetails[] {
        return this._sourcePathMappingCalculator.allSourcePathDetails;
    }

    /*
     * Return all mapped sources as absolute paths
     */
    public get mappedSources(): IResourceIdentifier[] {
        return Array.from(this._sources.keys());
    }

    /*
     * Finds the nearest source location for the given location in the generated file.
     * Will return null instead of a mapping on the next line (different from generatedPositionFor).
     */
    public authoredPosition<T>(line: number, column: number, whenMappedAction: (position: IAuthoredPosition) => T, noMappingAction: () => T): T {
        const lookupArgs = {
            line: line + 1, // source-map lib uses 1-indexed lines.
            column
        };

        const authoredPosition = this.tryInBothDirections(lookupArgs, args => this._smc.originalPositionFor(args));

        if (typeof authoredPosition.source === 'string' && typeof authoredPosition.line === 'number' && typeof authoredPosition.column === 'number') {
            const source = this._sources.get(parseResourceIdentifier(authoredPosition.source));
            return whenMappedAction({
                source,
                line: createLineNumber(authoredPosition.line - 1), // Back to 0-indexed lines
                column: createColumnNumber(authoredPosition.column)
            });
        } else {
            return noMappingAction();
        }
    }

    /*
     * Finds the nearest location in the generated file for the given source location.
     * Will return a mapping on the next line, if there is no subsequent mapping on the expected line.
     */
    public generatedPositionFor(source: IResourceIdentifier, line: number, column: number): IGeneratedPosition {
        const lookupArgs = {
            line: line + 1, // source-map lib uses 1-indexed lines.
            column,
            source: source.canonicalized
        };

        const position = this.tryInBothDirections(lookupArgs, args => this._smc.generatedPositionFor(args));

        if (typeof position.line === 'number' && typeof position.column === 'number') {
            return {
                line: createLineNumber(position.line - 1), // Back to 0-indexed lines
                column: createColumnNumber(position.column),
                source: parseResourceIdentifier(this._generatedPath)
            };
        } else {
            throw new Error(`Couldn't find generated position for ${JSON.stringify(lookupArgs)}`);
        }
    }

    private tryInBothDirections<T extends { line: number }, R extends { line: number | null }>(args: T, action: (argsWithBias: T & { bias?: number }) => R): R {
        const goForward = Object.assign({}, args, { bias: (<any>SourceMapConsumer).LEAST_UPPER_BOUND });
        const result = action(goForward);
        if (typeof result.line === 'number') {
            return result;
        } else {
            const goBackwards = Object.assign({}, args, { bias: (<any>SourceMapConsumer).GREATEST_LOWER_BOUND });
            return action(goBackwards);
        }
    }

    private isNonNullablePosition(position: NullablePosition): position is NonNullablePosition {
        return position.line !== null && position.column != null;
    }

    public allGeneratedPositionFor(source: IResourceIdentifier, line: number, column: number): NonNullablePosition[] {
        const lookupArgs = {
            line: line + 1, // source-map lib uses 1-indexed lines.
            column,
            source: source.canonicalized
        };

        const positions = this.allGeneratedPositionsForBothDirections(lookupArgs);

        const validPositions = <NonNullablePosition[]>positions.filter(p => this.isNonNullablePosition(p));
        if (validPositions.length < positions.length) {
            const invalidPositions = _.difference(positions, validPositions);
            logger.log(`WARNING: Some source map positions for: ${JSON.stringify(lookupArgs)} were discarded because they weren't valid: ${JSON.stringify(invalidPositions)}`);
        }

        return validPositions.map(position => ({
            line: position.line - 1, // Back to 0-indexed lines
            column: position.column,
            lastColumn: position.lastColumn
        }));
    }

    private allGeneratedPositionsForBothDirections(originalPosition: MappedPosition): NullablePosition[] {
        const positions = this._smc.allGeneratedPositionsFor(originalPosition);
        if (positions.length !== 0) {
            return positions;
        } else {
            const position = this.tryInBothDirections(originalPosition, args => this._smc.generatedPositionFor(args));
            return [position];
        }
    }

    public rangesInSources(): IValidatedMap<IResourceIdentifier, Range> {
        // IMPORTANT TODO: Analyze the performance of the DA for large source maps. We'll probably need to not call this._smc!.eachMapping,
        // or call it async instead of blocking other things...
        const sourceToRange = newResourceIdentifierMap<Range>();
        const memoizedParseResourceIdentifier = _.memoize(parseResourceIdentifier);
        this._smc!.eachMapping(mapping => {
            if (typeof mapping.originalLine === 'number' && typeof mapping.originalColumn === 'number' && typeof mapping.source === 'string') {
                // Mapping's line numbers are 1-based so we substract one (columns are 0-based)
                const positionInSource = new Position(createLineNumber(mapping.originalLine - 1), createColumnNumber(mapping.originalColumn));
                const sourceIdentifier = memoizedParseResourceIdentifier(mapping.source);
                const range = sourceToRange.getOr(sourceIdentifier, () => new Range(positionInSource, positionInSource));
                const expandedRange = new Range(
                    Position.appearingFirstOf(range.start, positionInSource),
                    Position.appearingLastOf(range.exclusiveEnd, positionInSource));
                sourceToRange.setAndReplaceIfExist(sourceIdentifier, expandedRange);
            } else {
                /**
                 * TODO: Report some telemetry. We've seen the line numbers and source be null in the Webpack scenario of our integration tests
                 * There are probably more scenarios like these
                 */
            }
        });

        return sourceToRange;
    }

    public destroy(): void {
        this._smc.destroy();
    }
}
