/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { asyncMap } from '../../../collections/async';
import { ILoadedSource } from '../../sources/loadedSource';
import { IComponent } from '../../features/feature';
import { LocationInScript } from '../../locations/location';
import { IBreakpoint } from '../breakpoint';
import { NotifyStoppedCommonLogic, ResumeCommonLogic, InformationAboutPausedProvider } from '../../features/takeProperActionOnPausedEvent';
import { ReasonType } from '../../../stoppedEvent';
import { IVote, Abstained } from '../../../communication/collaborativeDecision';
import { injectable, inject } from 'inversify';
import { TYPES } from '../../../dependencyInjection.ts/types';
import { IEventsToClientReporter } from '../../../client/eventSender';
import { IDebugeeExecutionController } from '../../../cdtpDebuggee/features/cdtpDebugeeExecutionController';
import { ExistingBPsForJustParsedScriptSetter } from './existingBPsForJustParsedScriptSetter';
import { BreakpointsRegistry } from '../registries/breakpointsRegistry';
import { IDOMInstrumentationBreakpointsSetter } from '../../../cdtpDebuggee/features/cdtpDOMInstrumentationBreakpointsSetter';
import { IDebugeeRuntimeVersionProvider } from '../../../cdtpDebuggee/features/cdtpDebugeeRuntimeVersionProvider';
import { PausedEvent } from '../../../cdtpDebuggee/eventsProviders/cdtpDebuggeeExecutionEventsProvider';
import { IScript } from '../../scripts/script';
import { wrapWithMethodLogger } from '../../../logging/methodsCalledLogger';

export interface IPauseScriptLoadsToSetBPsDependencies {
    subscriberForAskForInformationAboutPaused(listener: InformationAboutPausedProvider): void;
    waitUntilUnboundBPsAreSet(loadedSource: ILoadedSource): Promise<void>;

    tryGettingBreakpointAtLocation(locationInScript: LocationInScript): IBreakpoint<IScript>[];
    publishGoingToPauseClient(): void;
}

export class HitStillPendingBreakpoint extends NotifyStoppedCommonLogic {
    protected reason: ReasonType = 'breakpoint';

    constructor(protected readonly _eventsToClientReporter: IEventsToClientReporter,
        protected readonly _publishGoingToPauseClient: () => void) {
        super();
    }
}

export class PausedWhileLoadingScriptToResolveBreakpoints extends ResumeCommonLogic {
    constructor(protected readonly _debugeeExecutionControl: IDebugeeExecutionController) {
        super();
    }
}

/// TODO: Move this to a browser-shared package
export class PauseScriptLoadsToSetBPs implements IComponent {
    private readonly stopsWhileScriptsLoadInstrumentationName = 'scriptFirstStatement';
    private _isInstrumentationEnabled = false;
    private _scriptFirstStatementStopsBeforeFile: boolean;

    public readonly withLogging = wrapWithMethodLogger(this);

    public async enableIfNeccesary(): Promise<void> {
        if (this._isInstrumentationEnabled === false) {
            await this.startPausingOnScriptFirstStatement();
        }
    }

    // TODO: Figure out if and when we can disable break on load for performance reasons
    public async disableIfNeccesary(): Promise<void> {
        if (this._isInstrumentationEnabled === true) {
            await this.stopPausingOnScriptFirstStatement();
        }
    }

    private async askForInformationAboutPaused(paused: PausedEvent): Promise<IVote<void>> {
        if (this.isInstrumentationPause(paused)) {
            await this._existingBPsForJustParsedScriptSetter.waitUntilBPsAreSet(paused.callFrames[0].location.script);

            // If we pause before starting the script, we can just resume, and we'll a breakpoint if it's on 0,0
            if (!this._scriptFirstStatementStopsBeforeFile) {
                // On Chrome 69 we pause inside the script, so we need to check if there is a breakpoint at 0,0 that we need to use
                const breakpoints = this._breakpointsRegistry.tryGettingBreakpointAtLocation(paused.callFrames[0].location);
                if (breakpoints.length > 0) {
                    return new HitStillPendingBreakpoint(this._eventsToClientReporter, this._dependencies.publishGoingToPauseClient);
                }
            }

            return new PausedWhileLoadingScriptToResolveBreakpoints(this._debugeeExecutionControl);
        } else {
            return new Abstained(this);
        }
    }

    private async startPausingOnScriptFirstStatement(): Promise<void> {
        try {
            this._isInstrumentationEnabled = true;
            await this._domInstrumentationBreakpoints.setInstrumentationBreakpoint({ eventName: this.stopsWhileScriptsLoadInstrumentationName });
        } catch (exception) {
            this._isInstrumentationEnabled = false;
            throw exception;
        }
    }

    private async stopPausingOnScriptFirstStatement(): Promise<void> {
        await this._domInstrumentationBreakpoints.removeInstrumentationBreakpoint({ eventName: this.stopsWhileScriptsLoadInstrumentationName });
        this._isInstrumentationEnabled = false;
    }

    private isInstrumentationPause(notification: PausedEvent): boolean {
        return (notification.reason === 'EventListener' && notification.data.eventName.startsWith('instrumentation:')) ||
            (notification.reason === 'ambiguous' && Array.isArray(notification.data.reasons) &&
                notification.data.reasons.every((r: any) => r.reason === 'EventListener' && r.auxData.eventName.startsWith('instrumentation:')));
    }

    public async install(): Promise<this> {
        this._dependencies.subscriberForAskForInformationAboutPaused(params => this.withLogging.askForInformationAboutPaused(params));
        // TODO DIEGO: Figure out exactly when we want to block on the browser version
        // On version 69 Chrome stopped sending an extra event for DOM Instrumentation: See https://bugs.chromium.org/p/chromium/issues/detail?id=882909
        // On Chrome 68 we were relying on that event to make Break on load work on breakpoints on the first line of a file. On Chrome 69 we need an alternative way to make it work.
        // TODO: Reenable the code that uses Versions.Target.Version when this fails
        const runtimeVersion = await this._debugeeVersionProvider.version();
        this._scriptFirstStatementStopsBeforeFile = !runtimeVersion.isAtLeastVersion('69.0.0');
        return this;
    }

    constructor(
        @inject(TYPES.EventsConsumedByConnectedCDA) private readonly _dependencies: IPauseScriptLoadsToSetBPsDependencies,
        @inject(TYPES.IDOMInstrumentationBreakpoints) private readonly _domInstrumentationBreakpoints: IDOMInstrumentationBreakpointsSetter,
        @inject(TYPES.IDebugeeExecutionControl) private readonly _debugeeExecutionControl: IDebugeeExecutionController,
        @inject(TYPES.IEventsToClientReporter) protected readonly _eventsToClientReporter: IEventsToClientReporter,
        @inject(TYPES.IDebugeeVersionProvider) protected readonly _debugeeVersionProvider: IDebugeeRuntimeVersionProvider,
        @inject(ExistingBPsForJustParsedScriptSetter) protected readonly _existingBPsForJustParsedScriptSetter: ExistingBPsForJustParsedScriptSetter,
        protected readonly _breakpointsRegistry: BreakpointsRegistry,
    ) {
    }

    public toString(): string {
        return 'PauseScriptLoadsToSetBPs';
    }
}