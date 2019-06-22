/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { Protocol as CDTP } from 'devtools-protocol';
import { IScript } from '../../internal/scripts/script';
import { CDTPScriptsRegistry } from '../registries/cdtpScriptsRegistry';
import { inject, injectable } from 'inversify';
import { TYPES } from '../../dependencyInjection.ts/types';
import { LocationInScript } from '../../internal/locations/location';
import { CDTPEnableableDiagnosticsModule } from '../infrastructure/cdtpDiagnosticsModule';
import { CDTPDomainsEnabler } from '../infrastructure/cdtpDomainsEnabler';
import { CDTPEventHandlerTracker } from '../infrastructure/cdtpEventHandlerTracker';

export interface IBlackboxPatternsConfigurer {
    setBlackboxPatterns(params: CDTP.Debugger.SetBlackboxPatternsRequest): Promise<void>;
    setBlackboxedRanges(script: IScript, positions: LocationInScript[]): Promise<void>;
}

@injectable()
export class CDTPBlackboxPatternsConfigurer extends CDTPEnableableDiagnosticsModule<CDTP.DebuggerApi, CDTP.Debugger.ScriptParsedEvent, void, CDTP.Debugger.EnableResponse> implements IBlackboxPatternsConfigurer {
    protected readonly api = this._protocolApi.Debugger;

    constructor(
        @inject(TYPES.CDTPClient) private readonly _protocolApi: CDTP.ProtocolApi,
        @inject(TYPES.CDTPScriptsRegistry) private readonly _scriptsRegistry: CDTPScriptsRegistry,
        @inject(TYPES.ICDTPEventHandlerTracker) protected readonly _eventHandlerTracker: CDTPEventHandlerTracker,
        @inject(TYPES.IDomainsEnabler) protected readonly _domainsEnabler: CDTPDomainsEnabler) {
        super();
    }

    public async setBlackboxedRanges(script: IScript, positions: LocationInScript[]): Promise<void> {
        if (!positions.every(location => location.script === script)) {
            throw new Error(`Expected all the position: ${positions} to be in the script ${script}`);
        }

        const cdtpPositions: CDTP.Debugger.ScriptPosition[] = positions.map(p => ({
            lineNumber: p.position.lineNumber,
            columnNumber: p.position.columnNumber
        }));

        await this.enable();
        return this.api.setBlackboxedRanges({ scriptId: this._scriptsRegistry.getCdtpId(script), positions: cdtpPositions });
    }

    public async setBlackboxPatterns(params: CDTP.Debugger.SetBlackboxPatternsRequest): Promise<void> {
        await this.enable();
        return this.api.setBlackboxPatterns(params);
    }
}
