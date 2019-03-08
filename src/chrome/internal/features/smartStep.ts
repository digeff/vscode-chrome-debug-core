/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { BasePathTransformer } from '../../../transformers/basePathTransformer';
import { BaseSourceMapTransformer } from '../../../transformers/baseSourceMapTransformer';
import { ScriptCallFrame } from '../stackTraces/callFrame';
import { PausedEvent } from '../../cdtpDebuggee/eventsProviders/cdtpDebuggeeExecutionEventsProvider';
import { BaseNotifyClientOfPause, ActionToTakeWhenPausedProvider, IActionToTakeWhenPaused, NoActionIsNeededForThisPause, BaseActionToTakeWhenPaused } from '../features/actionToTakeWhenPaused';
import { logger } from 'vscode-debugadapter';
import { IComponentWithAsyncInitialization } from './components';
import { LocationInLoadedSource } from '../locations/location';
import { ICallFramePresentationDetails } from '../stackTraces/callFramePresentation';
import * as nls from 'vscode-nls';
import { injectable, inject } from 'inversify';
import { IStackTracePresentationDetailsProvider } from '../stackTraces/stackTracePresenter';
import { TYPES } from '../../dependencyInjection.ts/types';
import { ConnectedCDAConfiguration } from '../../client/chromeDebugAdapter/cdaConfiguration';
import * as utils from '../../../utils';
import { IDebuggeePausedHandler } from './debuggeePausedHandler';
const localize = nls.loadMessageBundle();

export interface ISmartStepLogicConfiguration {
    isEnabled: boolean;
}

export interface IShouldStepInToAvoidSkippedSourceDependencies {
    stepIntoDebugee(): Promise<void>;
}
export class ShouldStepInToAvoidSkippedSource extends BaseActionToTakeWhenPaused {
    private readonly _dependencies: IShouldStepInToAvoidSkippedSourceDependencies;

    public async execute(): Promise<void> {
        return this._dependencies.stepIntoDebugee();
    }
}

@injectable()
export class SmartStepLogic implements IStackTracePresentationDetailsProvider {
    private _smartStepCount = 0;
    private _isEnabled = false;

    constructor(
        @inject(TYPES.IDebuggeePausedHandler) private readonly _debuggeePausedHandler: IDebuggeePausedHandler,
        @inject(TYPES.BasePathTransformer) private readonly _pathTransformer: BasePathTransformer,
        @inject(TYPES.BaseSourceMapTransformer) private readonly _sourceMapTransformer: BaseSourceMapTransformer,
        @inject(TYPES.ConnectedCDAConfiguration) private readonly _configuration: ConnectedCDAConfiguration
    ) {
        this._debuggeePausedHandler.registerActionProvider(paused => this.onProvideActionForWhenPaused(paused));
        this.configure();
    }

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

    public async onProvideActionForWhenPaused(paused: PausedEvent): Promise<IActionToTakeWhenPaused> {
        if (this.isEnabled() && await this.shouldSkip(paused.callFrames[0])) {
            this._smartStepCount++;
            return new ShouldStepInToAvoidSkippedSource();
        } else {
            if (this._smartStepCount > 0) {
                logger.log(`SmartStep: Skipped ${this._smartStepCount} steps`);
                this._smartStepCount = 0;
            }
            return new NoActionIsNeededForThisPause(this);
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

    public callFrameAdditionalDetails(locationInLoadedSource: LocationInLoadedSource): ICallFramePresentationDetails[] {
        return this.isEnabled && !locationInLoadedSource.source.isMappedSource()
            ? [{
                additionalSourceOrigins: [localize('smartStepFeatureName', 'smartStep')],
                sourcePresentationHint: 'deemphasize'
            }]
            : [];
    }

    public configure(): void {
        this._isEnabled = !!utils.defaultIfUndefined(this._configuration.args.smartStep, this._configuration.isVSClient);
    }
}