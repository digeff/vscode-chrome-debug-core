/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { BPRecipesInSource } from '../bpRecipes';
import { ILoadedSource } from '../../sources/loadedSource';
import { asyncMap } from '../../../collections/async';
import { BPRecipeIsUnboundDueToNoSubstatuses, BPRecipeHasBoundSubstatuses } from '../bpRecipeStatus';
import { newResourceIdentifierMap, IResourceIdentifier } from '../../sources/resourceIdentifier';
import { IEventsToClientReporter } from '../../../client/eventSender';
import { promiseDefer, IPromiseDefer } from '../../../../utils';
import { IComponentWithAsyncInitialization } from '../../features/components';
import { injectable, inject } from 'inversify';
import { IBreakpointsInLoadedSource } from './bpRecipeAtLoadedSourceLogic';
import { TYPES } from '../../../dependencyInjection.ts/types';
import { ValidatedSet } from '../../../collections/validatedSet';
import { IScriptParsedProvider } from '../../../cdtpDebuggee/eventsProviders/cdtpOnScriptParsedEventProvider';
import { DebuggeeBPRsSetForClientBPRFinder } from '../registries/debuggeeBPRsSetForClientBPRFinder';
import { ClientCurrentBPRecipesRegistry } from '../registries/clientCurrentBPRecipesRegistry';
import { ValidatedMap } from '../../../collections/validatedMap';
import { BPRecipeInSource } from '../bpRecipeInSource';
import { BreakpointsRegistry } from '../registries/breakpointsRegistry';
import { wrapWithMethodLogger } from '../../../logging/methodsCalledLogger';
import { IBPActionWhenHit } from '../bpActionWhenHit';
import { singleElementOfArray } from '../../../collections/utilities';
import { BPRecipeInScript } from '../baseMappedBPRecipe';
import { LocationInLoadedSource } from '../../locations/location';
import { IScript } from '../../scripts/script';

export interface IExistingBPsForJustParsedScriptSetterDependencies {
    onBPRecipeStatusChanged(bpRecipeInSource: BPRecipeInSource): void;
}

export class ExistingBPsForJustParsedScriptSetter {
    private readonly _sourcePathToBPRecipes = newResourceIdentifierMap<BPRecipesInSource>();
    private readonly _scriptToBPsAreSetDefer = new ValidatedMap<IScript, IPromiseDefer<void>>();

    public readonly withLogging = wrapWithMethodLogger(this);

    constructor(
        private readonly _dependencies: IExistingBPsForJustParsedScriptSetterDependencies,
        private readonly _scriptParsedProvider: IScriptParsedProvider,
        private readonly _debuggeeBPRsSetForClientBPRFinder: DebuggeeBPRsSetForClientBPRFinder,
        private readonly _clientCurrentBPRecipesRegistry: ClientCurrentBPRecipesRegistry,
        private readonly _breakpointsInLoadedSource: IBreakpointsInLoadedSource,
        private readonly _breakpointsRegistry: BreakpointsRegistry) {
        this._scriptParsedProvider.onScriptParsed(scriptParsed => this.withLogging.setBPsForScript(scriptParsed.script));
    }

    public waitUntilBPsAreSet(script: IScript): Promise<void> {
        const doesScriptHaveAnyBPRecipes = script.allSources.find(source => this._clientCurrentBPRecipesRegistry.bpRecipesForSource(source.identifier).length >= 1);
        if (doesScriptHaveAnyBPRecipes) {
            return this.finishedSettingBPsForScriptDefer(script).promise;
        } else {
            const defer = this._scriptToBPsAreSetDefer.tryGetting(script);
            return Promise.resolve(defer && defer.promise);
        }
    }

    private finishedSettingBPsForScriptDefer(script: IScript): IPromiseDefer<void> {
        return this._scriptToBPsAreSetDefer.getOrAdd(script, () => promiseDefer<void>());
    }

    private async setBPsForScript(justParsedScript: IScript): Promise<void> {
        const defer = this.finishedSettingBPsForScriptDefer(justParsedScript);
        await asyncMap(justParsedScript.allSources, source => this.withLogging.setBPsFromSourceIntoScript(source, justParsedScript));
        defer.resolve();
    }

    private async setBPsFromSourceIntoScript(sourceWhichMayHaveBPs: ILoadedSource, justParsedScript: IScript): Promise<void> {
        const bpRecipesInSource = this._clientCurrentBPRecipesRegistry.bpRecipesForSource(sourceWhichMayHaveBPs.identifier);

        for (const bpRecipe of bpRecipesInSource) {
            await this.withLogging.setBPFromSourceIntoScriptIfNeeded(bpRecipe, justParsedScript, sourceWhichMayHaveBPs);
        }
    }

    private async setBPFromSourceIntoScriptIfNeeded(bpRecipe: BPRecipeInSource<IBPActionWhenHit>, justParsedScript: IScript, sourceWhichMayHaveBPs: ILoadedSource<string>) {
        const debuggeeBPRecipes = this._debuggeeBPRsSetForClientBPRFinder.findDebuggeeBPRsSet(bpRecipe);
        const bpRecepieResolved = bpRecipe.resolvedWithLoadedSource(sourceWhichMayHaveBPs);
        const runtimeLocationsWhichAlreadyHaveThisBPR = debuggeeBPRecipes.map(recipe => recipe.runtimeSourceLocation);

        const bprInScripts = bpRecepieResolved.mappedToScript().filter(b => b.location.script === justParsedScript);
        await this.withLogging.setBPRsInScriptIfNeeded(bprInScripts, runtimeLocationsWhichAlreadyHaveThisBPR, bpRecipe);
    }

    private async setBPRsInScriptIfNeeded(bprInScripts: BPRecipeInScript[], runtimeLocationsWhichAlreadyHaveThisBPR: LocationInLoadedSource[], bpRecipe: BPRecipeInSource<IBPActionWhenHit>) {
        for (const bprInScript of bprInScripts) {
            await this.withLogging.setBPRInScriptFromSourceIntoScriptIfNeeded(bprInScript, runtimeLocationsWhichAlreadyHaveThisBPR, bpRecipe);
        }
    }

    private async setBPRInScriptFromSourceIntoScriptIfNeeded(bprInScript: BPRecipeInScript, runtimeLocationsWhichAlreadyHaveThisBPR: LocationInLoadedSource[], bpRecipe: BPRecipeInSource<IBPActionWhenHit>) {
        const bprInRuntimeSource = bprInScript.mappedToRuntimeSource();
        // Was the breakpoint already set for the runtime source of this script? (This will happen if we include the same script twice in the same debuggee)
        if (!runtimeLocationsWhichAlreadyHaveThisBPR.some(location => location.isEquivalentTo(bprInRuntimeSource.location))) {
            try {
                const bpStatus = await this._breakpointsInLoadedSource.addBreakpointAtLoadedSource(bprInRuntimeSource);
                const mappedBreakpoints = bpStatus.map(breakpoint => breakpoint.mappedToSource());
                this._breakpointsRegistry.bpRecipeIsBoundForRuntimeSource(bpRecipe, bprInRuntimeSource.location, mappedBreakpoints);
            }
            catch (exception) {
                this._breakpointsRegistry.bpRecipeIsUnboundForRuntimeSource(bpRecipe, bprInRuntimeSource.location, exception);
            }
        }
    }

    public toString(): string {
        return `ExistingBPsForJustParsedScriptSetter`;
    }
}