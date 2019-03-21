/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import 'reflect-metadata';

// TODO: Add all necesary types so we can use inversifyjs to create our components
const TYPES = {
    ISession: Symbol.for('ISession'),
    ChromeDebugAdapter: Symbol.for('ChromeDebugAdapter'),
    TerminatingReason: Symbol.for('TerminatingReason'),
    CDTPClient: Symbol.for('chromeConnection.api'),
    IDOMInstrumentationBreakpoints: Symbol.for('IDOMInstrumentationBreakpoints'),
    IEventsToClientReporter: Symbol.for('IEventsToClientReporter'),
    IDebuggeeExecutionControl: Symbol.for('IDebuggeeExecutionControl'),
    IPauseOnExceptions: Symbol.for('IPauseOnExceptions'),
    IBreakpointFeaturesSupport: Symbol.for('IBreakpointFeaturesSupport'),
    IAsyncDebuggingConfiguration: Symbol.for('IAsyncDebuggingConfiguration'),
    IStackTracePresentationLogicProvider: Symbol.for('IStackTracePresentationLogicProvider'),
    IScriptSources: Symbol.for('IScriptSources'),
    ICDTPDebuggeeExecutionEventsProvider: Symbol.for('ICDTPDebuggeeExecutionEventsProvider'),
    IDebuggeeSteppingController: Symbol.for('IDebuggeeSteppingController'),
    IDebuggeeLauncher: Symbol.for('IDebuggeeLauncher'),
    ChromeDebugLogic: Symbol.for('ChromeDebugLogic'),
    ISourcesRetriever: Symbol.for('ISourcesRetriever'),
    CDTPScriptsRegistry: Symbol.for('CDTPScriptsRegistry'),
    ClientToInternal: Symbol.for('ClientToInternal'),
    InternalToClient: Symbol.for('InternalToClient'),
    StackTracesLogic: Symbol.for('StackTracesLogic'),
    BreakpointsLogic: Symbol.for('BreakpointsLogic'),
    PauseOnExceptionOrRejection: Symbol.for('PauseOnExceptionOrRejection'),
    Stepping: Symbol.for('Stepping'),
    DotScriptCommand: Symbol.for('DotScriptCommand'),
    BaseSourceMapTransformer: Symbol.for('BaseSourceMapTransformer'),
    BasePathTransformer: Symbol.for('BasePathTransformer'),
    IRuntimeStarter: Symbol.for('IRuntimeStarter'),
    SyncStepping: Symbol.for('SyncStepping'),
    AsyncStepping: Symbol.for('AsyncStepping'),
    ConnectedCDAConfiguration: Symbol.for('ConnectedCDAConfiguration'),
    ExceptionThrownEventProvider: Symbol.for('ExceptionThrownEventProvider'),
    ExecutionContextEventsProvider: Symbol.for('ExecutionContextEventsProvider'),
    IDebuggeeStateInspector: Symbol.for('IDebuggeeStateInspector'),
    IUpdateDebuggeeState: Symbol.for('IUpdateDebuggeeState'),
    LineColTransformer: Symbol.for('LineColTransformer'),
    ChromeConnection: Symbol.for('ChromeConnection'),
    IDebuggeeRuntimeVersionProvider: Symbol.for('IDebuggeeRuntimeVersionProvider'),
    IBrowserNavigation: Symbol.for('IBrowserNavigation'),
    IPausedOverlayConfigurer: Symbol.for('IPausedOverlayConfigurer'),
    INetworkCacheConfiguration: Symbol.for('INetworkCacheConfiguration'),
    ISupportedDomains: Symbol.for('ISupportedDomains'),
    IDebuggeeRunner: Symbol.for('IDebuggeeRunner'),
    ICDTPRuntime: Symbol.for('ICDTPRuntime'),
    IScriptParsedProvider: Symbol.for('IScriptParsedProvider'),
    ITargetBreakpoints: Symbol.for('ITargetBreakpoints'),
    IConsoleEventsProvider: Symbol.for('IConsoleEventsProvider'),
    ILogEventsProvider: Symbol.for('ILogEventsProvider'),
    IBlackboxPatternsConfigurer: Symbol.for('IBlackboxPatternsConfigurer'),
    IDomainsEnabler: Symbol.for('IDomainsEnabler'),
    ILogger: Symbol.for('ILogger'),
    ILoggerSetter: Symbol.for('ILoggerSetter'),
    IDomainsEnablerProvider: Symbol.for('IDomainsEnablerProvider'),
    ICommandHandlerDeclarer: Symbol.for('ICommandHandlerDeclarer'),
    IDebuggeePausedHandler: Symbol.for('IDebuggeePausedHandler'),
    ISchemaProvider: Symbol.for('ISchemaProvider'),
    UninitializedCDA: Symbol.for('UninitializedCDA'),
    UnconnectedCDA: Symbol.for('UnconnectedCDA'),
    ConnectingCDA: Symbol.for('ConnectingCDA'),
    ConnectedCDA: Symbol.for('ConnectedCDA'),
    TerminatingCDA: Symbol.for('TerminatingCDA'),
    UnconnectedCDAProvider: Symbol.for('UnconnectedCDAProvider'),
    ConnectedCDAProvider: Symbol.for('ConnectedCDAProvider'),
    TerminatingCDAProvider: Symbol.for('TerminatingCDAProvider'),
    ConnectingCDAProvider: Symbol.for('ConnectingCDAProvider'),
    IChromeDebugSessionOpts: Symbol.for('IChromeDebugSessionOpts'),
    IClientCapabilities: Symbol.for('IClientCapabilities'),
    IServiceComponent: Symbol.for('IServiceComponent'),
};

export { TYPES };
