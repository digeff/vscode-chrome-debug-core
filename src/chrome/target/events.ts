import { Protocol as CDTP } from 'devtools-protocol';
import { IScript } from '../internal/scripts/script';

export type integer = number;

/**
 * A new JavaScript Script has been parsed by the debuggee and it's about to be executed
 */
export interface ScriptParsedEvent {
    readonly script: IScript;
    readonly url: string;
    readonly startLine: integer;
    readonly startColumn: integer;
    readonly endLine: integer;
    readonly endColumn: integer;
    readonly executionContextId: CDTP.Runtime.ExecutionContextId;
    readonly hash: string;
    readonly executionContextAuxData?: any;
    readonly isLiveEdit?: boolean;
    readonly sourceMapURL?: string;
    readonly hasSourceURL?: boolean;
    readonly isModule?: boolean;
    readonly length?: integer;
}
