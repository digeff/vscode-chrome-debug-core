/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { Container, interfaces } from 'inversify';
import { TYPES } from './types';
import { EventSender } from '../client/eventSender';
import { CDTPBreakpointFeaturesSupport } from '../cdtpDebuggee/features/cdtpBreakpointFeaturesSupport';
import { IStackTracePresentationLogicProvider, StackTracesLogic } from '../internal/stackTraces/stackTracesLogic';
import { SourcesLogic } from '../internal/sources/sourcesLogic';
import { CDTPScriptsRegistry } from '../cdtpDebuggee/registries/cdtpScriptsRegistry';
import { ClientToInternal } from '../client/clientToInternal';
import { InternalToClient } from '../client/internalToClient';
import { BreakpointsLogic } from '../internal/breakpoints/features/breakpointsLogic';
import { PauseOnExceptionOrRejection } from '../internal/exceptions/pauseOnException';
import { Stepping } from '../internal/stepping/stepping';
import { DotScriptCommand } from '../internal/sources/features/dotScriptsCommand';
import { BreakpointsRegistry } from '../internal/breakpoints/registries/breakpointsRegistry';
import { ExistingBPsForJustParsedScriptSetter } from '../internal/breakpoints/features/existingBPsForJustParsedScriptSetter';
import { PauseScriptLoadsToSetBPs } from '../internal/breakpoints/features/pauseScriptLoadsToSetBPs';
import { BPRecipeAtLoadedSourceLogic } from '../internal/breakpoints/features/bpRecipeAtLoadedSourceLogic';
import { DeleteMeScriptsRegistry } from '../internal/scripts/scriptsRegistry';
import { SyncStepping } from '../internal/stepping/features/syncStepping';
import { AsyncStepping } from '../internal/stepping/features/asyncStepping';
import { CDTPExceptionThrownEventsProvider } from '../cdtpDebuggee/eventsProviders/cdtpExceptionThrownEventsProvider';
import { CDTPExecutionContextEventsProvider } from '../cdtpDebuggee/eventsProviders/cdtpExecutionContextEventsProvider';
import { CDTPInspectDebugeeState } from '../cdtpDebuggee/features/cdtpInspectDebugeeState';
import { CDTPUpdateDebugeeState } from '../cdtpDebuggee/features/cdtpUpdateDebugeeState';
import { SmartStepLogic } from '../internal/features/smartStep';
import { LineColTransformer } from '../../transformers/lineNumberTransformer';
import { ChromeDebugLogic } from '../chromeDebugAdapter';
import { CDTPOnScriptParsedEventProvider } from '../cdtpDebuggee/eventsProviders/cdtpOnScriptParsedEventProvider';
import { CDTDebuggeeExecutionEventsProvider } from '../cdtpDebuggee/eventsProviders/cdtpDebuggeeExecutionEventsProvider';
import { CDTPDebuggeeBreakpoints } from '../cdtpDebuggee/features/cdtpDebuggeeBreakpoints';
import { IDOMInstrumentationBreakpoints, CDTPDOMDebugger } from '../cdtpDebuggee/features/cdtpDOMInstrumentationBreakpoints';
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

export function bindAll(loggingConfiguration: MethodsCalledLoggerConfiguration, di: Container, callback: ComponentCustomizationCallback) {
    bind<IDOMInstrumentationBreakpoints>(loggingConfiguration, di, TYPES.IDOMInstrumentationBreakpoints, CDTPDOMDebugger, callback);
    bind<IAsyncDebuggingConfigurer>(loggingConfiguration, di, TYPES.IAsyncDebuggingConfiguration, CDTPAsyncDebuggingConfigurer, callback);
    bind<IScriptSourcesRetriever>(loggingConfiguration, di, TYPES.IScriptSources, CDTPScriptSourcesRetriever, callback);
    bind<IStackTracePresentationLogicProvider>(loggingConfiguration, di, TYPES.IStackTracePresentationLogicProvider, SmartStepLogic, callback);
    //  bind<IStackTracePresentationLogicProvider>(configuration, di, TYPES.IStackTracePresentationLogicProvider, SkipFilesLogic, callback);
    bind(loggingConfiguration, di, TYPES.IEventsToClientReporter, EventSender, callback);
    bind(loggingConfiguration, di, TYPES.ChromeDebugLogic, ChromeDebugLogic, callback);
    bind(loggingConfiguration, di, TYPES.SourcesLogic, SourcesLogic, callback);
    bind(loggingConfiguration, di, TYPES.CDTPScriptsRegistry, CDTPScriptsRegistry, callback);
    bind(loggingConfiguration, di, TYPES.ClientToInternal, ClientToInternal, callback);
    bind(loggingConfiguration, di, TYPES.InternalToClient, InternalToClient, callback);
    bind(loggingConfiguration, di, TYPES.StackTracesLogic, StackTracesLogic, callback);
    bind(loggingConfiguration, di, TYPES.BreakpointsLogic, BreakpointsLogic, callback);
    bind(loggingConfiguration, di, TYPES.PauseOnExceptionOrRejection, PauseOnExceptionOrRejection, callback);
    bind(loggingConfiguration, di, TYPES.Stepping, Stepping, callback);
    bind(loggingConfiguration, di, TYPES.DotScriptCommand, DotScriptCommand, callback);
    bind(loggingConfiguration, di, ExistingBPsForJustParsedScriptSetter, ExistingBPsForJustParsedScriptSetter, callback);
    bind(loggingConfiguration, di, TYPES.DeleteMeScriptsRegistry, DeleteMeScriptsRegistry, callback);
    //  bind<BaseSourceMapTransformer>(configuration, di, TYPES.BaseSourceMapTransformer, BaseSourceMapTransformer, callback);
    //  bind<BasePathTransformer>(configuration, di, TYPES.BasePathTransformer, BasePathTransformer, callback);
    //  bind<IStackTracePresentationLogicProvider>(configuration, di, TYPES.IStackTracePresentationLogicProvider, SkipFilesLogic, callback);
    bind(loggingConfiguration, di, TYPES.IDebugeeExecutionControl, CDTPDebugeeExecutionController, callback);
    bind(loggingConfiguration, di, TYPES.IPauseOnExceptions, CDTPPauseOnExceptionsConfigurer, callback);
    bind(loggingConfiguration, di, TYPES.IBreakpointFeaturesSupport, CDTPBreakpointFeaturesSupport, callback);
    bind(loggingConfiguration, di, TYPES.IInspectDebugeeState, CDTPInspectDebugeeState, callback);
    bind(loggingConfiguration, di, TYPES.IUpdateDebugeeState, CDTPUpdateDebugeeState, callback);
    bind(loggingConfiguration, di, TYPES.SyncStepping, SyncStepping, callback);
    bind(loggingConfiguration, di, TYPES.AsyncStepping, AsyncStepping, callback);
    // bind<cdtpBreakpointIdsRegistry>(configuration, di, cdtpBreakpointIdsRegistry, cdtpBreakpointIdsRegistry, callback);
    bind(loggingConfiguration, di, TYPES.ExceptionThrownEventProvider, CDTPExceptionThrownEventsProvider, callback);
    bind(loggingConfiguration, di, TYPES.ExecutionContextEventsProvider, CDTPExecutionContextEventsProvider, callback);
    bind(loggingConfiguration, di, TYPES.LineColTransformer, LineColTransformer, callback);
    bind(loggingConfiguration, di, TYPES.IBrowserNavigation, CDTPBrowserNavigator, callback);
    bind(loggingConfiguration, di, TYPES.IScriptParsedProvider, CDTPOnScriptParsedEventProvider, callback);
    bind(loggingConfiguration, di, TYPES.ICDTPDebuggerEventsProvider, CDTDebuggeeExecutionEventsProvider, callback);
    bind(loggingConfiguration, di, TYPES.IDebugeeVersionProvider, CDTPDebugeeRuntimeVersionProvider, callback);
    bind(loggingConfiguration, di, TYPES.ITargetBreakpoints, CDTPDebuggeeBreakpoints, callback);
    bind(loggingConfiguration, di, TYPES.IConsoleEventsProvider, CDTPConsoleEventsProvider, callback);
    bind(loggingConfiguration, di, TYPES.ILogEventsProvider, CDTPLogEventsProvider, callback);
    bind(loggingConfiguration, di, TYPES.IDebugeeSteppingController, CDTPDebugeeSteppingController, callback);
    bind(loggingConfiguration, di, TYPES.IBlackboxPatternsConfigurer, CDTPBlackboxPatternsConfigurer, callback);
    bind(loggingConfiguration, di, TYPES.IDomainsEnabler, CDTPDomainsEnabler, callback);
    bind(loggingConfiguration, di, LoadedSourcesRegistry, LoadedSourcesRegistry, callback);
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
