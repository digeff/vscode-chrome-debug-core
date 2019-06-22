/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { Protocol as CDTP } from 'devtools-protocol';

import { injectable, inject } from 'inversify';
import { TYPES } from '../../dependencyInjection.ts/types';
import { CDTPEventsEmitterDiagnosticsModule } from '../infrastructure/cdtpDiagnosticsModule';
import { CDTPDomainsEnabler } from '../infrastructure/cdtpDomainsEnabler';
import { ICDTPEventHandlerTracker } from '../infrastructure/cdtpEventHandlerTracker';

export interface IBrowserNavigator {
    navigate(params: CDTP.Page.NavigateRequest): Promise<CDTP.Page.NavigateResponse>;
    reload(params: CDTP.Page.ReloadRequest): Promise<void>;
    onFrameNavigated(listener: (params: CDTP.Page.FrameNavigatedEvent) => void): void;
}

@injectable()
export class CDTPBrowserNavigator extends CDTPEventsEmitterDiagnosticsModule<CDTP.PageApi, CDTP.Page.FrameNavigatedEvent> implements IBrowserNavigator {
    protected api = this._protocolApi.Page;

    public readonly onFrameNavigated = this.addApiListener('frameNavigated', (params: CDTP.Page.FrameNavigatedEvent) => params);

    constructor(
        @inject(TYPES.CDTPClient)
        protected _protocolApi: CDTP.ProtocolApi,
        @inject(TYPES.ICDTPEventHandlerTracker) protected readonly _eventHandlerTracker: ICDTPEventHandlerTracker,
        @inject(TYPES.IDomainsEnabler) protected readonly _domainsEnabler: CDTPDomainsEnabler
    ) {
        super();
    }

    public navigate(params: CDTP.Page.NavigateRequest): Promise<CDTP.Page.NavigateResponse> {
        return this.api.navigate(params);
    }

    public reload(params: CDTP.Page.ReloadRequest): Promise<void> {
        return this.api.reload(params);
    }
}
