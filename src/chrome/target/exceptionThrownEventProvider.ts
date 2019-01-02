import { Crdp } from '../..';
import { CDTPEventsEmitterDiagnosticsModule } from './cdtpDiagnosticsModule';
import { ExceptionDetails } from './events';
import { CDTPStackTraceParser } from './cdtpStackTraceParser';
import { CDTPScriptsRegistry } from './cdtpScriptsRegistry';
import { injectable, inject } from 'inversify';
import { TYPES } from '../dependencyInjection.ts/types';

export interface IExceptionThrownEventProvider {

}

@injectable()
export class ExceptionThrownEventProvider extends CDTPEventsEmitterDiagnosticsModule<Crdp.RuntimeApi> implements IExceptionThrownEventProvider {
    protected readonly api: Crdp.RuntimeApi = this.protocolApi.Runtime;

    public readonly onExceptionThrown = this.addApiListener('exceptionThrown', async (params: Crdp.Runtime.ExceptionThrownEvent) =>
        ({
            timestamp: params.timestamp,
            exceptionDetails: await this.toExceptionDetails(params.exceptionDetails)
        }));

    private async toExceptionDetails(exceptionDetails: Crdp.Runtime.ExceptionDetails): Promise<ExceptionDetails> {
        return {
            exceptionId: exceptionDetails.exceptionId,
            text: exceptionDetails.text,
            lineNumber: exceptionDetails.lineNumber,
            columnNumber: exceptionDetails.columnNumber,
            script: exceptionDetails.scriptId ? await this._scriptsRegistry.getScriptById(exceptionDetails.scriptId) : undefined,
            url: exceptionDetails.url,
            stackTrace: exceptionDetails.stackTrace && await this._cdtpStackTraceParser.toStackTraceCodeFlow(exceptionDetails.stackTrace),
            exception: exceptionDetails.exception,
            executionContextId: exceptionDetails.executionContextId,
        };
    }

    constructor(
        @inject(TYPES.CDTPClient) private readonly protocolApi: Crdp.ProtocolApi,
        private readonly _cdtpStackTraceParser: CDTPStackTraceParser,
        private readonly _scriptsRegistry: CDTPScriptsRegistry,
    ) {
        super();
    }
}