import { IDebugeeExecutionController } from '../../cdtpDebuggee/features/cdtpDebugeeExecutionController';
import { ReasonType } from '../../stoppedEvent';
import { IEventsToClientReporter } from '../../client/eventSender';
import { PausedEvent } from '../../cdtpDebuggee/eventsProviders/cdtpDebuggeeExecutionEventsProvider';

const ImplementsActionToTakeWhenPaused = Symbol();
export interface IActionToTakeWhenPaused {
    [ImplementsActionToTakeWhenPaused]: string;

    execute(actionsWithLowerPriority: IActionToTakeWhenPaused[]): Promise<void>;
}

export abstract class BaseActionToTakeWhenPaused implements IActionToTakeWhenPaused {
    [ImplementsActionToTakeWhenPaused] = 'ActionToTakeWhenPaused';

    public abstract execute(actionsWithLowerPriority: IActionToTakeWhenPaused[]): Promise<void>;
}

export class NoActionIsNeededForThisPause extends BaseActionToTakeWhenPaused {
    constructor(public readonly actionProvider: unknown /* Used for debugging purposes only */) {
        super();
    }

    public async execute(): Promise<void> {
        // We don't need to do anything
    }

    public toString(): string {
        return `${this.actionProvider} doesn't need to do any action for this pause`;
    }
}

export abstract class BasePauseShouldBeAutoResumed extends BaseActionToTakeWhenPaused {
    protected readonly abstract _debugeeExecutionControl: IDebugeeExecutionController;

    public async execute(): Promise<void> {
        this._debugeeExecutionControl.resume();
    }
}

export abstract class BaseNotifyClientOfPause extends BaseActionToTakeWhenPaused {
    protected readonly exception: any;
    protected readonly abstract reason: ReasonType;
    protected readonly abstract _eventsToClientReporter: IEventsToClientReporter;

    public async execute(): Promise<void> {
        this._eventsToClientReporter.sendDebugeeIsStopped({ reason: this.reason, exception: this.exception });
    }
}

export class HitDebuggerStatement extends BaseNotifyClientOfPause {
    protected readonly reason = 'debugger_statement';

    constructor(
        protected readonly _eventsToClientReporter: IEventsToClientReporter,
    ) {
        super();
    }
}

export type ActionToTakeWhenPausedProvider = (paused: PausedEvent) => Promise<IActionToTakeWhenPaused>;
