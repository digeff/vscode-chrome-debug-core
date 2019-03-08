/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { Container, interfaces } from 'inversify';
import { TYPES } from './types';
import { EventSender } from '../client/eventSender';
import { CDTPBreakpointFeaturesSupport } from '../cdtpDebuggee/features/cdtpBreakpointFeaturesSupport';
import { IStackTracePresentationDetailsProvider, StackTracePresenter } from '../internal/stackTraces/stackTracePresenter';
import { SourcesRetriever } from '../internal/sources/sourcesRetriever';
import { CDTPScriptsRegistry } from '../cdtpDebuggee/registries/cdtpScriptsRegistry';
import { BreakpointsUpdater } from '../internal/breakpoints/features/breakpointsUpdater';
import { PauseOnExceptionOrRejection } from '../internal/exceptions/pauseOnException';
import { SteppingRequestsHandler } from '../internal/stepping/steppingRequestsHandler';
import { DotScriptCommand } from '../internal/sources/features/dotScriptsCommand';
import { ExistingBPsForJustParsedScriptSetter } from '../internal/breakpoints/features/existingBPsForJustParsedScriptSetter';
import { DeleteMeScriptsRegistry } from '../internal/scripts/scriptsRegistry';
import { SyncStepping } from '../internal/stepping/features/syncStepping';
import { AsyncStepping } from '../internal/stepping/features/asyncStepping';
import { CDTPExceptionThrownEventsProvider } from '../cdtpDebuggee/eventsProviders/cdtpExceptionThrownEventsProvider';
import { CDTPExecutionContextEventsProvider } from '../cdtpDebuggee/eventsProviders/cdtpExecutionContextEventsProvider';
import { CDTPDebugeeStateInspector } from '../cdtpDebuggee/features/cdtpDebugeeStateInspector';
import { CDTPDebugeeStateSetter } from '../cdtpDebuggee/features/cdtpDebugeeStateSetter';
import { SmartStepLogic } from '../internal/features/smartStep';
import { LineColTransformer } from '../../transformers/lineNumberTransformer';
import { ChromeDebugLogic } from '../chromeDebugAdapter';
import { CDTPOnScriptParsedEventProvider } from '../cdtpDebuggee/eventsProviders/cdtpOnScriptParsedEventProvider';
import { CDTPDebuggeeExecutionEventsProvider } from '../cdtpDebuggee/eventsProviders/cdtpDebuggeeExecutionEventsProvider';
import { CDTPDebuggeeBreakpointsSetter } from '../cdtpDebuggee/features/cdtpDebuggeeBreakpointsSetter';
import { IDOMInstrumentationBreakpointsSetter, CDTPDOMInstrumentationBreakpointsSetter } from '../cdtpDebuggee/features/cdtpDOMInstrumentationBreakpointsSetter';
import { CDTPBrowserNavigator } from '../cdtpDebuggee/features/cdtpBrowserNavigator';
import { CDTPLogEventsProvider } from '../cdtpDebuggee/eventsProviders/cdtpLogEventsProvider';
import { CDTPConsoleEventsProvider } from '../cdtpDebuggee/eventsProviders/cdtpConsoleEventsProvider';
import { IAsyncDebuggingConfigurer, CDTPAsyncDebuggingConfigurer } from '../cdtpDebuggee/features/cdtpAsyncDebuggingConfigurer';
import { IScriptSourcesRetriever, CDTPScriptSourcesRetriever } from '../cdtpDebuggee/features/cdtpScriptSourcesRetriever';
import { CDTPDebugeeExecutionController } from '../cdtpDebuggee/features/cdtpDebugeeExecutionController';
import { CDTPPauseOnExceptionsConfigurer } from '../cdtpDebuggee/features/cdtpPauseOnExceptionsConfigurer';
import { CDTPDebugeeSteppingController } from '../cdtpDebuggee/features/cdtpDebugeeSteppingController';
import { CDTPDebugeeRuntimeVersionProvider } from '../cdtpDebuggee/features/cdtpDebugeeRuntimeVersionProvider';
import { CDTPBlackboxPatternsConfigurer } from '../cdtpDebuggee/features/cdtpBlackboxPatternsConfigurer';
import { CDTPDomainsEnabler } from '../cdtpDebuggee/infrastructure/cdtpDomainsEnabler';
import { LoadedSourcesRegistry } from '../cdtpDebuggee/registries/loadedSourcesRegistry';
import { ComponentCustomizationCallback } from './di';
import { MethodsCalledLogger, MethodsCalledLoggerConfiguration } from '../logging/methodsCalledLogger';
import { printTopLevelObjectDescription } from '../logging/printObjectDescription';
import { SkipFilesLogic } from '../internal/features/skipFiles';
import { ToggleSkipFileStatusRequestHandler } from '../internal/features/toggleSkipFileStatusRequestHandler';
import { SetBreakpointsRequestHandler } from '../internal/breakpoints/features/setBreakpointsRequestHandler';
import { SourceRequestHandler } from '../internal/sources/sourceRequestHandler';
import { PauseOnExceptionRequestHandlers } from '../internal/exceptions/pauseOnExceptionRequestHandlers';
import { StackTraceRequestHandler } from '../internal/stackTraces/stackTraceRequestHandler';
import { ThreadsRequestHandler } from '../client/threadsRequestHandler';
import { ClientLifecycleRequestsHandler } from '../client/clientLifecycleRequestsHandler';
import { EvaluateRequestHandler } from '../internal/variables/evaluateRequestHandler';
import { ScopesRequestHandler } from '../internal/variables/scopesRequestHandler';
import { VariablesRequestHandler } from '../internal/variables/variablesRequestHandler';
import { DebuggeePausedHandler } from '../internal/features/debuggeePausedHandler';
import { BaseSourceMapTransformer, BasePathTransformer } from '../..';
import { EagerSourceMapTransformer } from '../../transformers/eagerSourceMapTransformer';
import { ConfigurationBasedPathTransformer } from '../../transformers/configurationBasedPathTransformer';

// TODO: This file needs a lot of work. We need to improve/simplify all this code when possible

export function bindAll(loggingConfiguration: MethodsCalledLoggerConfiguration, di: Container, callback: ComponentCustomizationCallback) {
    bind<IDOMInstrumentationBreakpointsSetter>(loggingConfiguration, di, TYPES.IDOMInstrumentationBreakpoints, CDTPDOMInstrumentationBreakpointsSetter, callback);
    bind<IAsyncDebuggingConfigurer>(loggingConfiguration, di, TYPES.IAsyncDebuggingConfiguration, CDTPAsyncDebuggingConfigurer, callback);
    bind<IScriptSourcesRetriever>(loggingConfiguration, di, TYPES.IScriptSources, CDTPScriptSourcesRetriever, callback);
    bind<IStackTracePresentationDetailsProvider>(loggingConfiguration, di, TYPES.IStackTracePresentationLogicProvider, SmartStepLogic, callback);
    bind<IStackTracePresentationDetailsProvider>(loggingConfiguration, di, TYPES.IStackTracePresentationLogicProvider, SkipFilesLogic, callback);
    bind(loggingConfiguration, di, TYPES.IEventsToClientReporter, EventSender, callback);
    bind(loggingConfiguration, di, TYPES.ChromeDebugLogic, ChromeDebugLogic, callback);
    bind(loggingConfiguration, di, TYPES.SourcesLogic, SourcesRetriever, callback);
    bind(loggingConfiguration, di, TYPES.CDTPScriptsRegistry, CDTPScriptsRegistry, callback);
    bind(loggingConfiguration, di, TYPES.StackTracesLogic, StackTracePresenter, callback);
    bind(loggingConfiguration, di, TYPES.BreakpointsLogic, BreakpointsUpdater, callback);
    bind(loggingConfiguration, di, TYPES.PauseOnExceptionOrRejection, PauseOnExceptionOrRejection, callback);
    bind(loggingConfiguration, di, TYPES.DotScriptCommand, DotScriptCommand, callback);
    bind(loggingConfiguration, di, ExistingBPsForJustParsedScriptSetter, ExistingBPsForJustParsedScriptSetter, callback);
    bind(loggingConfiguration, di, TYPES.DeleteMeScriptsRegistry, DeleteMeScriptsRegistry, callback);
    //  bind<BaseSourceMapTransformer>(configuration, di, TYPES.BaseSourceMapTransformer, BaseSourceMapTransformer, callback);
    //  bind<BasePathTransformer>(configuration, di, TYPES.BasePathTransformer, BasePathTransformer, callback);
    //  bind<IStackTracePresentationLogicProvider>(configuration, di, TYPES.IStackTracePresentationLogicProvider, SkipFilesLogic, callback);
    bind(loggingConfiguration, di, TYPES.IDebugeeExecutionControl, CDTPDebugeeExecutionController, callback);
    bind(loggingConfiguration, di, TYPES.IPauseOnExceptions, CDTPPauseOnExceptionsConfigurer, callback);
    bind(loggingConfiguration, di, TYPES.IBreakpointFeaturesSupport, CDTPBreakpointFeaturesSupport, callback);
    bind(loggingConfiguration, di, TYPES.IInspectDebugeeState, CDTPDebugeeStateInspector, callback);
    bind(loggingConfiguration, di, TYPES.IUpdateDebugeeState, CDTPDebugeeStateSetter, callback);
    bind(loggingConfiguration, di, TYPES.SyncStepping, SyncStepping, callback);
    bind(loggingConfiguration, di, TYPES.AsyncStepping, AsyncStepping, callback);
    // bind<cdtpBreakpointIdsRegistry>(configuration, di, cdtpBreakpointIdsRegistry, cdtpBreakpointIdsRegistry, callback);
    bind(loggingConfiguration, di, TYPES.ExceptionThrownEventProvider, CDTPExceptionThrownEventsProvider, callback);
    bind(loggingConfiguration, di, TYPES.ExecutionContextEventsProvider, CDTPExecutionContextEventsProvider, callback);
    bind(loggingConfiguration, di, TYPES.LineColTransformer, LineColTransformer, callback);
    bind(loggingConfiguration, di, TYPES.IBrowserNavigation, CDTPBrowserNavigator, callback);
    bind(loggingConfiguration, di, TYPES.IScriptParsedProvider, CDTPOnScriptParsedEventProvider, callback);
    bind(loggingConfiguration, di, TYPES.ICDTPDebuggeeExecutionEventsProvider, CDTPDebuggeeExecutionEventsProvider, callback);
    bind(loggingConfiguration, di, TYPES.IDebugeeVersionProvider, CDTPDebugeeRuntimeVersionProvider, callback);
    bind(loggingConfiguration, di, TYPES.ITargetBreakpoints, CDTPDebuggeeBreakpointsSetter, callback);
    bind(loggingConfiguration, di, TYPES.IConsoleEventsProvider, CDTPConsoleEventsProvider, callback);
    bind(loggingConfiguration, di, TYPES.ILogEventsProvider, CDTPLogEventsProvider, callback);
    bind(loggingConfiguration, di, TYPES.IDebugeeSteppingController, CDTPDebugeeSteppingController, callback);
    bind(loggingConfiguration, di, TYPES.IBlackboxPatternsConfigurer, CDTPBlackboxPatternsConfigurer, callback);
    bind(loggingConfiguration, di, TYPES.IDomainsEnabler, CDTPDomainsEnabler, callback);
    bind(loggingConfiguration, di, LoadedSourcesRegistry, LoadedSourcesRegistry, callback);

    bind(loggingConfiguration, di, TYPES.IDebuggeePausedHandler, DebuggeePausedHandler, callback);

    // Command handler declarers
    bind(loggingConfiguration, di, TYPES.ICommandHandlerDeclarer, ClientLifecycleRequestsHandler, callback);
    bind(loggingConfiguration, di, TYPES.ICommandHandlerDeclarer, EvaluateRequestHandler, callback);
    bind(loggingConfiguration, di, TYPES.ICommandHandlerDeclarer, PauseOnExceptionRequestHandlers, callback);
    bind(loggingConfiguration, di, TYPES.ICommandHandlerDeclarer, ScopesRequestHandler, callback);
    bind(loggingConfiguration, di, TYPES.ICommandHandlerDeclarer, SetBreakpointsRequestHandler, callback);
    bind(loggingConfiguration, di, TYPES.ICommandHandlerDeclarer, SourceRequestHandler, callback);
    bind(loggingConfiguration, di, TYPES.ICommandHandlerDeclarer, StackTraceRequestHandler, callback);
    bind(loggingConfiguration, di, TYPES.ICommandHandlerDeclarer, SteppingRequestsHandler, callback);
    bind(loggingConfiguration, di, TYPES.ICommandHandlerDeclarer, ThreadsRequestHandler, callback);
    bind(loggingConfiguration, di, TYPES.ICommandHandlerDeclarer, ToggleSkipFileStatusRequestHandler, callback);
    bind(loggingConfiguration, di, TYPES.ICommandHandlerDeclarer, VariablesRequestHandler, callback);

    bind(loggingConfiguration, di, TYPES.BaseSourceMapTransformer, EagerSourceMapTransformer, callback);
    bind(loggingConfiguration, di, TYPES.BasePathTransformer, ConfigurationBasedPathTransformer, callback);
}

function bind<T extends object>(configuration: MethodsCalledLoggerConfiguration, container: Container, serviceIdentifier: interfaces.ServiceIdentifier<T>, newable: interfaces.Newable<T>, callback: ComponentCustomizationCallback): void {
    container.bind<T>(serviceIdentifier).to(newable).inSingletonScope().onActivation((_context, object) => {
        const objectWithLogging = wrapWithLogging(configuration, object, serviceIdentifier);
        const possibleOverwrittenComponent = callback(serviceIdentifier, objectWithLogging, identifier => _context.container.get(identifier));
        if (objectWithLogging === possibleOverwrittenComponent) {
            return objectWithLogging;
        } else {
            return wrapWithLogging(configuration, possibleOverwrittenComponent, `${getName<T>(serviceIdentifier)}_Override`);
        }
    });
}

const prefixLength = 'Symbol('.length;
const postfixLength = ')'.length;
function getName<T extends object>(serviceIdentifier: string | symbol | interfaces.Newable<T> | interfaces.Abstract<T>) {
    if (typeof serviceIdentifier === 'symbol') {
        return serviceIdentifier.toString().slice(prefixLength, -postfixLength);
    } else {
        return printTopLevelObjectDescription(serviceIdentifier);
    }
}

function wrapWithLogging<T extends object>(configuration: MethodsCalledLoggerConfiguration, object: T, serviceIdentifier: string | symbol | interfaces.Newable<T> | interfaces.Abstract<T>) {
    return new MethodsCalledLogger<T>(configuration, object, getName(serviceIdentifier)).wrapped();
}
