import { Protocol as CDTP } from 'devtools-protocol';

import { CDTPEventsEmitterDiagnosticsModule } from '../infrastructure/cdtpDiagnosticsModule';
import { CDTPStackTraceParser } from '../protocolParsers/cdtpStackTraceParser';
import { CDTPScriptsRegistry } from '../registries/cdtpScriptsRegistry';
import { injectable, inject } from 'inversify';
import { TYPES } from '../../dependencyInjection.ts/types';
import { integer } from '../cdtpPrimitives';
import { IScript } from '../../internal/scripts/script';
import { CodeFlowStackTrace } from '../../internal/stackTraces/stackTrace';
import { CDTPDomainsEnabler } from '../infrastructure/cdtpDomainsEnabler';

export interface ExceptionThrownEvent {
    readonly timestamp: CDTP.Runtime.Timestamp;
    readonly exceptionDetails: ExceptionDetails;
}

export interface ExceptionDetails {
    readonly exceptionId: integer;
    readonly text: string;
    readonly lineNumber: integer;
    readonly columnNumber: integer;
    readonly script?: IScript;
    readonly url?: string;
    readonly stackTrace?: CodeFlowStackTrace<IScript>;
    readonly exception?: CDTP.Runtime.RemoteObject;
    readonly executionContextId?: CDTP.Runtime.ExecutionContextId;
}

export interface IExceptionThrownEventProvider {
    onExceptionThrown(listener: (event: ExceptionThrownEvent) => void): void;
}

@injectable()
export class CDTPExceptionThrownEventsProvider extends CDTPEventsEmitterDiagnosticsModule<CDTP.RuntimeApi> implements IExceptionThrownEventProvider {
    protected readonly api = this.protocolApi.Runtime;

    private readonly _stackTraceParser = new CDTPStackTraceParser(this._scriptsRegistry);

    public readonly onExceptionThrown = this.addApiListener('exceptionThrown', async (params: CDTP.Runtime.ExceptionThrownEvent) =>
        ({
            timestamp: params.timestamp,
            exceptionDetails: await this.toExceptionDetails(params.exceptionDetails)
        }));

    constructor(
        @inject(TYPES.CDTPClient) private readonly protocolApi: CDTP.ProtocolApi,
        @inject(TYPES.CDTPScriptsRegistry) private _scriptsRegistry: CDTPScriptsRegistry,
        @inject(TYPES.IDomainsEnabler) domainsEnabler: CDTPDomainsEnabler,
    ) {
        super(domainsEnabler);
    }

    private async toExceptionDetails(exceptionDetails: CDTP.Runtime.ExceptionDetails): Promise<ExceptionDetails> {
        return {
            exceptionId: exceptionDetails.exceptionId,
            text: exceptionDetails.text,
            lineNumber: exceptionDetails.lineNumber,
            columnNumber: exceptionDetails.columnNumber,
            script: exceptionDetails.scriptId ? await this._scriptsRegistry.getScriptByCdtpId(exceptionDetails.scriptId) : undefined,
            url: exceptionDetails.url,
            stackTrace: exceptionDetails.stackTrace && await this._stackTraceParser.toStackTraceCodeFlow(exceptionDetails.stackTrace),
            exception: exceptionDetails.exception,
            executionContextId: exceptionDetails.executionContextId,
        };
    }
}