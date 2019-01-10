/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { IComponent } from '../../features/feature';
import { IBPRecipe } from '../bpRecipe';
import { BPRecipeInSource } from '../bpRecipeInSource';
import { PauseOnHitCount } from '../bpActionWhenHit';
import { ValidatedMap } from '../../../collections/validatedMap';
import { HitCountConditionParser, HitCountConditionFunction } from './hitCountConditionParser';
import { NotifyStoppedCommonLogic, InformationAboutPausedProvider } from '../../features/takeProperActionOnPausedEvent';
import { ReasonType } from '../../../stoppedEvent';
import { IVote, Abstained, VoteRelevance } from '../../../communication/collaborativeDecision';
import { injectable, inject } from 'inversify';
import { IEventsToClientReporter } from '../../../client/eventSender';
import { TYPES } from '../../../dependencyInjection.ts/types';
import { PausedEvent } from '../../../cdtpDebuggee/eventsProviders/cdtpDebuggeeExecutionEventsProvider';
import { ScriptOrSourceOrURLOrURLRegexp } from '../../locations/location';

export interface IHitCountBreakpointsDependencies {
    registerAddBPRecipeHandler(handlerRequirements: (bpRecipe: BPRecipeInSource) => boolean,
        handler: (bpRecipe: BPRecipeInSource) => Promise<void>): void;

    addBPRecipe(bpRecipe: BPRecipeInSource): Promise<void>;
    notifyBPWasHit(bpRecipe: BPRecipeInSource): Promise<void>;

    subscriberForAskForInformationAboutPaused(listener: InformationAboutPausedProvider): void;
    publishGoingToPauseClient(): void;
}

class HitCountBPData {
    private _hitCount = 0;

    public notifyBPHit(): VoteRelevance {
        return this._shouldPauseCondition(this._hitCount++)
            ? VoteRelevance.NormalVote
            : VoteRelevance.Abstained;
    }

    constructor(
        public readonly hitBPRecipe: BPRecipeInSource<PauseOnHitCount>,
        private readonly _shouldPauseCondition: HitCountConditionFunction) { }
}

export class HitAndSatisfiedCountBPCondition extends NotifyStoppedCommonLogic {
    public readonly relevance = VoteRelevance.NormalVote;
    protected reason: ReasonType = 'breakpoint';

    constructor(protected readonly _eventsToClientReporter: IEventsToClientReporter,
        protected readonly _publishGoingToPauseClient: () => void) {
        super();
    }
}

// TODO DIEGO: Install and use this feature
@injectable()
export class HitCountBreakpoints implements IComponent {
    private readonly underlyingToBPRecipe = new ValidatedMap<IBPRecipe<ScriptOrSourceOrURLOrURLRegexp>, HitCountBPData>();

    public install(): void {
        this._dependencies.registerAddBPRecipeHandler(
            bpRecipe => bpRecipe.bpActionWhenHit instanceof PauseOnHitCount,
            bpRecipe => this.addBPRecipe(bpRecipe as BPRecipeInSource<PauseOnHitCount>));
        this._dependencies.subscriberForAskForInformationAboutPaused(paused => this.askForInformationAboutPaused(paused));
    }

    private async addBPRecipe(bpRecipe: BPRecipeInSource<PauseOnHitCount>): Promise<void> {
        const underlyingBPRecipe = bpRecipe.withAlwaysBreakAction();
        const shouldPauseCondition = new HitCountConditionParser(bpRecipe.bpActionWhenHit.pauseOnHitCondition).parse();
        this._dependencies.addBPRecipe(underlyingBPRecipe);
        this.underlyingToBPRecipe.set(underlyingBPRecipe, new HitCountBPData(bpRecipe, shouldPauseCondition));
    }

    public async askForInformationAboutPaused(paused: PausedEvent): Promise<IVote<void>> {
        const hitCountBPData = paused.hitBreakpoints.map(hitBPRecipe =>
            this.underlyingToBPRecipe.tryGetting(hitBPRecipe.unmappedBPRecipe)).filter(bpRecipe => bpRecipe !== undefined);

        const individualDecisions = hitCountBPData.map(data => data.notifyBPHit());
        return individualDecisions.indexOf(VoteRelevance.NormalVote) >= 0
            ? new HitAndSatisfiedCountBPCondition(this._eventsToClientReporter, this._dependencies.publishGoingToPauseClient)
            : new Abstained(this);
    }

    constructor(private readonly _dependencies: IHitCountBreakpointsDependencies,
        @inject(TYPES.IEventsToClientReporter) private readonly _eventsToClientReporter: IEventsToClientReporter) { }
}