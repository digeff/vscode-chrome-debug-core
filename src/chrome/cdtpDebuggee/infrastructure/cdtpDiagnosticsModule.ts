/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { TransformedListenerRegistry } from '../../communication/transformedListenerRegistry';
import { PromiseOrNot } from '../../utils/promises';
import { injectable } from 'inversify';
import { CDTPDomainsEnabler } from './cdtpDomainsEnabler';
import { ICDTPEventPublisher, ICDTPEventHandlerTracker } from './cdtpEventHandlerTracker';

export interface IEnableableApi<E, EnableParameters = void, EnableResponse = void> extends ICDTPEventPublisher<E> {
    enable(parameters: EnableParameters): Promise<EnableResponse>;
}

@injectable()
export abstract class CDTPEnableableDiagnosticsModule<T extends IEnableableApi<E, EnableParameters, EnableResponse>, E, EnableParameters = void, EnableResponse = void> {
    protected abstract get api(): T;
    protected abstract get _domainsEnabler(): CDTPDomainsEnabler;
    protected abstract get _eventHandlerTracker(): ICDTPEventHandlerTracker;

    public enable(): EnableParameters extends void ? Promise<EnableResponse> : never;
    public enable(parameters: EnableParameters): Promise<EnableResponse>;
    public async enable(parameters?: EnableParameters): Promise<EnableResponse> {
        return await this._domainsEnabler.registerToEnable<T, E, EnableParameters, EnableResponse>(this.api, parameters);
    }
}

@injectable()
export abstract class CDTPEventsEmitterDiagnosticsModule<T extends {} & IEnableableApi<E, EnableParameters, EnableResponse>, E, EnableParameters = void, EnableResponse = void>
    extends CDTPEnableableDiagnosticsModule<T, E, EnableParameters, EnableResponse> {
    public addApiListener<O extends E, T>(eventName: string, transformation: (params: O) => PromiseOrNot<T>): (transformedListener: ((params: T) => void)) => void {

        const transformedListenerRegistryPromise = new TransformedListenerRegistry<O, T>(this.constructor.name, async originalListener => {
            this._eventHandlerTracker.listenTo(this.api, eventName, originalListener);
            this.api.on(eventName, originalListener);
        }, transformation).install();

        this.enable(); // The domain will be enabled eventually (Assuming this happens during the startup/initial configuration phase). We don't block on it.

        return async transformedListener => (await transformedListenerRegistryPromise).registerListener(transformedListener);
    }
}