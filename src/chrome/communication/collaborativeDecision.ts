/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { ValidatedMultiMap } from '../collections/validatedMultiMap';
import { groupByKey } from '../collections/utilities';
import { PromiseOrNot } from '../utils/promises';

export interface IExecutorRequiringActionsWithLessPriority<T> {
    execute(actionsWithLowerPriority: IActionToTakeWhenPaused<T>[]): Promise<T>;
}

const ImplementsActionToTakeWhenPaused = Symbol();
export interface IActionToTakeWhenPaused<T> extends IExecutorRequiringActionsWithLessPriority<T>, Object {
    [ImplementsActionToTakeWhenPaused]: string;
}

export abstract class BaseActionToTakeWhenPaused<T> implements IActionToTakeWhenPaused<T> {
    [ImplementsActionToTakeWhenPaused] = 'ActionToTakeWhenPaused';

    public abstract execute(): Promise<T>;
}

export class DefaultAction<T> extends BaseActionToTakeWhenPaused<T> {
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

export class ExecutorForNoVotes<T> implements IExecutorRequiringActionsWithLessPriority<T> {
    constructor(private readonly _actionIfNoOneVoted: () => PromiseOrNot<T>) { }

    public async execute(_remainingRelevantVotes: IActionToTakeWhenPaused<T>[]): Promise<T> {
        return this._actionIfNoOneVoted();
    }

    public toString(): string {
        return `Executor when no-one voted`;
    }
}

export class HighestPriorityItemFinder<T> {
    public async find(): Promise<T> {
        if (this._items.length > 0) {
            let winningVote: IExecutorRequiringActionsWithLessPriority<T> = new ExecutorForNoVotes<T>(this._actionIfNoOneVoted);
            let priorityIndex = Number.MAX_SAFE_INTEGER; // Our priorities go from 0 (highest priority) to Number.MAX_SAFE_INTEGER (lowest priority)
            for (const vote of this._items) {
                const votePriorityIndex = this._priorityIndexFunction(vote);
                if (votePriorityIndex < priorityIndex) {
                    priorityIndex = votePriorityIndex;
                    winningVote = vote;
                }
            }

            return winningVote.execute(this._items);
        } else {
            return await this._actionIfNoOneVoted();
        }
    }

    constructor(
        private readonly _actionIfNoOneVoted: () => PromiseOrNot<T>,
        private readonly _items: IActionToTakeWhenPaused<T>[],
        private readonly _priorityIndexFunction: (vote: IActionToTakeWhenPaused<T>) => number) {
    }
}