/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as _ from 'lodash';
import { logger } from 'vscode-debugadapter';

const originalJSONParse = JSON.parse;
const parsedJSONObjects = new WeakSet();

JSON.parse = (text: string, reviver?: (this: any, key: string, value: any) => any) => {
    const newJsonObject = originalJSONParse(text, reviver);

    try {
        // The result is a JSON Object
        parsedJSONObjects.add(newJsonObject);

        // All sub-objects are also JSON Objects. To avoid marking them all, for the time being we just mark the first level
        _.values(newJsonObject).forEach(value => {
            if (canInsertIntoWeakSet(value)) {
                parsedJSONObjects.add(value);
            }
        });
    } catch (exception) {
        logger.error(`isJSONObject custom JSON.parse version failed with: ${exception}`);
    } finally {
        return newJsonObject;
    }
};

export function isJSONObject(value: object): boolean {
    return parsedJSONObjects.has(value) || isJSONSerializable(value);
}

export function canInsertIntoWeakSet(value: unknown): boolean {
    return typeof value === 'object'; // Figure out if this covers all the cases
}

export function isJSONSerializable(value: unknown, levelsToVerify = 3): boolean {
    switch (typeof value) {
        case 'bigint':
        case 'boolean':
        case 'number':
        case 'string':
        case 'undefined':
            return true;
        case 'object':
            return levelsToVerify >= 1 && _.every((value: unknown) => isJSONSerializable(value, levelsToVerify - 1));
        case 'symbol':
        case 'function':
            return false;
        default:
            throw new Error(`Unexpected object type in isJSONSerializable: ${value} typed: ${typeof value}`);
    }
}
