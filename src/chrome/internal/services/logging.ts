/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { Logger, logger } from 'vscode-debugadapter';
import { IExtensibilityPoints } from '../../extensibility/extensibilityPoints';

export interface LoggingConfiguration {
    logLevel?: Logger.LogLevel;
    shouldLogTimestamps: boolean;
    logFilePath: string;
}

export class Logging {
    public verbose(entry: string): void {
        logger.verbose(entry);
    }

    public install(extensibilityPoints: IExtensibilityPoints, configuration: LoggingConfiguration): this {
        this.configure(extensibilityPoints, configuration);
        return this;
    }

    public configure(extensibilityPoints: IExtensibilityPoints, configuration: LoggingConfiguration): void {
        const logToFile = !!configuration.logLevel;

        // The debug configuration provider should have set logFilePath on the launch config. If not, default to 'true' to use the
        // "legacy" log file path from the CDA subclass
        const logFilePath = configuration.logFilePath || extensibilityPoints.logFilePath || logToFile;
        logger.setup(configuration.logLevel || Logger.LogLevel.Warn, logFilePath, configuration.shouldLogTimestamps);
    }
}