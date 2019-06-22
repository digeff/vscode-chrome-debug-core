/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { Protocol as CDTP } from 'devtools-protocol';
import { inject, injectable } from 'inversify';
import { TYPES } from '../../dependencyInjection.ts/types';
import { CDTPEnableableDiagnosticsModule } from '../infrastructure/cdtpDiagnosticsModule';
import { CDTPDomainsEnabler } from '../infrastructure/cdtpDomainsEnabler';
import { ICDTPEventHandlerTracker } from '../infrastructure/cdtpEventHandlerTracker';

export interface IAsyncDebuggingConfigurer {
    setAsyncCallStackDepth(maxDepth: CDTP.integer): Promise<void>;
}

@injectable()
export class CDTPAsyncDebuggingConfigurer extends CDTPEnableableDiagnosticsModule<CDTP.DebuggerApi, CDTP.Debugger.ScriptParsedEvent, void, CDTP.Debugger.EnableResponse> implements IAsyncDebuggingConfigurer {
    protected readonly api = this._protocolApi.Debugger;

    constructor(
        @inject(TYPES.CDTPClient)
        private readonly _protocolApi: CDTP.ProtocolApi,
        @inject(TYPES.ICDTPEventHandlerTracker) protected readonly _eventHandlerTracker: ICDTPEventHandlerTracker,
        @inject(TYPES.IDomainsEnabler) protected readonly _domainsEnabler: CDTPDomainsEnabler) {
        super();
    }

    public async setAsyncCallStackDepth(maxDepth: CDTP.integer): Promise<void> {
        await this.enable();
        return this.api.setAsyncCallStackDepth({ maxDepth });
    }
}
