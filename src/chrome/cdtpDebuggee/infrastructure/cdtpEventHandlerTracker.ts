import { PromiseOrNot } from '../../utils/promises';

export type ICDTPEventListener<O> = (event: O) => PromiseOrNot<void>;
export interface ICDTPEventPublisher<T> {
    on(eventName: string, listener: (event: T) => Promise<void>): void;
}

export interface ICDTPEventHandlerTracker {
    listenTo<T>(api: ICDTPEventPublisher<T>, eventName: string, listener: ICDTPEventListener<T>): void;
    waitForCurrentOnFlightEvents(): Promise<void>;
}

export class CDTPEventHandlerTracker implements ICDTPEventHandlerTracker {
    private _eventsOnFlight = Promise.resolve();
    public constructor() { }

    public listenTo<T>(api: ICDTPEventPublisher<T>, eventName: string, listener: ICDTPEventListener<T>): void {
        api.on(eventName, async (event: T) => {
            const listenerIsFinished = Promise.resolve(listener(event)).then(() => { }, () => { });
            this._eventsOnFlight = this._eventsOnFlight.then(() => listenerIsFinished);
        });
    }

    public waitForCurrentOnFlightEvents(): Promise<void> {
        return this._eventsOnFlight;
    }
}
