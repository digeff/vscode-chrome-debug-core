/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { ILoadedSource } from '../internal/sources/loadedSource';
import { BPRecipeInSource } from '../internal/breakpoints/bpRecipeInSource';
import { DebugProtocol } from 'vscode-debugprotocol';
import { SourcesLogic } from '../internal/sources/sourcesLogic';
import { Position, LocationInSource } from '../internal/locations/location';
import { LineColTransformer } from '../../transformers/lineNumberTransformer';
import { BPRecipesInSource } from '../internal/breakpoints/bpRecipes';
import { IBPActionWhenHit, AlwaysPause, ConditionalPause } from '../internal/breakpoints/bpActionWhenHit';
import { HandlesRegistry } from './handlesRegistry';
import { createLineNumber, createColumnNumber } from '../internal/locations/subtypes';
import { parseResourceIdentifier } from '../internal/sources/resourceIdentifier';
import {  PauseOnAllExceptions, PauseOnUnhandledExceptions, DoNotPauseOnAnyExceptions, PauseOnAllRejections, DoNotPauseOnAnyRejections, IPauseOnExceptionsStrategy, IPauseOnPromiseRejectionsStrategy } from '../internal/exceptions/strategies';
import { injectable, inject } from 'inversify';
import { TYPES } from '../dependencyInjection.ts/types';
import { ISource, SourceAlreadyResolvedToLoadedSource } from '../internal/sources/source';
import { IStackTracePresentationRow } from '../internal/stackTraces/stackTracePresentationRow';

@injectable()
export class ClientToInternal {
    public toPauseOnExceptionsStrategy(exceptionFilters: string[]): IPauseOnExceptionsStrategy {
        if (exceptionFilters.indexOf('all') >= 0) {
            return new PauseOnAllExceptions();
        } else if (exceptionFilters.indexOf('uncaught') >= 0) {
            return new PauseOnUnhandledExceptions();
        } else {
            return new DoNotPauseOnAnyExceptions();
        }
    }

    public toPauseOnPromiseRejectionsStrategy(exceptionFilters: string[]): IPauseOnPromiseRejectionsStrategy {
        if (exceptionFilters.indexOf('promise_reject') >= 0) {
            return new PauseOnAllRejections();
        } else {
            return new DoNotPauseOnAnyRejections();
        }
    }

    // V1 reseted the frames on an onPaused event. Figure out if that is the right thing to do
    public getCallFrameById(frameId: number): IStackTracePresentationRow {
        return this._handlesRegistry.frames.getObjectById(frameId);
    }

    public getSourceFromId(handle: number): ILoadedSource {
        return this._handlesRegistry.sources.getObjectById(handle);
    }

    public toSource(clientSource: DebugProtocol.Source): ISource {
        if (clientSource.path && !clientSource.sourceReference) {
            const identifier = parseResourceIdentifier(clientSource.path);
            return this._sourcesLogic.createSourceResolver(identifier);
        } else if (clientSource.sourceReference) {
            const source = this.getSourceFromId(clientSource.sourceReference);
            return new SourceAlreadyResolvedToLoadedSource(source);
        } else {
            throw new Error(`Expected the source to have a path (${clientSource.path}) either-or a source reference (${clientSource.sourceReference})`);
        }
    }

    public toBPRecipes(args: DebugProtocol.SetBreakpointsArguments): BPRecipesInSource {
        const source = this.toSource(args.source);
        const breakpoints = args.breakpoints.map(breakpoint => this.toBPRecipe(source, breakpoint));
        return new BPRecipesInSource(source, breakpoints);
    }

    public toBPRecipe(source: ISource, clientBreakpoint: DebugProtocol.SourceBreakpoint): BPRecipeInSource {
        return new BPRecipeInSource(
            new LocationInSource(source, this.toLocation(clientBreakpoint)),
            this.toBPActionWhenHit(clientBreakpoint));
    }

    public toLocation(location: { line: number; column?: number; }): Position {
        const lineNumber = createLineNumber(this._lineColTransformer.convertClientLineToDebugger(location.line));
        const columnNumber = location.column !== undefined ? createColumnNumber(this._lineColTransformer.convertClientColumnToDebugger(location.column)) : undefined;
        return new Position(lineNumber, columnNumber);
    }

    public toBPActionWhenHit(actionWhenHit: { condition?: string; hitCondition?: string; logMessage?: string; }): IBPActionWhenHit {
        let howManyDefined = 0;
        howManyDefined += actionWhenHit.condition ? 1 : 0;
        howManyDefined += actionWhenHit.hitCondition ? 1 : 0;
        howManyDefined += actionWhenHit.logMessage ? 1 : 0;
        if (howManyDefined === 0) {
            return new AlwaysPause();
        } else if (howManyDefined === 1) {
            if (actionWhenHit.condition) {
                return new ConditionalPause(actionWhenHit.condition);
            } else if (actionWhenHit.hitCondition) {
                return new ConditionalPause(actionWhenHit.hitCondition);
            } else if (actionWhenHit.logMessage) {
                return new ConditionalPause(actionWhenHit.logMessage);
            } else {
                throw new Error(`Couldn't parse the desired action when hit for the breakpoint: 'condition' (${actionWhenHit.condition}), 'hitCondition' (${actionWhenHit.hitCondition}) or 'logMessage' (${actionWhenHit.logMessage})`);
            }
        } else { // howManyDefined >= 2
            throw new Error(`Expected a single one of 'condition' (${actionWhenHit.condition}), 'hitCondition' (${actionWhenHit.hitCondition}) and 'logMessage' (${actionWhenHit.logMessage}) to be defined, yet multiple were defined.`);
        }
    }

    constructor(
        @inject(HandlesRegistry) private readonly _handlesRegistry: HandlesRegistry,
        @inject(TYPES.LineColTransformer) private readonly _lineColTransformer: LineColTransformer,
        private readonly _sourcesLogic: SourcesLogic) { }
}