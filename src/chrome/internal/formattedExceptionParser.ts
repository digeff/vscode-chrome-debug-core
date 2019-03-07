/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { LocationInScript, LocationInLoadedSource } from './locations/location';
import { IResourceIdentifier, parseResourceIdentifier } from './sources/resourceIdentifier';
import { CDTPScriptUrl } from './sources/resourceIdentifierSubtypes';
import { createLineNumber, createColumnNumber } from './locations/subtypes';
import { DeleteMeScriptsRegistry } from './scripts/scriptsRegistry';
import { Position } from '../internal/locations/location';

export interface IFormattedExceptionLineDescription {
    generateDescription(zeroBaseNumbers: boolean): string;
}

class CodeFlowFrameDescription implements IFormattedExceptionLineDescription {
    constructor(
        public readonly cdtpDescription: string,
        public readonly scriptLocation: LocationInScript,
        public readonly sourceLocation: LocationInLoadedSource) { }

    public generateDescription(zeroBaseNumbers: boolean): string {
        return this.cdtpDescription.replace(
            this.printLocation(this.scriptLocation.script.url, this.scriptLocation.position, false),
            this.printLocation(this.sourceLocation.source.identifier.textRepresentation, this.sourceLocation.position, zeroBaseNumbers));
    }

    private printLocation(locationIdentifier: string, coordinates: Position, zeroBaseNumbers: boolean): string {
        const constantToAdd = zeroBaseNumbers ? 0 : 1;
        return `${locationIdentifier}:${coordinates.lineNumber + constantToAdd}:${coordinates.columnNumber + constantToAdd}`;
    }
}

class UnparsableFrameDescription implements IFormattedExceptionLineDescription {
    constructor(
        public readonly cdtpDescription: string) { }

    public generateDescription(_zeroBaseNumbers: boolean): string {
        return this.cdtpDescription;
    }
}

export class FormattedExceptionParser {
    constructor(
        private readonly _scriptsLogic: DeleteMeScriptsRegistry,
        private readonly _formattedException: string) { }

    // We parse stack trace from `this.formattedException`, source map it and return a new string
    public async parse(): Promise<IFormattedExceptionLineDescription[]> {
        return this.exceptionLines().map(line => {
            const matches = line.match(/^\s+at (.*?)\s*\(?([^ ]+):(\d+):(\d+)\)?$/);
            if (matches) {
                const url = parseResourceIdentifier(matches[2]) as IResourceIdentifier<CDTPScriptUrl>;
                const lineNumber = parseInt(matches[3], 10);
                const zeroBasedLineNumber = createLineNumber(lineNumber - 1);
                const columnNumber = createColumnNumber(parseInt(matches[4], 10));
                const zeroBasedColumnNumber = createColumnNumber(columnNumber - 1);
                const scripts = this._scriptsLogic.getScriptsByPath(url);
                if (scripts.length > 0) {
                    const scriptLocation = new LocationInScript(scripts[0], new Position(zeroBasedLineNumber, zeroBasedColumnNumber));
                    const location = scriptLocation.mappedToSource();
                    return new CodeFlowFrameDescription(line, scriptLocation, location);
                }
            }

            return new UnparsableFrameDescription(line);
        });
    }

    private exceptionLines() {
        return this._formattedException.split(/\r?\n/);
    }
}