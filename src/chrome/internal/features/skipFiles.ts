/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as nls from 'vscode-nls';
import { inject, injectable, LazyServiceIdentifer } from 'inversify';
import * as utils from '../../../utils';
import { logger } from 'vscode-debugadapter/lib/logger';
import { IStackTracePresentationDetailsProvider } from '../stackTraces/stackTracePresenter';
import { newResourceIdentifierMap, IResourceIdentifier, parseResourceIdentifier } from '../sources/resourceIdentifier';
import { LocationInLoadedSource, LocationInScript, Position } from '../locations/location';
import { ICallFramePresentationDetails, CallFramePresentation } from '../stackTraces/callFramePresentation';
import { IScriptParsedEvent, IScriptParsedProvider } from '../../cdtpDebuggee/eventsProviders/cdtpOnScriptParsedEventProvider';
import { IBlackboxPatternsConfigurer } from '../../cdtpDebuggee/features/cdtpBlackboxPatternsConfigurer';
import { ConnectedCDAConfiguration } from '../../client/chromeDebugAdapter/cdaConfiguration';
import { ILoadedSource } from '../sources/loadedSource';
import { IScript } from '../scripts/script';
import { TYPES } from '../../dependencyInjection.ts/types';
import { CurrentStackTraceProvider } from '../stackTraces/currentStackTraceProvider';
import { ClientSourceParser } from '../../client/clientSourceParser';
import { HandlesRegistry } from '../../client/handlesRegistry';
import { SourcesRetriever } from '../sources/sourcesRetriever';
import { ISource } from '../sources/source';
import { ICDTPDebuggeeExecutionEventsProvider } from '../../cdtpDebuggee/eventsProviders/cdtpDebuggeeExecutionEventsProvider';
const localize = nls.loadMessageBundle();

export interface ISkipFilesConfiguration {
    skipFiles?: string[]; // an array of file names or glob patterns
    skipFileRegExps?: string[]; // a supplemental array of library code regex patterns
}

@injectable()
export class SkipFilesLogic implements IStackTracePresentationDetailsProvider {
    private readonly _clientSourceParser = new ClientSourceParser(this._handlesRegistry, this._sourcesLogic);
    private _blackboxedRegexes: RegExp[] = [];
    private _skipFileStatuses = newResourceIdentifierMap<boolean>();
    public reprocessPausedEvent: () => void; // TODO DIEGO: Do this in a better way

    private readonly _currentStackStraceProvider = new CurrentStackTraceProvider(this._cdtpDebuggeeExecutionEventsProvider);

    constructor(
        @inject(TYPES.IScriptParsedProvider) public readonly _cdtpOnScriptParsedEventProvider: IScriptParsedProvider,
        @inject(TYPES.ICDTPDebuggeeExecutionEventsProvider) private readonly _cdtpDebuggeeExecutionEventsProvider: ICDTPDebuggeeExecutionEventsProvider,
        @inject(TYPES.ConnectedCDAConfiguration) private readonly _configuration: ConnectedCDAConfiguration,
        @inject(TYPES.IBlackboxPatternsConfigurer) private readonly _blackboxPatternsConfigurer: IBlackboxPatternsConfigurer,
        @inject(HandlesRegistry) private readonly _handlesRegistry: HandlesRegistry,
        private readonly _sourcesLogic: SourcesRetriever,
    ) {
        this._cdtpOnScriptParsedEventProvider.onScriptParsed(scriptParsed => this.onScriptParsed(scriptParsed));
        this.configure();
    }

    /**
     * If the source has a saved skip status, return that, whether true or false.
     * If not, check it against the patterns list.
     */
    public shouldSkipSource(sourcePath: ILoadedSource): boolean | undefined {
        const status = this.getSkipStatus(sourcePath);
        if (typeof status === 'boolean') {
            return status;
        }

        if (this.matchesSkipFilesPatterns(sourcePath.identifier)) {
            return true;
        }

        return undefined;
    }

    public callFrameAdditionalDetails(locationInLoadedSource: LocationInLoadedSource): ICallFramePresentationDetails[] {
        return this.shouldSkipSource(locationInLoadedSource.source)
            ? [{
                additionalSourceOrigins: [localize('skipFilesFeatureName', 'skipFiles')],
                sourcePresentationHint: 'deemphasize'
            }]
            : [];
    }

    /**
     * Returns true if this path matches one of the static skip patterns
     */
    private matchesSkipFilesPatterns(sourcePath: IResourceIdentifier): boolean {
        return this._blackboxedRegexes.some(regex => {
            return regex.test(sourcePath.canonicalized);
        });
    }

    /**
     * Returns the current skip status for this path, which is either an authored or generated script.
     */
    private getSkipStatus(sourcePath: ILoadedSource): boolean | undefined {
        return this._skipFileStatuses.tryGetting(sourcePath.identifier);
    }

    /* __GDPR__
        'ClientRequest/toggleSkipFileStatus' : {
            '${include}': [
                '${IExecutionResultTelemetryProperties}',
                '${DebugCommonProperties}'
            ]
        }
    */
    public async toggleSkipFileStatus(args: ISource): Promise<void> {
        await args.tryResolving(async resolvedSource => {
            if (!await this.isInCurrentStack(args)) {
                // Only valid for files that are in the current stack
                const logName = resolvedSource;
                logger.log(`Can't toggle the skipFile status for ${logName} - it's not in the current stack.`);
                return;
            }

            for (const script of resolvedSource.scriptMapper().scripts) {
                if (resolvedSource === script.developmentSource && script.mappedSources.length < 0) {
                    // Ignore toggling skip status for generated scripts with sources
                    logger.log(`Can't toggle skipFile status for ${resolvedSource} - it's a script with a sourcemap`);
                    return;
                }

                await this.resolveSkipFiles(script, script.developmentSource, script.mappedSources, /*toggling=*/true);
            }

            const newStatus = !this.shouldSkipSource(resolvedSource);
            logger.log(`Setting the skip file status for: ${resolvedSource} to ${newStatus}`);
            this._skipFileStatuses.set(resolvedSource.identifier, newStatus);

            if (newStatus) {
                // TODO: Verify that using targetPath works here. We need targetPath to be this.getScriptByUrl(targetPath).url
                this.makeRegexesSkip(resolvedSource.url);
            } else {
                this.makeRegexesNotSkip(resolvedSource.url);
            }

            this.reprocessPausedEvent();
        }, async sourceIdentifier => {
            logger.log(`Can't toggle the skipFile status for: ${sourceIdentifier} - haven't seen it yet.`);
        });
    }

    private makeRegexesSkip(skipPath: string): void {
        let somethingChanged = false;
        this._blackboxedRegexes = this._blackboxedRegexes.map(regex => {
            const result = utils.makeRegexMatchPath(regex, skipPath);
            somethingChanged = somethingChanged || (result !== regex);
            return result;
        });

        if (!somethingChanged) {
            this._blackboxedRegexes.push(new RegExp(utils.pathToRegex(skipPath), 'i'));
        }

        this.refreshBlackboxPatterns();
    }

    private refreshBlackboxPatterns(): void {
        // Make sure debugging domain is enabled before calling refreshBlackboxPatterns()
        this._blackboxPatternsConfigurer.setBlackboxPatterns({
            patterns: this._blackboxedRegexes.map(regex => regex.source)
        }).catch(() => this.warnNoSkipFiles());
    }

    private async isInCurrentStack(args: ISource): Promise<boolean> {
        return args.tryResolving(
            async resolvedSource => await this._currentStackStraceProvider.isSourceInCurrentStack(resolvedSource),
            async () => false);
    }

    private makeRegexesNotSkip(noSkipPath: string): void {
        let somethingChanged = false;
        this._blackboxedRegexes = this._blackboxedRegexes.map(regex => {
            const result = utils.makeRegexNotMatchPath(regex, noSkipPath);
            somethingChanged = somethingChanged || (result !== regex);
            return result;
        });

        if (somethingChanged) {
            this.refreshBlackboxPatterns();
        }
    }

    public async resolveSkipFiles(script: IScript, mappedUrl: ILoadedSource, sources: ILoadedSource[], toggling?: boolean): Promise<void> {
        const originInScript = new LocationInScript(script, Position.origin);

        if (sources && sources.length) {
            const parentIsSkipped = this.shouldSkipSource(script.runtimeSource);
            const libPositions: LocationInScript[] = [];

            // Figure out skip/noskip transitions within script
            let inLibRange = parentIsSkipped;
            for (let s of sources) {
                let isSkippedFile = this.shouldSkipSource(s);
                if (typeof isSkippedFile !== 'boolean') {
                    // Inherit the parent's status
                    isSkippedFile = parentIsSkipped;
                }

                this._skipFileStatuses.setAndReplaceIfExist(s.identifier, isSkippedFile);

                if ((isSkippedFile && !inLibRange) || (!isSkippedFile && inLibRange)) {
                    const sourcesMapper = script.sourceMapper;
                    const pos = sourcesMapper.getPositionInScript(new LocationInLoadedSource(s, Position.origin));
                    if (!pos) {
                        throw new Error(`Source '${s}' start not found in script.`);
                    }

                    libPositions.push(pos);
                    inLibRange = !inLibRange;
                }
            }

            // If there's any change from the default, set proper blackboxed ranges
            if (libPositions.length || toggling) {
                if (parentIsSkipped) {
                    libPositions.splice(0, 0, originInScript);
                }

                if (!libPositions[0].position.isOrigin) {
                    // The list of blackboxed ranges must start with 0,0 for some reason.
                    // https://github.com/Microsoft/vscode-chrome-debug/issues/667
                    libPositions[0] = originInScript;
                }

                await this._blackboxPatternsConfigurer.setBlackboxedRanges(script, []).catch(() => this.warnNoSkipFiles());

                if (libPositions.length) {
                    this._blackboxPatternsConfigurer.setBlackboxedRanges(script, libPositions).catch(() => this.warnNoSkipFiles());
                }
            }
        } else {
            const status = await this.getSkipStatus(mappedUrl);
            const skippedByPattern = this.matchesSkipFilesPatterns(mappedUrl.identifier);
            if (typeof status === 'boolean' && status !== skippedByPattern) {
                const positions = status ? [originInScript] : [];
                this._blackboxPatternsConfigurer.setBlackboxedRanges(script, positions).catch(() => this.warnNoSkipFiles());
            }
        }
    }

    private warnNoSkipFiles(): void {
        logger.log('Warning: this runtime does not support skipFiles');
    }

    private async onScriptParsed(scriptEvent: IScriptParsedEvent): Promise<void> {
        const script = scriptEvent.script;
        const sources = script.mappedSources;
        await this.resolveSkipFiles(script, script.developmentSource, sources);
    }

    private configure(): SkipFilesLogic {
        const _launchAttachArgs: ISkipFilesConfiguration = this._configuration.args;
        let patterns: string[] = [];

        if (_launchAttachArgs.skipFiles) {
            const skipFilesArgs = _launchAttachArgs.skipFiles.filter(glob => {
                if (glob.startsWith('!')) {
                    logger.warn(`Warning: skipFiles entries starting with '!' aren't supported and will be ignored. ("${glob}")`);
                    return false;
                }

                return true;
            });

            patterns = skipFilesArgs.map(glob => utils.pathGlobToBlackboxedRegex(glob));
        }

        if (_launchAttachArgs.skipFileRegExps) {
            patterns = patterns.concat(_launchAttachArgs.skipFileRegExps);
        }

        if (patterns.length) {
            this._blackboxedRegexes = patterns.map(pattern => new RegExp(pattern, 'i'));
            this.refreshBlackboxPatterns();
        }

        return this;
    }
}