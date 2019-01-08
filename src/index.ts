/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import 'reflect-metadata'; // We need to import this before any inject attempts to use it

/** Normally, a consumer could require and use this and get the same instance. But if -core is npm linked, there may be two instances of file in play. */
import { logger } from 'vscode-debugadapter';

import * as chromeConnection from './chrome/chromeConnection';
import { ChromeDebugLogic, LoadedSourceEventReason } from './chrome/chromeDebugAdapter';
import { ChromeDebugSession, IChromeDebugSessionOpts } from './chrome/chromeDebugSession';
import * as chromeTargetDiscoveryStrategy from './chrome/chromeTargetDiscoveryStrategy';
import * as chromeUtils from './chrome/chromeUtils';
import * as stoppedEvent from './chrome/stoppedEvent';
import { InternalSourceBreakpoint } from './chrome/internalSourceBreakpoint';
import { ErrorWithMessage } from './errors';

import { BasePathTransformer } from './transformers/basePathTransformer';
import { UrlPathTransformer } from './transformers/urlPathTransformer';
import { LineColTransformer } from './transformers/lineNumberTransformer';
import { BaseSourceMapTransformer } from './transformers/baseSourceMapTransformer';

export * from './debugAdapterInterfaces';

import * as utils from './utils';
import * as telemetry from './telemetry';
import * as variables from './chrome/variables';
import { NullLogger } from './nullLogger';
import * as executionTimingsReporter from './executionTimingsReporter';

import { Protocol as Crdp } from 'devtools-protocol';
import { Version, TargetVersions } from './chrome/chromeTargetDiscoveryStrategy';
import { IOnPausedResult } from './chrome/internal/breakpoints/breakpointsLogic';
import { parseResourceIdentifier } from './chrome/internal/sources/resourceIdentifier';
import { ChromeDebugAdapter } from './chrome/client/chromeDebugAdapter/chromeDebugAdapterV2';
import { IExtensibilityPoints, OnlyProvideCustomLauncherExtensibilityPoints } from './chrome/extensibility/extensibilityPoints';
import { IDebuggeeLauncher, ILaunchResult, IDebuggeeRunner } from './chrome/debugee/debugeeLauncher';
import { inject, injectable, postConstruct } from 'inversify';
import { ConnectedCDAConfiguration } from './chrome/client/chromeDebugAdapter/cdaConfiguration';
import { IComponent } from './chrome/internal/features/feature';
import { TYPES } from './chrome/dependencyInjection.ts/types';
import { IInspectDebugeeState } from './chrome/target/inspectDebugeeState';
import { CDTPEventsEmitterDiagnosticsModule } from './chrome/target/cdtpDiagnosticsModule';
import { INetworkCacheConfiguration, IDebugeeVersionProvider, IPausedOverlay, IBrowserNavigation } from './chrome/target/cdtpSmallerModules';
import { ICommunicator } from './chrome/communication/communicator';
import { ISupportedDomains } from './chrome/internal/domains/supportedDomains';
import { Internal } from './chrome/communication/internalChannels';
import { ISession } from './chrome/client/session';

export {
    chromeConnection,
    ChromeDebugLogic,
    ChromeDebugSession,
    IOnPausedResult,
    IChromeDebugSessionOpts,
    chromeTargetDiscoveryStrategy,
    chromeUtils,
    logger,
    stoppedEvent,
    LoadedSourceEventReason,
    InternalSourceBreakpoint,
    ErrorWithMessage,

    ChromeDebugAdapter,
    IExtensibilityPoints,
    OnlyProvideCustomLauncherExtensibilityPoints,

    IDebuggeeLauncher,
    IDebuggeeRunner,
    ILaunchResult,
    ConnectedCDAConfiguration,
    inject,
    injectable,
    IComponent,

    postConstruct,

    UrlPathTransformer,
    BasePathTransformer,
    LineColTransformer,
    BaseSourceMapTransformer,

    CDTPEventsEmitterDiagnosticsModule,
    utils,
    telemetry,
    variables,
    NullLogger,
    executionTimingsReporter,

    ISupportedDomains,
    IPausedOverlay,

    Version,
    TargetVersions,

    ICommunicator,

    Internal,

    INetworkCacheConfiguration,
    IDebugeeVersionProvider,

    parseResourceIdentifier,
    IBrowserNavigation,

    ISession,
    TYPES,

    IInspectDebugeeState,

    Crdp
};
