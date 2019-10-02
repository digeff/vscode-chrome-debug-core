/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
import { breakWhileDebugging } from '../../validation';

export class MethodsDebugger<T extends object> {
    constructor(private readonly _objectToDebug: T,
        private readonly _breakIf: (target: T, propertyKey: unknown, propertyValue: unknown) => boolean) {}

    public wrapped(): T {
        const handler = {
            get: <K extends keyof T>(target: T, propertyKey: K, _receiver: any) => {
                const propertyValue = target[propertyKey];
                if (this._breakIf(target, propertyKey, propertyValue)) {
                    breakWhileDebugging();
                }
                return propertyValue;
            }
        };

        return new Proxy<T>(this._objectToDebug, handler);
    }
}

export function debugUndefinedProperties<T extends object>(objectToDebug: T): T {
    return new MethodsDebugger(objectToDebug, (_target, _propertyKey, propertyValue) => propertyValue === undefined).wrapped();
}