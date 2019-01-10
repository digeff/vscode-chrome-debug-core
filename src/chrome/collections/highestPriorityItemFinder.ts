import { PromiseOrNot } from '../utils/promises';

export class HighestPriorityItemFinder<T> {
    constructor(
        private readonly _items: T[],
        private readonly _noItemsInListAction: () => PromiseOrNot<T>,
        private readonly _getPriorityForItem: (item: T) => number) {
    }

    public async find(): Promise<T> {
        if (this._items.length > 0) {
            let highestPriorityItem = this._items[0];
            let priorityIndex = this._getPriorityForItem(highestPriorityItem);
            for (const vote of this._items) {
                const votePriorityIndex = this._getPriorityForItem(vote);
                if (votePriorityIndex < priorityIndex) {
                    priorityIndex = votePriorityIndex;
                    highestPriorityItem = vote;
                }
            }

            return highestPriorityItem;
        } else {
            return await this._noItemsInListAction();
        }
    }
}