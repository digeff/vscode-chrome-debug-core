import 'reflect-metadata';

// TODO: Add all necesary types so we can use inversifyjs to create our components
const TYPES = {
    ISession: Symbol.for('ISession'),
    communicator: Symbol.for('communicator'),
    CDTPClient: Symbol.for('chromeConnection.api'),
    IDOMInstrumentationBreakpoints: Symbol.for('IDOMInstrumentationBreakpoints'),
    IEventsToClientReporter: Symbol.for('IEventsToClientReporter'),
    IDebugeeExecutionControl: Symbol.for('IDebugeeExecutionControl'),
    IPauseOnExceptions: Symbol.for('IPauseOnExceptions'),
    IBreakpointFeaturesSupport: Symbol.for('IBreakpointFeaturesSupport'),
    IAsyncDebuggingConfiguration: Symbol.for('IAsyncDebuggingConfiguration'),
    IStackTracePresentationLogicProvider: Symbol.for('IStackTracePresentationLogicProvider'),
    IScriptSources: Symbol.for('IScriptSources'),
    EventsConsumedByConnectedCDA: Symbol.for('EventsConsumedByConnectedCDA'),
    ICDTPDebuggerEventsProvider: Symbol.for('ICDTPDebuggerEventsProvider'),
    IDebuggeeLauncher: Symbol.for('IDebuggeeLauncher'),
    CDTPStackTraceParser: Symbol.for('CDTPStackTraceParser'),
    CDTPLocationParser: Symbol.for('CDTPLocationParser'),
    ChromeDebugLogic: Symbol.for('ChromeDebugLogic'),
    SourcesLogic: Symbol.for('SourcesLogic'),
    CDTPScriptsRegistry: Symbol.for('CDTPScriptsRegistry'),
    ClientToInternal: Symbol.for('ClientToInternal'),
    InternalToClient: Symbol.for('InternalToClient'),
    StackTracesLogic: Symbol.for('StackTracesLogic'),
    BreakpointsLogic: Symbol.for('BreakpointsLogic'),
    PauseOnExceptionOrRejection: Symbol.for('PauseOnExceptionOrRejection'),
    Stepping: Symbol.for('Stepping'),
    DotScriptCommand: Symbol.for('DotScriptCommand'),
    CDTPDebugger: Symbol.for('CDTPDebugger'),
    BreakpointsRegistry: Symbol.for('BreakpointsRegistry'),
    ReAddBPsWhenSourceIsLoaded: Symbol.for('ReAddBPsWhenSourceIsLoaded'),
    PauseScriptLoadsToSetBPs: Symbol.for('PauseScriptLoadsToSetBPs'),
    BPRecipieInLoadedSourceLogic: Symbol.for('BPRecipieInLoadedSourceLogic'),
    EventSender: Symbol.for('EventSender'),
    CDTPDiagnostics: Symbol.for('CDTPDiagnostics'),
    DeleteMeScriptsRegistry: Symbol.for('DeleteMeScriptsRegistry'),
    BaseSourceMapTransformer: Symbol.for('BaseSourceMapTransformer'),
    BasePathTransformer: Symbol.for('BasePathTransformer'),
    SyncStepping: Symbol.for('SyncStepping'),
    AsyncStepping: Symbol.for('AsyncStepping'),
    ConnectedCDAConfiguration: Symbol.for('ConnectedCDAConfiguration'),
    BreakpointIdRegistry: Symbol.for('BreakpointIdRegistry'),
    ExceptionThrownEventProvider: Symbol.for('ExceptionThrownEventProvider'),
    ExecutionContextEventsProvider: Symbol.for('ExecutionContextEventsProvider'),
    IInspectDebugeeState: Symbol.for('IInspectDebugeeState'),
    IUpdateDebugeeState: Symbol.for('IUpdateDebugeeState'),
    LineColTransformer: Symbol.for('LineColTransformer'),
    ChromeConnection: Symbol.for('ChromeConnection'),
    IDebugeeStepping: Symbol.for('IDebugeeStepping'),
    IDebugeeVersionProvider: Symbol.for('IDebugeeVersionProvider'),
    IBrowserNavigation: Symbol.for('IBrowserNavigation'),
    IPausedOverlay: Symbol.for('IPausedOverlay'),
    INetworkCacheConfiguration: Symbol.for('INetworkCacheConfiguration'),
    ISupportedDomains: Symbol.for('ISupportedDomains'),
    IDebugeeRunner: Symbol.for('IDebugeeRunner'),
    ICDTPRuntime: Symbol.for('ICDTPRuntime'),
    IScriptParsedProvider: Symbol.for('IScriptParsedProvider'),
    ITargetBreakpoints: Symbol.for('ITargetBreakpoints'),
};

export { TYPES };
