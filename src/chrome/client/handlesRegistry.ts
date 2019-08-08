/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { ILoadedSource } from '../internal/sources/loadedSource';
import { IBPRecipe } from '../internal/breakpoints/bpRecipe';
import { BidirectionalMap } from '../collections/bidirectionalMap';
import { injectable } from 'inversify';
import { IStackTracePresentationRow } from '../internal/stackTraces/stackTracePresentationRow';
import { ISource } from '../internal/sources/source';
import { inspect } from 'util';

export class BidirectionalHandles<T> {
    private readonly _idToObject = new BidirectionalMap<number, T>();

    constructor(private _nextHandle: number) { }

    public getObjectById(id: number): T {
        return this._idToObject.getByLeft(id);
    }

    // TODO: Split thsi method into createNewIdForObject and other methods
    public getIdByObject(obj: T): number {
        const id = this._idToObject.tryGettingByRight(obj);
        if (id !== undefined) {
            return id;
        } else {
            const newId = this._nextHandle++;
            this._idToObject.set(newId, obj);
            return newId;
        }
    }

    public getExistingIdByObject(obj: T): number {
        return this._idToObject.getByRight(obj);
    }

    public [inspect.custom](): string {
        return this.toString(inspect);
    }

    public toString(print = (value: unknown) => `${value}`): string {
        return this._idToObject.toString();
    }
}

const prefixMultiplier = 1000000;

@injectable()
export class HandlesRegistry {
    // TODO DIEGO: V1 reseted the frames on an onPaused event. Figure out if that is the right thing to do
    // We use different prefixes so it's easier to identify the IDs in the logs...
    public readonly breakpoints = new BidirectionalHandles<IBPRecipe<ISource>>(888 * prefixMultiplier);
    public readonly frames = new BidirectionalHandles<IStackTracePresentationRow>(123 * prefixMultiplier);
    public readonly sources = new BidirectionalHandles<ILoadedSource>(555 * prefixMultiplier);

    public [inspect.custom](): string {
        return this.toString(inspect);
    }

    public toString(print = (value: unknown) => `${value}`): string {
        return `Handles {\nBPs:\n${this.breakpoints}\nFrames:\n${this.frames}\nSources:\n${this.sources}\n}`;
    }
}
