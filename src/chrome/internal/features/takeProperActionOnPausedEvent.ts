/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { IComponent } from './feature';
import { PausedEvent } from '../../cdtpDebuggee/eventsProviders/cdtpDebuggeeExecutionEventsProvider';
import { IEventsToClientReporter } from '../../client/eventSender';
import { ReasonType } from '../../stoppedEvent';
import { PromiseOrNot } from '../../utils/promises';
import { IVote, VoteCommonLogic, ExecuteDecisionBasedOnVotes, Abstained } from '../../communication/collaborativeDecision';
import { injectable, inject } from 'inversify';
import { TYPES } from '../../dependencyInjection.ts/types';
import { IDebugeeExecutionController } from '../../cdtpDebuggee/features/cdtpDebugeeExecutionController';
import { ICDTDebuggeeExecutionEventsProvider } from '../../cdtpDebuggee/eventsProviders/cdtpDebuggeeExecutionEventsProvider';
import { ShouldStepInToAvoidSkippedSource } from './smartStep';
import { HitBreakpoint } from '../breakpoints/features/bpRecipeAtLoadedSourceLogic';
import { HitAndSatisfiedCountBPCondition } from '../breakpoints/features/hitCountBreakpoints';
import { HitStillPendingBreakpoint } from '../breakpoints/features/pauseScriptLoadsToSetBPs';
import { ExceptionWasThrown, PromiseWasRejected } from '../exceptions/pauseOnException';
import { ValidatedMap } from '../../collections/validatedMap';
import { type } from 'os';

export abstract class ResumeCommonLogic extends VoteCommonLogic<void> {
    protected readonly abstract _debugeeExecutionControl: IDebugeeExecutionController;

    public async execute(): Promise<void> {
        this._debugeeExecutionControl.resume();
    }
}

type VoteClass = { new(...args: any[]): IVote<unknown> };

const situationsFromHighestToLowestPriority: VoteClass[] = [
    ShouldStepInToAvoidSkippedSource,
    Abstained,
    HitBreakpoint,
    HitAndSatisfiedCountBPCondition,
    HitStillPendingBreakpoint,
    ExceptionWasThrown,
    PromiseWasRejected,
];

const priorityAndVoteClassPairs = situationsFromHighestToLowestPriority.map((situationClass, index) => <[VoteClass, number]>[situationClass, index]);
const situationClassToPriorityIndexMapping = new ValidatedMap(priorityAndVoteClassPairs);

export abstract class NotifyStoppedCommonLogic extends VoteCommonLogic<void> {
    protected readonly exception: any;
    protected readonly abstract reason: ReasonType;
    protected readonly abstract _eventsToClientReporter: IEventsToClientReporter;
    protected readonly abstract _publishGoingToPauseClient: () => void;

    public async execute(): Promise<void> {
        // this._publishGoingToPauseClient();
        this._eventsToClientReporter.sendDebugeeIsStopped({ reason: this.reason, exception: this.exception });
    }
}

export type InformationAboutPausedProvider = (paused: PausedEvent) => Promise<IVote<void>>;

export interface IEventsConsumedByTakeProperActionOnPausedEvent extends ITakeActionBasedOnInformationDependencies {
    // onPaused(listener: (paused: PausedEvent) => Promise<void> | void): void;
}

@injectable()
export class TakeProperActionOnPausedEvent implements IComponent {
    public async onPause(paused: PausedEvent): Promise<void> {
        // Ask all the listeners what information they can provide
        const infoPieces = await this._dependencies.askForInformationAboutPause(paused);

        await new TakeActionBasedOnInformation(infoPieces, this._eventsToClientReporter).takeAction();
    }

    public install(): this {
        this._cdtpDebuggerEventsProvider.onPaused(paused => this.onPause(paused));
        return this;
    }

    constructor(
        @inject(TYPES.EventsConsumedByConnectedCDA) private readonly _dependencies: ITakeActionBasedOnInformationDependencies,
        @inject(TYPES.ICDTPDebuggerEventsProvider) private readonly _cdtpDebuggerEventsProvider: ICDTDebuggeeExecutionEventsProvider,
        @inject(TYPES.IEventsToClientReporter) private readonly _eventsToClientReporter: IEventsToClientReporter) { }
}

export interface ITakeActionBasedOnInformationDependencies {
    askForInformationAboutPause(paused: PausedEvent): PromiseOrNot<IVote<void>[]>;
}

export class TakeActionBasedOnInformation {
    private readonly _takeActionBasedOnVotes: ExecuteDecisionBasedOnVotes<void>;

    public async takeAction(): Promise<void> {
        return this._takeActionBasedOnVotes.execute();
    }

    constructor(piecesOfInformation: IVote<void>[],
        private readonly _eventsToClientReporter: IEventsToClientReporter) {
        this._takeActionBasedOnVotes = new ExecuteDecisionBasedOnVotes(async () => {
            // If we don't have any information whatsoever, then we assume that we stopped due to a debugger statement
            return this._eventsToClientReporter.sendDebugeeIsStopped({ reason: 'debugger_statement' });
        }, piecesOfInformation, voteClass => situationClassToPriorityIndexMapping.get(<VoteClass>voteClass.constructor));
    }
}
