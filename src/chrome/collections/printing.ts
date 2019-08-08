import { isNotEmpty } from '../utils/typedOperators';

export function defaultPrint<T>(element: T): string {
    return `${element}`;
}

/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

/** Methods to print the contents of a collection for logging and debugging purposes (This is not intended for the end-user to see) */
export function printMap<K, V>(typeDescription: string, map: { entries(): IterableIterator<[K, V]> }, print = defaultPrint): string {
    const elementsPrinted = Array.from(map.entries()).map(entry => `${print(entry[0])}: ${print(entry[1])}`).join('; ');
    return `${typeDescription} { ${elementsPrinted} }`;
}

export function printSet<T>(typeDescription: string, set: Set<T>, print = defaultPrint): string {
    const elementsPrinted = printElements(Array.from(set), '; ', print);
    return `${typeDescription} { ${elementsPrinted} }`;
}

export function printArray<T>(typeDescription: string, elements: T[], print = defaultPrint): string {
    const elementsPrinted = printElements(elements, ', ', print);
    return isNotEmpty(typeDescription) ? `${typeDescription} [ ${elementsPrinted} ]` : `[ ${elementsPrinted} ]`;
}

export function printIterable<T>(typeDescription: string, iterable: IterableIterator<T>, print = defaultPrint): string {
    const elementsPrinted = printElements(Array.from(iterable), '; ', print);
    return `${typeDescription} { ${elementsPrinted} }`;
}

function printElements<T>(elements: T[], separator = '; ', print = defaultPrint): string {
    return elements.map(element => print(element)).join(separator);
}