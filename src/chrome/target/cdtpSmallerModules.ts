import { CDTPEnableableDiagnosticsModule, CDTPEventsEmitterDiagnosticsModule, IEnableableApi } from './cdtpDiagnosticsModule';
import { Crdp } from '../..';
import { CDTPStackTraceParser } from './cdtpStackTraceParser';
import { injectable, inject } from 'inversify';
import { LogEntry } from './events';
import { TYPES } from '../dependencyInjection.ts/types';

export class CDTPConsole extends CDTPEventsEmitterDiagnosticsModule<Crdp.ConsoleApi> {
    public readonly onMessageAdded = this.addApiListener('messageAdded', (params: Crdp.Console.MessageAddedEvent) => params);

    constructor(protected api: Crdp.ConsoleApi) {
        super();
    }
}

export class CDTPSchema {
    public async getDomains(): Promise<Crdp.Schema.Domain[]> {
        return (await this.api.getDomains()).domains;
    }

    constructor(protected api: Crdp.SchemaApi) {}
}

export interface IDOMInstrumentationBreakpoints {
    setInstrumentationBreakpoint(params: Crdp.DOMDebugger.SetInstrumentationBreakpointRequest): Promise<void>;
    removeInstrumentationBreakpoint(params: Crdp.DOMDebugger.SetInstrumentationBreakpointRequest): Promise<void>;
}

@injectable()
export class CDTPDOMDebugger implements IDOMInstrumentationBreakpoints {
    protected api = this._protocolApi.DOMDebugger;

    public setInstrumentationBreakpoint(params: Crdp.DOMDebugger.SetInstrumentationBreakpointRequest): Promise<void> {
        return this.api.setInstrumentationBreakpoint(params);
    }

    public removeInstrumentationBreakpoint(params: Crdp.DOMDebugger.SetInstrumentationBreakpointRequest): Promise<void> {
        return this.api.removeInstrumentationBreakpoint(params);
    }

    constructor(@inject(TYPES.CDTPClient) protected _protocolApi: Crdp.ProtocolApi) {}
}

export interface IBrowserNavigation extends IEnableableApi<void, void> {
    navigate(params: Crdp.Page.NavigateRequest): Promise<Crdp.Page.NavigateResponse>;
    reload(params: Crdp.Page.ReloadRequest): Promise<void>;
    onFrameNavigated(listener: (params: Crdp.Page.FrameNavigatedEvent) => void): void;
}

@injectable()
export class CDTPPage extends CDTPEventsEmitterDiagnosticsModule<Crdp.PageApi> implements IBrowserNavigation {
    protected api = this._protocolApi.Page;

    public readonly onFrameNavigated = this.addApiListener('frameNavigated', (params: Crdp.Page.FrameNavigatedEvent) => params);

    public navigate(params: Crdp.Page.NavigateRequest): Promise<Crdp.Page.NavigateResponse> {
        return this.api.navigate(params);
    }

    public reload(params: Crdp.Page.ReloadRequest): Promise<void> {
        return this.api.reload(params);
    }

    constructor(@inject(TYPES.CDTPClient) protected _protocolApi: Crdp.ProtocolApi) {
        super();
    }
}

export interface INetworkCacheConfiguration {
    setCacheDisabled(params: Crdp.Network.SetCacheDisabledRequest): Promise<void>;
}

export class CDTPNetwork extends CDTPEventsEmitterDiagnosticsModule<Crdp.NetworkApi, Crdp.Network.EnableRequest> implements INetworkCacheConfiguration {
    public disable(): Promise<void> {
        return this.api.disable();
    }

    public setCacheDisabled(params: Crdp.Network.SetCacheDisabledRequest): Promise<void> {
        return this.api.setCacheDisabled(params);
    }

    constructor(protected api: Crdp.NetworkApi) {
        super();
    }
}

export interface IDebugeeVersionProvider {
    getVersion(): Promise<Crdp.Browser.GetVersionResponse>;
}

@injectable()
export class CDTPBrowser implements IDebugeeVersionProvider {
    protected api = this._protocolApi.Browser;

    public getVersion(): Promise<Crdp.Browser.GetVersionResponse> {
        return this.api.getVersion();
    }

    constructor(@inject(TYPES.CDTPClient) protected _protocolApi: Crdp.ProtocolApi) {
    }
}

export interface IPausedOverlay {
    setPausedInDebuggerMessage(params: Crdp.Overlay.SetPausedInDebuggerMessageRequest): Promise<void>;
}

export class CDTPOverlay extends CDTPEnableableDiagnosticsModule<Crdp.OverlayApi> implements IPausedOverlay {
    public setPausedInDebuggerMessage(params: Crdp.Overlay.SetPausedInDebuggerMessageRequest): Promise<void> {
        return this.api.setPausedInDebuggerMessage(params);
    }

    constructor(protected api: Crdp.OverlayApi) {
        super();
    }
}

export class CDTPLog extends CDTPEventsEmitterDiagnosticsModule<Crdp.LogApi> {
    public readonly onEntryAdded = this.addApiListener('entryAdded', async (params: Crdp.Log.EntryAddedEvent) => await this.toLogEntry(params.entry));

    private async toLogEntry(entry: Crdp.Log.LogEntry): Promise<LogEntry> {
        return {
            source: entry.source,
            level: entry.level,
            text: entry.text,
            timestamp: entry.timestamp,
            url: entry.url,
            lineNumber: entry.lineNumber,
            stackTrace: entry.stackTrace && await this._crdpToInternal.toStackTraceCodeFlow(entry.stackTrace),
            networkRequestId: entry.networkRequestId,
            workerId: entry.workerId,
            args: entry.args,
        };
    }

    constructor(protected readonly api: Crdp.LogApi, private readonly _crdpToInternal: CDTPStackTraceParser) {
        super();
    }
}
