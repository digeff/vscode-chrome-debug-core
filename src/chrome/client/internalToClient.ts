/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { DebugProtocol } from 'vscode-debugprotocol';
import { utils, LineColTransformer, IExceptionInfoResponseBody } from '../..';
import * as pathModule from 'path';
import { asyncAdaptToSinglIntoToMulti } from '../../utils';
import { ILoadedSource, ILoadedSourceTreeNode } from '../internal/sources/loadedSource';
import { LocationInLoadedSource } from '../internal/locations/location';
import { RemoveProperty } from '../../typeUtils';
import { IBPRecipieStatus } from '../internal/breakpoints/bpRecipieStatus';
import { IBPRecipie } from '../internal/breakpoints/bpRecipie';
import { HandlesRegistry } from './handlesRegistry';
import { IExceptionInformation } from '../internal/exceptions/pauseOnException';
import { IFormattedExceptionLineDescription } from '../internal/formattedExceptionParser';
import { injectable, inject } from 'inversify';
import { TYPES } from '../dependencyInjection.ts/types';
import { Source } from 'vscode-debugadapter';
import { IStackTracePresentationRow, StackTraceLabel } from '../internal/stackTraces/stackTracePresentationRow';
import { CallFramePresentation } from '../internal/stackTraces/callFramePresentation';

interface ClientLocationInSource {
    source: DebugProtocol.Source;
    line: number;
    column: number;
}

@injectable()
export class InternalToClient {
    public readonly toStackFrames = asyncAdaptToSinglIntoToMulti(this, this.toStackFrame);
    public readonly toSourceTrees = asyncAdaptToSinglIntoToMulti(this, this.toSourceTree);
    public readonly toBPRecipiesStatus = asyncAdaptToSinglIntoToMulti(this, this.toBPRecipieStatus);

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

    public async toLocationInSource<T = {}>(locationInSource: LocationInLoadedSource, objectToUpdate: T): Promise<T & ClientLocationInSource> {
        const source = await this.toSource(locationInSource.source);
        const clientLocationInSource = { source, line: locationInSource.position.lineNumber, column: locationInSource.position.columnNumber };
        this._lineColTransformer.convertDebuggerLocationToClient(clientLocationInSource);
        return Object.assign(objectToUpdate, clientLocationInSource);
    }

    public async toBPRecipieStatus(bpRecipieStatus: IBPRecipieStatus): Promise<DebugProtocol.Breakpoint> {
        const clientStatus = {
            id: this.toBreakpointId(bpRecipieStatus.recipie),
            verified: bpRecipieStatus.isVerified(),
            message: bpRecipieStatus.statusDescription
        };

        if (bpRecipieStatus.isBinded()) {
            await this.toLocationInSource(bpRecipieStatus.actualLocationInSource, clientStatus);
        }

        return clientStatus;
    }

    public toBreakpointId(recipie: IBPRecipie<ILoadedSource<string>>): number {
        return this._handlesRegistry.breakpoints.getIdByObject(recipie);
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