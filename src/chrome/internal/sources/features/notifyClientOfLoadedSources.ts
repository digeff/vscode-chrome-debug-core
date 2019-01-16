/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { IComponent } from '../../features/feature';
import { IScript } from '../../scripts/script';
import { telemetry } from '../../../../telemetry';
import { ISourceWasLoadedParameters, IEventsToClientReporter } from '../../../client/eventSender';
import { ValidatedMap } from '../../../collections/validatedMap';
import { CDTPScriptUrl } from '../resourceIdentifierSubtypes';
import { injectable, inject } from 'inversify';
import { TYPES } from '../../../dependencyInjection.ts/types';
import { IScriptParsedEvent } from '../../../cdtpDebuggee/eventsProviders/cdtpOnScriptParsedEventProvider';
import { asyncMap } from '../../../collections/async';
import { ILoadedSource, ContentsLocation } from '../loadedSource';
import { newResourceIdentifierMap } from '../resourceIdentifier';
import { LoadedSourceEventReason } from '../../../chromeDebugAdapter';

export interface INotifyClientOfLoadedSourcesDependencies {
    sendSourceWasLoaded(params: ISourceWasLoadedParameters): Promise<void>;
    onScriptParsed(listener: (scriptEvent: IScriptParsedEvent) => Promise<void>): void;
}

@injectable()
export class NotifyClientOfLoadedSources implements IComponent {
    // TODO DIEGO: Ask VS what index do they use internally to verify if the source is the same or a new one
    private _notifiedSourceByIdentifier = newResourceIdentifierMap<ILoadedSource>();

    public install(): this {
        this._dependencies.onScriptParsed(scriptParsed => this.onScriptParsed(scriptParsed));
        return this;
    }

    public async onScriptParsed(scriptParsed: IScriptParsedEvent): Promise<void> {
        // We processed the events out of order. If this event got here after we destroyed the context then ignore it.
        if (!scriptParsed.script.executionContext.isDestroyed()) {
            scriptParsed.script.allSources.forEach(source => this.sendLoadedSourceEvent(source, 'new'));
        }
    }

    /**
     * e.g. the target navigated
     */
    protected onExecutionContextsCleared(): void {
        for (const script of this._notifiedSourceByIdentifier.values()) {
            this.sendLoadedSourceEvent(script, 'removed');
        }
    }

    protected sendLoadedSourceEvent(source: ILoadedSource, loadedSourceEventReason: LoadedSourceEventReason): void {
        switch (loadedSourceEventReason) {
            case 'new':
            case 'changed':
                if (this._notifiedSourceByIdentifier.tryGetting(source.identifier) !== undefined) {
                    if (source.contentsLocation === ContentsLocation.PersistentStorage) {
                        // We only need to send changed events for dynamic scripts. The client tracks files on storage on it's own, so this notification is not needed
                        loadedSourceEventReason = 'changed';
                    } else {
                        return; // VS is strict about the changed notifications, and it will fail if we send a changed notification for a file on storage, so we omit it on purpose
                    }
                } else {
                    loadedSourceEventReason = 'new';
                    this._notifiedSourceByIdentifier.set(source.identifier, source);
                }
                break;
            case 'removed':
                if (!this._notifiedSourceByIdentifier.delete(source.identifier)) {
                    telemetry.reportEvent('LoadedSourceEventError', { issue: 'Tried to remove non-existent loaded source' });
                    return;
                }
                break;
            default:
                telemetry.reportEvent('LoadedSourceEventError', { issue: 'Unknown reason', reason: loadedSourceEventReason });
        }

        this._eventsToClientReporter.sendSourceWasLoaded({ reason: loadedSourceEventReason, source: source });
    }

    constructor(
        @inject(TYPES.EventsConsumedByConnectedCDA) private readonly _dependencies: INotifyClientOfLoadedSourcesDependencies,
        @inject(TYPES.IEventsToClientReporter) private readonly _eventsToClientReporter: IEventsToClientReporter) { }
}