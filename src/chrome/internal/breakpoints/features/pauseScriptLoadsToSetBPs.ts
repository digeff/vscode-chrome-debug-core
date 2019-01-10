/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { IComponentWithAsyncInitialization } from '../../features/components';
import { BaseNotifyClientOfPause, ActionToTakeWhenPausedProvider, IActionToTakeWhenPaused, NoActionIsNeededForThisPause, BasePauseShouldBeAutoResumed } from '../../features/actionToTakeWhenPaused';
import { ReasonType } from '../../../stoppedEvent';
import { IEventsToClientReporter } from '../../../client/eventSender';
import { IDebugeeExecutionController } from '../../../cdtpDebuggee/features/cdtpDebugeeExecutionController';
import { ExistingBPsForJustParsedScriptSetter } from './existingBPsForJustParsedScriptSetter';
import { BreakpointsRegistry } from '../registries/breakpointsRegistry';
import { IDOMInstrumentationBreakpointsSetter } from '../../../cdtpDebuggee/features/cdtpDOMInstrumentationBreakpointsSetter';
import { IDebugeeRuntimeVersionProvider } from '../../../cdtpDebuggee/features/cdtpDebugeeRuntimeVersionProvider';
import { PausedEvent } from '../../../cdtpDebuggee/eventsProviders/cdtpDebuggeeExecutionEventsProvider';
import { wrapWithMethodLogger } from '../../../logging/methodsCalledLogger';
import { IDebuggeePausedHandler } from '../../features/debuggeePausedHandler';

export class HitStillPendingBreakpoint extends BaseNotifyClientOfPause {
    protected reason: ReasonType = 'breakpoint';

    constructor(protected readonly _eventsToClientReporter: IEventsToClientReporter) {
        super();
    }
}

export class PausedWhileLoadingScriptToResolveBreakpoints extends BasePauseShouldBeAutoResumed {
    constructor(protected readonly _debugeeExecutionControl: IDebugeeExecutionController) {
        super();
    }
}

/// TODO: Move this to a browser-shared package
export class PauseScriptLoadsToSetBPs implements IComponentWithAsyncInitialization {
    private readonly stopsWhileScriptsLoadInstrumentationName = 'scriptFirstStatement';
    private _isInstrumentationEnabled = false;
    private _scriptFirstStatementStopsBeforeFile: boolean;

    public readonly withLogging = wrapWithMethodLogger(this);

    constructor(
        private readonly _debuggeePausedHandler: IDebuggeePausedHandler,
        private readonly _domInstrumentationBreakpoints: IDOMInstrumentationBreakpointsSetter,
        private readonly _debugeeExecutionControl: IDebugeeExecutionController,
        private readonly _eventsToClientReporter: IEventsToClientReporter,
        private readonly _debugeeVersionProvider: IDebugeeRuntimeVersionProvider,
        private readonly _existingBPsForJustParsedScriptSetter: ExistingBPsForJustParsedScriptSetter,
        private readonly _breakpointsRegistry: BreakpointsRegistry,
    ) {
        this._debuggeePausedHandler.registerActionProvider(paused => this.withLogging.onProvideActionForWhenPaused(paused));
    }

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

    private async onProvideActionForWhenPaused(paused: PausedEvent): Promise<IActionToTakeWhenPaused> {
        if (this.isInstrumentationPause(paused)) {
            await this._existingBPsForJustParsedScriptSetter.waitUntilBPsAreSet(paused.callFrames[0].location.script);

            // If we pause before starting the script, we can just resume, and we'll a breakpoint if it's on 0,0
            if (!this._scriptFirstStatementStopsBeforeFile) {
                // On Chrome 69 we pause inside the script, so we need to check if there is a breakpoint at 0,0 that we need to use
                const breakpoints = this._breakpointsRegistry.tryGettingBreakpointAtLocation(paused.callFrames[0].location);
                if (breakpoints.length > 0) {
                    return new HitStillPendingBreakpoint(this._eventsToClientReporter);
                }
            }

            return new PausedWhileLoadingScriptToResolveBreakpoints(this._debugeeExecutionControl);
        } else {
            return new NoActionIsNeededForThisPause(this);
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
        // TODO DIEGO: Figure out exactly when we want to block on the browser version
        // On version 69 Chrome stopped sending an extra event for DOM Instrumentation: See https://bugs.chromium.org/p/chromium/issues/detail?id=882909
        // On Chrome 68 we were relying on that event to make Break on load work on breakpoints on the first line of a file. On Chrome 69 we need an alternative way to make it work.
        // TODO: Reenable the code that uses Versions.Target.Version when this fails
        const runtimeVersion = await this._debugeeVersionProvider.version();
        this._scriptFirstStatementStopsBeforeFile = !runtimeVersion.isAtLeastVersion('69.0.0');
        return this;
    }

    public toString(): string {
        return 'PauseScriptLoadsToSetBPs';
    }
}