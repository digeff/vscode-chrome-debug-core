/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { FrameId } from '../../cdtpDebuggee/cdtpPrimitives';
import { InternalError } from '../../utils/internalError';

/**
 * This interface represents the execution context in CDTP where a script is executed. A new context is created when a page is refreshed, etc...
 * We keep track of this because only scripts of non destroyed execution contexts should be displayed to the user
 */
export interface IExecutionContext {
    readonly frameId: FrameId | undefined;
    isDestroyed(): boolean;
}

export class ExecutionContext implements IExecutionContext {
    private _isDestroyed = false;

    public constructor(public readonly frameId: FrameId | undefined) {}

    public isDestroyed(): boolean {
        return this._isDestroyed;
    }

    public markAsDestroyed(): void {
        if (this._isDestroyed === false) {
            this._isDestroyed = true;
        } else {
            throw new InternalError('error.executionContext.alreadyMarkedAsDestroyed', `The execution context ${this} was already marked as destroyed`);
        }
    }
}