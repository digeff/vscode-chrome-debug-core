/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { IEquivalenceComparable } from '../../utils/equivalence';

import * as nls from 'vscode-nls';
import { inspect } from 'util';
let localize = nls.loadMessageBundle();

/**
 * These classes represents the different actions that a breakpoint can take when hit
 * Breakpoint: AlwaysPause
 * Conditional Breakpoint: ConditionalPause
 * Logpoint: LogMessage
 * Hit Count Breakpoint: PauseOnHitCount
 */
export interface IBPActionWhenHit extends IEquivalenceComparable {
    isEquivalentTo(bpActionWhenHit: IBPActionWhenHit): boolean;
}

export class AlwaysPause implements IBPActionWhenHit {
    public isEquivalentTo(bpActionWhenHit: IBPActionWhenHit): boolean {
        return bpActionWhenHit instanceof AlwaysPause;
    }

    public [inspect.custom](): string {
        return this.toString();
    }

    public toString(): string {
        return localize('breakpoint.normal.description', 'always pause');
    }
}

export class ConditionalPause implements IBPActionWhenHit {
    constructor(public readonly expressionOfWhenToPause: string) { }

    public isEquivalentTo(bpActionWhenHit: IBPActionWhenHit): boolean {
        return (bpActionWhenHit instanceof ConditionalPause)
            && this.expressionOfWhenToPause === bpActionWhenHit.expressionOfWhenToPause;
    }

    public [inspect.custom](): string {
        return this.toString(inspect);
    }

    public toString(print = (value: unknown) => `${value}`): string {
        return localize('breakpoint.conditional.description', 'pause if: {0}', this.expressionOfWhenToPause);
    }
}

export class PauseOnHitCount implements IBPActionWhenHit {
    constructor(public readonly pauseOnHitCondition: string) { }

    public isEquivalentTo(bpActionWhenHit: IBPActionWhenHit): boolean {
        return (bpActionWhenHit instanceof PauseOnHitCount)
            && this.pauseOnHitCondition === bpActionWhenHit.pauseOnHitCondition;
    }

    public [inspect.custom](): string {
        return this.toString(inspect);
    }

    public toString(print = (value: unknown) => `${value}`): string {
        return localize('breakpoint.hitCount.description', 'pause when hits: {0}', this.pauseOnHitCondition);
    }
}

export class LogMessage implements IBPActionWhenHit {
    constructor(public readonly expressionToLog: string) { }

    public isEquivalentTo(bpActionWhenHit: IBPActionWhenHit): boolean {
        return (bpActionWhenHit instanceof LogMessage)
            && this.expressionToLog === bpActionWhenHit.expressionToLog;
    }

    public [inspect.custom](): string {
        return this.toString(inspect);
    }

    public toString(print = (value: unknown) => `${value}`): string {
        return localize('breakpoint.logpoint.description', 'log: {0}', this.expressionToLog);
    }
}
