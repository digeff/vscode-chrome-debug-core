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
import { IActionToTakeWhenPaused, DefaultAction } from '../../../communication/collaborativeDecision';
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

class NotAbstained {}

class HitCountBPData {
    private _hitCount = 0;

    public notifyBPHit(): object {
        return this._shouldPauseCondition(this._hitCount++)
            ? new NotAbstained()
            : new DefaultAction(this._voter);
    }

    constructor(
        private readonly _voter: unknown,
        public readonly hitBPRecipe: BPRecipeInSource<PauseOnHitCount>,
        private readonly _shouldPauseCondition: HitCountConditionFunction) { }
}

export class HitAndSatisfiedCountBPCondition extends NotifyStoppedCommonLogic {
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
        this.underlyingToBPRecipe.set(underlyingBPRecipe, new HitCountBPData(this, bpRecipe, shouldPauseCondition));
    }

    public async askForInformationAboutPaused(paused: PausedEvent): Promise<IActionToTakeWhenPaused<void>> {
        const hitCountBPData = paused.hitBreakpoints.map(hitBPRecipe =>
            this.underlyingToBPRecipe.tryGetting(hitBPRecipe.unmappedBPRecipe)).filter(bpRecipe => bpRecipe !== undefined);

        const individualDecisions = hitCountBPData.map(data => data.notifyBPHit());
        return individualDecisions.some(v => !(v instanceof DefaultAction))
            ? new HitAndSatisfiedCountBPCondition(this._eventsToClientReporter, this._dependencies.publishGoingToPauseClient)
            : new DefaultAction(this);
    }

    constructor(private readonly _dependencies: IHitCountBreakpointsDependencies,
        @inject(TYPES.IEventsToClientReporter) private readonly _eventsToClientReporter: IEventsToClientReporter) { }
}