/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { BasePathTransformer } from '../../../transformers/basePathTransformer';
import { BaseSourceMapTransformer } from '../../../transformers/baseSourceMapTransformer';
import { ScriptCallFrame } from '../stackTraces/callFrame';
import { PausedEvent } from '../../cdtpDebuggee/eventsProviders/cdtpDebuggeeExecutionEventsProvider';
import { InformationAboutPausedProvider } from './takeProperActionOnPausedEvent';
import { logger } from 'vscode-debugadapter';
import { IComponent } from './feature';
import { LocationInLoadedSource } from '../locations/location';
import { ICallFramePresentationDetails } from '../stackTraces/callFramePresentation';
import { Abstained, VoteRelevance, VoteCommonLogic, IVote } from '../../communication/collaborativeDecision';
import * as nls from 'vscode-nls';
import { injectable, inject } from 'inversify';
import { IStackTracePresentationLogicProvider } from '../stackTraces/stackTracesLogic';
import { TYPES } from '../../dependencyInjection.ts/types';
import { utils, ConnectedCDAConfiguration } from '../../..';
const localize = nls.loadMessageBundle();

export interface IEventsConsumedBySmartStepLogic {
    subscriberForAskForInformationAboutPaused(listener: InformationAboutPausedProvider): void;
}

export interface ISmartStepLogicConfiguration {
    isEnabled: boolean;
}

export interface IShouldStepInToAvoidSkippedSourceDependencies {
    stepIntoDebugee(): Promise<void>;
}
export class ShouldStepInToAvoidSkippedSource extends VoteCommonLogic<void> {
    public readonly relevance = VoteRelevance.OverrideOtherVotes;

    private readonly _dependencies: IShouldStepInToAvoidSkippedSourceDependencies;

    public async execute(): Promise<void> {
        return this._dependencies.stepIntoDebugee();
    }
}

@injectable()
export class SmartStepLogic implements IComponent, IStackTracePresentationLogicProvider {
    private _smartStepCount = 0;
    private _isEnabled = false;

    public isEnabled(): boolean {
        return this._isEnabled;
    }

    public toggleEnabled(): void {
        this.enable(!this._isEnabled);
    }

    public enable(shouldEnable: boolean): void {
        this._isEnabled = shouldEnable;
    }

    public async toggleSmartStep(): Promise<void> {
        this.toggleEnabled();
        this.stepInIfOnSkippedSource();
    }

    public async askForInformationAboutPaused(paused: PausedEvent): Promise<IVote<void>> {
        if (this.isEnabled() && await this.shouldSkip(paused.callFrames[0])) {
            this._smartStepCount++;
            return new ShouldStepInToAvoidSkippedSource();
        } else {
            if (this._smartStepCount > 0) {
                logger.log(`SmartStep: Skipped ${this._smartStepCount} steps`);
                this._smartStepCount = 0;
            }
            return new Abstained(this);
        }
    }

    public stepInIfOnSkippedSource(): void {
        throw new Error('Not implemented TODO DIEGO');
    }

    public async shouldSkip(frame: ScriptCallFrame): Promise<boolean> {
        if (!this._isEnabled) return false;

        const clientPath = this._pathTransformer.getClientPathFromTargetPath(frame.location.script.runtimeSource.identifier)
            || frame.location.script.runtimeSource.identifier;
        const mapping = await this._sourceMapTransformer.mapToAuthored(clientPath.canonicalized, frame.codeFlow.lineNumber, frame.codeFlow.columnNumber);
        if (mapping) {
            return false;
        }

        if ((await this._sourceMapTransformer.allSources(clientPath.canonicalized)).length) {
            return true;
        }

        return false;
    }

    public getCallFrameAdditionalDetails(locationInLoadedSource: LocationInLoadedSource): ICallFramePresentationDetails[] {
        return this.isEnabled && !locationInLoadedSource.source.isMappedSource()
            ? [{
                additionalSourceOrigins: [localize('smartStepFeatureName', 'smartStep')],
                sourcePresentationHint: 'deemphasize'
            }]
            : [];
    }

    public install(): this {
        this._dependencies.subscriberForAskForInformationAboutPaused(paused => this.askForInformationAboutPaused(paused));
        this.configure();
        return this;
    }

    public configure(): void {
        this._isEnabled = !!utils.defaultIfUndefined(this._configuration.args.smartStep, this._configuration.isVSClient);
    }

    constructor(
        @inject(TYPES.EventsConsumedByConnectedCDA) private readonly _dependencies: IEventsConsumedBySmartStepLogic,
        @inject(TYPES.BasePathTransformer) private readonly _pathTransformer: BasePathTransformer,
        @inject(TYPES.BaseSourceMapTransformer) private readonly _sourceMapTransformer: BaseSourceMapTransformer,
        @inject(TYPES.ConnectedCDAConfiguration) private readonly _configuration: ConnectedCDAConfiguration
    ) {
    }
}