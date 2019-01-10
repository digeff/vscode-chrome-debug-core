import { IFormattedExceptionLineDescription } from '../formattedExceptionParser';
import { ConnectedCDAConfiguration } from '../../client/chromeDebugAdapter/cdaConfiguration';

export class ExceptionStackTracePrintter {
    public constructor(private readonly _configuration: ConnectedCDAConfiguration) { }

    public isZeroBased(): boolean {
        return !this._configuration.clientCapabilities.linesStartAt1;
    }

    public toExceptionStackTracePrintted(formattedExceptionLines: IFormattedExceptionLineDescription[]): string {
        const stackTraceLines = formattedExceptionLines.map(line => line.generateDescription(this.isZeroBased()));
        const stackTracePrintted = stackTraceLines.join('\n') + '\n';
        return stackTracePrintted;
    }
}