/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { ValidatedMultiMap } from '../collections/validatedMultiMap';
import { groupByKey } from '../collections/utilities';
import { PromiseOrNot } from '../utils/promises';

export enum VoteRelevance {
    OverrideOtherVotes,
    NormalVote,
    FallbackVote,
    Abstained,
}

export interface IVote<T> {
    relevance: VoteRelevance;
    isRelevant(): boolean;

    execute(remainingRelevantVotes: IVote<T>[]): Promise<T>;
}

export abstract class VoteCommonLogic<T> implements IVote<T> {
    public abstract execute(): Promise<T>;
    public abstract get relevance(): VoteRelevance;

    public isRelevant(): boolean {
        return this.relevance !== VoteRelevance.Abstained;
    }
}

export class ReturnValue<T> extends VoteCommonLogic<T> {
    public readonly relevance = VoteRelevance.NormalVote;

    public async execute(): Promise<T> {
        return this._value;
    }

    constructor(private readonly _value: T) {
        super();
    }
}

export class Abstained<T> extends VoteCommonLogic<T> {
    public readonly relevance = VoteRelevance.Abstained;

    public async execute(): Promise<T> {
        throw new Error(`An abstained vote cannot be executed`);
    }

    constructor(public readonly voter: unknown /* Used for debugging purposes only */) {
        super();
    }
}

export class VoteOverride<T> extends VoteCommonLogic<T> {
    public readonly relevance = VoteRelevance.OverrideOtherVotes;

    constructor (private readonly _callback: () => Promise<T>) {
        super();
    }

    public async execute(): Promise<T> {
        return this._callback();
    }
}

export class ExecuteDecisionBasedOnVotes<T> {
    private readonly _votesByRelevance: ValidatedMultiMap<VoteRelevance, IVote<T>>;

    public async execute(): Promise<T> {
        const overrideVotes = this.getVotesWithCertainRelevance(VoteRelevance.OverrideOtherVotes);
        const normalVotes = this.getVotesWithCertainRelevance(VoteRelevance.NormalVote);
        const fallbackVotes = this.getVotesWithCertainRelevance(VoteRelevance.FallbackVote);

        // If we have override or normal votes use those, if not use the fallback ones
        let allRelevatVotes = overrideVotes.concat(normalVotes);
        let allVotes = allRelevatVotes.concat(fallbackVotes);

        if (allVotes.length > 0) {
            const winningVote = allVotes[0]; // We'd normally expect to have a single piece in this array
            return winningVote.execute(allRelevatVotes);
        } else {
            return await this._actionIfNoOneVoted();
        }
    }

    public getCountOfVotesWithCertainRelevance(relevance: VoteRelevance): number {
        return this.getVotesWithCertainRelevance(relevance).length;
    }

    private getVotesWithCertainRelevance(relevance: VoteRelevance): IVote<T>[] {
        return Array.from(this._votesByRelevance.tryGetting(relevance) || []);
    }

    constructor(private readonly _actionIfNoOneVoted: () => PromiseOrNot<T>, votes: IVote<T>[]) {
        this._votesByRelevance = groupByKey(votes, vote => vote.relevance);
    }
}