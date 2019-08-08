/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { LocationInScript } from '../locations/location';
import { CDTPNonPrimitiveRemoteObject } from '../../cdtpDebuggee/cdtpPrimitives';
import { inspect } from 'util';

/** This class represents a variable's scope (Globals, locals, block variables, etc...) */
export class Scope {
    constructor(
        public readonly type: ('global' | 'local' | 'with' | 'closure' | 'catch' | 'block' | 'script' | 'eval' | 'module'),
        public readonly object: CDTPNonPrimitiveRemoteObject,
        public readonly name?: string,
        public readonly startLocation?: LocationInScript,
        public readonly endLocation?: LocationInScript) { }

    public [inspect.custom](): string {
        return this.toString(inspect);
    }

    public toString(print = (value: unknown) => `${value}`): string {
        return `${this.type}`;
    }
}
