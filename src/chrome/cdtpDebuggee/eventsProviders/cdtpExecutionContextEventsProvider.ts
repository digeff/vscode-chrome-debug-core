/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { CDTPEventsEmitterDiagnosticsModule } from '../infrastructure/cdtpDiagnosticsModule';
import { Protocol as CDTP } from 'devtools-protocol';

import { inject, injectable } from 'inversify';
import { CDTPScriptsRegistry } from '../registries/cdtpScriptsRegistry';
import { TYPES } from '../../dependencyInjection.ts/types';
import { CDTPDomainsEnabler } from '../infrastructure/cdtpDomainsEnabler';
import { FrameId } from '../cdtpPrimitives';
import { ICDTPEventHandlerTracker } from '../infrastructure/cdtpEventHandlerTracker';

@injectable()
export class CDTPExecutionContextEventsProvider extends CDTPEventsEmitterDiagnosticsModule<CDTP.RuntimeApi, CDTP.Runtime.ExecutionContextCreatedEvent> {
    protected readonly api = this._protocolApi.Runtime;

    public readonly onExecutionContextsCleared = this.addApiListener('executionContextsCleared', (params: void) => params);

    public readonly onExecutionContextDestroyed = this.addApiListener('executionContextDestroyed', async (params: CDTP.Runtime.ExecutionContextDestroyedEvent) =>
        this._scriptsRegistry.markExecutionContextAsDestroyed(params.executionContextId));

    public readonly onExecutionContextCreated = this.addApiListener('executionContextCreated', async (params: CDTP.Runtime.ExecutionContextCreatedEvent) =>
        this._scriptsRegistry.registerExecutionContext(params.context.id, <FrameId>params.context.auxData.frameId));

    constructor(
        @inject(TYPES.CDTPClient) private readonly _protocolApi: CDTP.ProtocolApi,
        @inject(TYPES.CDTPScriptsRegistry) private readonly _scriptsRegistry: CDTPScriptsRegistry,
        @inject(TYPES.ICDTPEventHandlerTracker) protected readonly _eventHandlerTracker: ICDTPEventHandlerTracker,
        @inject(TYPES.IDomainsEnabler) protected readonly _domainsEnabler: CDTPDomainsEnabler
    ) {
        super();
    }
}