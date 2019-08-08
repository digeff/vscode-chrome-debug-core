/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { injectable, inject } from 'inversify';
import { BaseCDAState } from './baseCDAState';
import { ISession } from '../session';
import { TYPES } from '../../dependencyInjection.ts/types';
import { inspect } from 'util';

@injectable()
export class TerminatedCDA extends BaseCDAState {
    constructor(@inject(TYPES.ISession) protected readonly _session: ISession) {
        super([], {});
    }

    public [inspect.custom](): string {
        return this.toString(inspect);
    }

    public toString(print = (value: unknown) => `${value}`): string {
        return `Terminated the debug session`;
    }
}
