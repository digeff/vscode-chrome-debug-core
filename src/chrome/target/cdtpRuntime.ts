import { Crdp } from '../..';
import { CDTPEventsEmitterDiagnosticsModule } from './cdtpDiagnosticsModule';
import { TargetToInternal } from './targetToInternal';
import { InternalToTarget } from './internalToTarget';

export class CDTPRuntime extends CDTPEventsEmitterDiagnosticsModule<Crdp.RuntimeApi> {
    public readonly onExecutionContextsCleared = this.addApiListener('executionContextsCleared', (params: void) => params);

    public readonly onExecutionContextDestroyed = this.addApiListener('executionContextDestroyed', async (params: Crdp.Runtime.ExecutionContextDestroyedEvent) =>
        this._crdpToInternal.markExecutionContextAsDestroyed(params.executionContextId));

    public readonly onExecutionContextCreated = this.addApiListener('executionContextCreated', async (params: Crdp.Runtime.ExecutionContextCreatedEvent) =>
        this._crdpToInternal.toNewExecutionContext(params.context.id));

    public readonly onExceptionThrown = this.addApiListener('exceptionThrown', async (params: Crdp.Runtime.ExceptionThrownEvent) =>
        ({
            timestamp: params.timestamp,
            exceptionDetails: await this._crdpToInternal.toExceptionDetails(params.exceptionDetails)
        }));

    public readonly onConsoleAPICalled = this.addApiListener('consoleAPICalled', async (params: Crdp.Runtime.ConsoleAPICalledEvent) =>
        ({
            args: params.args, context: params.context, executionContextId: params.executionContextId,
            stackTrace: params.stackTrace && await this._crdpToInternal.toStackTraceCodeFlow(params.stackTrace), timestamp: params.timestamp, type: params.type
        }));

    public enable(): Promise<void> {
        return this.api.enable();
    }

    public callFunctionOn(params: Crdp.Runtime.CallFunctionOnRequest): Promise<Crdp.Runtime.CallFunctionOnResponse> {
        return this.api.callFunctionOn(params);
    }

    public getProperties(params: Crdp.Runtime.GetPropertiesRequest): Promise<Crdp.Runtime.GetPropertiesResponse> {
        return this.api.getProperties(params);
    }

    public evaluate(params: Crdp.Runtime.EvaluateRequest): Promise<Crdp.Runtime.EvaluateResponse> {
        params.expression = this._internalToTarget.addURLIfMissing(params.expression);
        return this.api.evaluate(params);
    }

    public async runIfWaitingForDebugger(): Promise<void> {
        // This is a CDP version difference which will have to be handled more elegantly with others later...
        // For now, we need to send both messages and ignore a failing one.
        try {
            await Promise.all([
                this.api.runIfWaitingForDebugger(),
                (this.api as any).run()
            ]);
        } catch (exception) {
            // Ignore the failed call
        }
    }

    constructor(
        protected readonly api: Crdp.RuntimeApi,
        private readonly _crdpToInternal: TargetToInternal,
        private readonly _internalToTarget: InternalToTarget) {
        super();
    }
}
