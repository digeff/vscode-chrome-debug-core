/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
import * as _ from 'lodash';
import { printTopLevelObjectDescription } from './printObjectDescription';
import { logger } from 'vscode-debugadapter';
import { isDefined } from '../utils/typedOperators';

enum Synchronicity {
    Sync,
    Async
}

enum Outcome {
    Succesful,
    Failure
}

export class ReplacementInstruction {
    public constructor(
        public readonly pattern: RegExp,
        public readonly replacement: string) { }
}

export interface IMethodsCalledLoggerConfiguration {
    readonly replacements: ReplacementInstruction[];

    decideWhetherToWrapMethodResult(methodName: string | symbol | number, args: unknown[], result: unknown, wrapWithName: (name: string) => void): void;
    decideWhetherToWrapEventEmitterListener(receiverName: string, methodName: string | symbol | number, args: unknown[], wrapWithName: (name: string) => void): void;
}

export class MethodsCalledLoggerConfiguration implements IMethodsCalledLoggerConfiguration {

    public constructor(public readonly containerName: string, private _replacements: ReplacementInstruction[]) { }

    public decideWhetherToWrapMethodResult(_methodName: string | symbol | number, _args: unknown[], _result: unknown, _wrapWithName: (name: string) => void): void { }
    public decideWhetherToWrapEventEmitterListener(receiverName: string, methodName: string | symbol | number, args: unknown[], wrapWithName: (name: string) => void): void {
        if (methodName === 'on') {
            wrapWithName(`(${receiverName} emits ${args[0]})`);
        }
    }

    public get replacements(): ReplacementInstruction[] {
        return this._replacements;
    }

    public updateReplacements(replacements: ReplacementInstruction[]): void {
        this._replacements = replacements;
    }
}

export class MethodsCalledLogger<T extends object> {
    private static _nextCallId = 10000;
    constructor(
        private readonly _configuration: IMethodsCalledLoggerConfiguration,
        private readonly _objectToWrap: T,
        private readonly _objectToWrapName: string) {
    }

    public wrapped(): T {
        const handler = {
            get: <K extends keyof T>(target: T, propertyKey: K, _receiver: any) => {
                const originalPropertyValue: any = target[propertyKey];
                if (typeof originalPropertyValue === 'function') {
                    return (...args: any) => {
                        try {
                            if (propertyKey === 'on' && args.length >= 2) {
                                let listenerPossiblyWrapped = args[1];
                                this._configuration.decideWhetherToWrapEventEmitterListener(this._objectToWrapName, propertyKey, args, name => listenerPossiblyWrapped = new MethodsCalledLogger(this._configuration, args[1], name).wrapped());
                                args[1] = listenerPossiblyWrapped;
                            }

                            const result = originalPropertyValue.apply(target, args);
                            if (!result || !result.then) {
                                this.logCall(propertyKey, Synchronicity.Sync, args, Outcome.Succesful, result);
                                let resultPossiblyWrapped = result;
                                this._configuration.decideWhetherToWrapMethodResult(propertyKey, args, result, name => resultPossiblyWrapped = new MethodsCalledLogger(this._configuration, result, name).wrapped());
                                return resultPossiblyWrapped;
                            } else {
                                const callId = this.generateCallId();
                                this.logCallStart(propertyKey, args, callId);
                                return result.then((promiseResult: unknown) => {
                                    this.logCall(propertyKey, Synchronicity.Async, args, Outcome.Succesful, promiseResult, callId);
                                    let resultPossiblyWrapped = promiseResult;
                                    this._configuration.decideWhetherToWrapMethodResult(propertyKey, args, promiseResult, name => resultPossiblyWrapped = new MethodsCalledLogger(this._configuration, <object>promiseResult, name).wrapped());
                                    return resultPossiblyWrapped;
                                }, (error: unknown) => {
                                    this.logCall(propertyKey, Synchronicity.Async, args, Outcome.Failure, error, callId);
                                    return Promise.reject(error);
                                });
                            }
                        } catch (exception) {
                            this.logCall(propertyKey, Synchronicity.Sync, args, Outcome.Failure, exception);
                            throw exception;
                        }
                    };
                } else {
                    return originalPropertyValue;
                }
            }
        };

        return new Proxy<T>(this._objectToWrap, handler);
    }

    private generateCallId(): number {
        return MethodsCalledLogger._nextCallId++;
    }

    private printMethodCall(propertyKey: PropertyKey, methodCallArguments: any[]): string {
        return `${this._objectToWrapName}.${String(propertyKey)}(${this.printArguments(methodCallArguments)})`;
    }

    private printMethodResponse(outcome: Outcome, resultOrException: unknown): string {
        return `${outcome === Outcome.Succesful ? '->' : 'threw'} ${this.printObject(resultOrException)}`;
    }

    private printMethodSynchronicity(synchronicity: Synchronicity): string {
        return `${synchronicity === Synchronicity.Sync ? '' : ' async'}`;
    }

    private logCallStart(propertyKey: PropertyKey, methodCallArguments: any[], callId: number): void {
        const message = `START ${callId}: ${this.printMethodCall(propertyKey, methodCallArguments)}`;
        logger.verbose(message);
    }

    private logCall(propertyKey: PropertyKey, synchronicity: Synchronicity, methodCallArguments: any[], outcome: Outcome, resultOrException: unknown, callId?: number): void {
        const endPrefix = isDefined(callId) ? `END   ${callId}: ` : '';
        const message = `${endPrefix}${this.printMethodCall(propertyKey, methodCallArguments)} ${this.printMethodSynchronicity(synchronicity)}  ${this.printMethodResponse(outcome, resultOrException)}`;
        logger.verbose(message);
    }

    private printArguments(methodCallArguments: any[]): string {
        return methodCallArguments.map(methodCallArgument => this.printObject(methodCallArgument)).join(', ');
    }

    private printObject(objectToPrint: unknown): string {
        const description = printTopLevelObjectDescription(objectToPrint);
        const printedReduced = _.reduce(Array.from(this._configuration.replacements),
            (text, replacement) =>
                text.replace(replacement.pattern, replacement.replacement),
            description);

        return printedReduced;
    }
}

export function wrapWithMethodLogger<T extends object>(objectToWrap: T, objectToWrapName = `${objectToWrap}`): T {
    return new MethodsCalledLogger(new MethodsCalledLoggerConfiguration('no container', []), objectToWrap, objectToWrapName).wrapped();
}
