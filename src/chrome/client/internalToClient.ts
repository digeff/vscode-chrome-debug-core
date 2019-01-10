/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { DebugProtocol } from 'vscode-debugprotocol';
import { utils, LineColTransformer, IExceptionInfoResponseBody } from '../..';
import * as pathModule from 'path';
import { ILoadedSource, ILoadedSourceTreeNode } from '../internal/sources/loadedSource';
import { LocationInLoadedSource } from '../internal/locations/location';
import { RemoveProperty } from '../../typeUtils';
import { IBPRecipeStatus, BPRecipeIsBound } from '../internal/breakpoints/bpRecipeStatus';
import { IBPRecipe } from '../internal/breakpoints/bpRecipe';
import { HandlesRegistry } from './handlesRegistry';
import { IExceptionInformation } from '../internal/exceptions/pauseOnException';
import { IFormattedExceptionLineDescription } from '../internal/formattedExceptionParser';
import { injectable, inject } from 'inversify';
import { TYPES } from '../dependencyInjection.ts/types';
import { Source } from 'vscode-debugadapter';
import { CallFramePresentation } from '../internal/stackTraces/callFramePresentation';
import { asyncMap } from '../collections/async';
import { ISource } from '../internal/sources/source';
import { IStackTracePresentationRow, StackTraceLabel } from '../internal/stackTraces/stackTracePresentationRow';

interface IClientLocationInSource {
    source: DebugProtocol.Source;
    line: number;
    column: number;
}

@injectable()
export class InternalToClient {
    public toStackFrames(rows: IStackTracePresentationRow[]): Promise<DebugProtocol.StackFrame[]> {
        return asyncMap(rows, row => this.toStackFrame(row));
    }

    public getFrameId(stackFrame: IStackTracePresentationRow): number {
        return this._handlesRegistry.frames.getIdByObject(stackFrame);
    }

    public async toStackFrame(stackFrame: IStackTracePresentationRow): Promise<DebugProtocol.StackFrame> {
        if (stackFrame instanceof CallFramePresentation) {
            const clientStackFrame: RemoveProperty<DebugProtocol.StackFrame, 'line' | 'column'> = {
                id: this.getFrameId(stackFrame),
                name: stackFrame.description,
                presentationHint: stackFrame.presentationHint
            };

            const result = await this.toLocationInSource(stackFrame.location, clientStackFrame);
            return result;
        } else if (stackFrame instanceof StackTraceLabel) {
            return {
                id: this.getFrameId(stackFrame),
                name: `[${stackFrame.description}]`,
                presentationHint: 'label'
            } as DebugProtocol.StackFrame;
        } else {
            throw new Error(`Expected stack frames to be either call frame presentations or label frames, yet it was: ${stackFrame}`);
        }
    }

    private toSourceLeafs(sources: ILoadedSourceTreeNode[]): Promise<DebugProtocol.Source[]> {
        return Promise.all(sources.map(source => this.toSourceTree(source)));
    }

    public async toSourceTree(sourceMetadata: ILoadedSourceTreeNode): Promise<DebugProtocol.Source> {
        const source = await this.toSource(sourceMetadata.mainSource);
        (source as any).sources = await this.toSourceLeafs(sourceMetadata.relatedSources);
        return source;
    }

    public async toSource(loadedSource: ILoadedSource): Promise<Source> {
        const exists = await utils.existsAsync(loadedSource.identifier.canonicalized);

        // if the path exists, do not send the sourceReference
        // new Source sends 0 for undefined
        const source: Source = {
            name: pathModule.basename(loadedSource.identifier.textRepresentation),
            path: loadedSource.identifier.textRepresentation,
            sourceReference: exists ? undefined : this._handlesRegistry.sources.getIdByObject(loadedSource),
        };

        return source;
    }

    public async toLocationInSource<T = {}>(locationInSource: LocationInLoadedSource, objectToUpdate: T): Promise<T & IClientLocationInSource> {
        const source = await this.toSource(locationInSource.source);
        const clientLocationInSource = { source, line: locationInSource.position.lineNumber, column: locationInSource.position.columnNumber };
        this._lineColTransformer.convertDebuggerLocationToClient(clientLocationInSource);
        return Object.assign(objectToUpdate, clientLocationInSource);
    }

    public async toBPRecipeStatus(bpRecipeStatus: IBPRecipeStatus): Promise<DebugProtocol.Breakpoint> {
        const clientStatus = {
            id: this.toBreakpointId(bpRecipeStatus.recipe),
            verified: bpRecipeStatus.isVerified(),
            message: bpRecipeStatus.statusDescription
        };

        if (bpRecipeStatus instanceof BPRecipeIsBound) {
            await this.toLocationInSource(bpRecipeStatus.actualLocationInSource, clientStatus);
        }

        return clientStatus;
    }

    public toBreakpointId(recipe: IBPRecipe<ISource>): number {
        return this._handlesRegistry.breakpoints.getIdByObject(recipe);
    }

    public isZeroBased(): boolean {
        const objWithLine = { line: 0 };
        this._lineColTransformer.convertDebuggerLocationToClient(objWithLine);
        return objWithLine.line === 0;
    }

    public toExceptionInfo(info: IExceptionInformation): IExceptionInfoResponseBody {
        return {
            exceptionId: info.exceptionId,
            description: info.description,
            breakMode: info.breakMode,
            details: {
                message: info.details.message,
                formattedDescription: info.details.formattedDescription,
                stackTrace: this.toExceptionStackTracePrintted(info.details.stackTrace),
                typeName: info.details.typeName,
            }
        };
    }

    public toExceptionStackTracePrintted(formattedExceptionLines: IFormattedExceptionLineDescription[]): string {
        const stackTraceLines = formattedExceptionLines.map(line => line.generateDescription(this.isZeroBased()));
        const stackTracePrintted = stackTraceLines.join('\n') + '\n';
        return stackTracePrintted;
    }

    constructor(
        @inject(HandlesRegistry) private readonly _handlesRegistry: HandlesRegistry,
        @inject(TYPES.LineColTransformer) private readonly _lineColTransformer: LineColTransformer) { }
}