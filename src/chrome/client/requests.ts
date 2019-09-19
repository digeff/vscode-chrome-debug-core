/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

export const AvailableCommands = new Set(['runInTerminal', 'initialize', 'configurationDone', 'launch', 'attach', 'restart', 'disconnect', 'terminate', 'setBreakpoints', 'setFunctionBreakpoints', 'setExceptionBreakpoints', 'continue', 'next', 'stepIn', 'stepOut', 'stepBack', 'reverseContinue', 'restartFrame', 'goto', 'pause', 'stackTrace', 'scopes', 'variables', 'setVariable', 'source', 'threads', 'terminateThreads', 'modules', 'loadedSources', 'evaluate', 'setExpression', 'stepInTargets', 'gotoTargets', 'completions', 'exceptionInfo', 'toggleSkipFileStatus']);
export type CommandText = 'runInTerminal' | 'initialize' | 'configurationDone' | 'launch' | 'attach' | 'restart' | 'disconnect' | 'terminate' | 'setBreakpoints' | 'setFunctionBreakpoints' | 'setExceptionBreakpoints' | 'continue' | 'next' | 'stepIn' | 'stepOut' | 'stepBack' | 'reverseContinue' | 'restartFrame' | 'goto' | 'pause' | 'stackTrace' | 'scopes' | 'variables' | 'setVariable' | 'source' | 'threads' | 'terminateThreads' | 'modules' | 'loadedSources' | 'evaluate' | 'setExpression' | 'stepInTargets' | 'gotoTargets' | 'completions' | 'exceptionInfo' | 'attachToExistingConnection';
