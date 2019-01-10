/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { ChromeDebugSession, logger, UrlPathTransformer, BaseSourceMapTransformer, telemetry, BasePathTransformer } from '../../src/index';
import * as path from 'path';
import * as os from 'os';

import { TestDebugAdapter } from './testDebugAdapter';
import { OnlyProvideCustomLauncherExtensibilityPoints } from '../../src/chrome/extensibility/extensibilityPoints';
import { TestDebugeeLauncher } from './testDebugeeLauncher';
import { TestDebugeeRunner } from './testDebugeeRunner';
import { IConnectedCDAConfiguration } from '../../src/chrome/client/chromeDebugAdapter/cdaConfiguration';

const EXTENSION_NAME = 'debugger-for-chrome';

// Start a ChromeDebugSession configured to only match 'page' targets, which are Chrome tabs.
// Cast because DebugSession is declared twice - in this repo's vscode-debugadapter, and that of -core... TODO
const logFilePath = path.resolve(os.tmpdir(), 'vscode-chrome-debug.txt');
const extensibilityPoints = new OnlyProvideCustomLauncherExtensibilityPoints(logFilePath, TestDebugeeLauncher, TestDebugeeRunner, (identifier, component) => component);
extensibilityPoints.pathTransformer = UrlPathTransformer;
extensibilityPoints.sourceMapTransformer = BaseSourceMapTransformer,
    ChromeDebugSession.run(ChromeDebugSession.getSession(
        {
            adapter: TestDebugAdapter,
            extensionName: EXTENSION_NAME,
            extensibilityPoints: extensibilityPoints,
            logFilePath: logFilePath
        }));

/* tslint:disable:no-var-requires */
const debugAdapterVersion = require('../../../package.json').version;
logger.log(EXTENSION_NAME + ': ' + debugAdapterVersion);

/* __GDPR__FRAGMENT__
    "DebugCommonProperties" : {
        "Versions.DebugAdapter" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
    }
*/
telemetry.telemetry.addCustomGlobalProperty({ 'Versions.DebugAdapter': debugAdapterVersion });
