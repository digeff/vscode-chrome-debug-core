/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { ValidatedMultiMap } from '../collections/validatedMultiMap';
import { groupByKey } from '../collections/utilities';
import { PromiseOrNot } from '../utils/promises';

export interface IExecutorRequiringVotes<T> {
    execute(remainingRelevantVotes: IVote<T>[]): Promise<T>;
}

const ImplementsVote = Symbol();
export interface IVote<T> extends IExecutorRequiringVotes<T>, Object {
    [ImplementsVote]: string;
}

export abstract class VoteCommonLogic<T> implements IVote<T> {
    [ImplementsVote] = 'Vote';

    public abstract execute(): Promise<T>;
}

export class Abstained<T> extends VoteCommonLogic<T> {
    public async execute(): Promise<T> {
        throw new Error(`An abstained vote cannot be executed`);
    }

    constructor(public readonly voter: unknown /* Used for debugging purposes only */) {
        super();
    }

    public toString(): string {
        return `${this.voter} abstained`;
    }
}

export class ExecutorForNoVotes<T> implements IExecutorRequiringVotes<T> {
    constructor(private readonly _actionIfNoOneVoted: () => PromiseOrNot<T>) { }

    public async execute(_remainingRelevantVotes: IVote<T>[]): Promise<T> {
        return this._actionIfNoOneVoted();
    }

    public toString(): string {
        return `Executor when no-one voted`;
    }
}

export class ExecuteDecisionBasedOnVotes<T> {
    public async execute(): Promise<T> {
        if (this._votes.length > 0) {
            let winningVote: IExecutorRequiringVotes<T> = new ExecutorForNoVotes<T>(this._actionIfNoOneVoted);
            let priorityIndex = Number.MAX_SAFE_INTEGER; // Our priorities go from 0 (highest priority) to Number.MAX_SAFE_INTEGER (lowest priority)
            for (const vote of this._votes) {
                const votePriorityIndex = this._priorityIndexFunction(vote);
                if (votePriorityIndex < priorityIndex) {
                    priorityIndex = votePriorityIndex;
                    winningVote = vote;
                }
            }

            return winningVote.execute(this._votes);
        } else {
            return await this._actionIfNoOneVoted();
        }
    }

    constructor(
        private readonly _actionIfNoOneVoted: () => PromiseOrNot<T>,
        private readonly _votes: IVote<T>[],
        private readonly _priorityIndexFunction: (vote: IVote<T>) => number) {
    }
}