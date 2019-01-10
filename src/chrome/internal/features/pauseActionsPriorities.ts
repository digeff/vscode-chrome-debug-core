import { ShouldStepInToAvoidSkippedSource } from './smartStep';
import { HitAndSatisfiedCountBPCondition } from '../breakpoints/features/hitCountBreakpoints';
import { HitBreakpoint } from '../breakpoints/features/bpRecipeAtLoadedSourceLogic';
import { HitStillPendingBreakpoint, PausedWhileLoadingScriptToResolveBreakpoints } from '../breakpoints/features/pauseScriptLoadsToSetBPs';
import { ExceptionWasThrown, PromiseWasRejected } from '../exceptions/pauseOnException';
import { ValidatedMap } from '../../collections/validatedMap';
import { IActionToTakeWhenPaused, NoActionIsNeededForThisPause } from './actionToTakeWhenPaused';

export type ActionToTakeWhenPausedClass = { new(...args: any[]): IActionToTakeWhenPaused };

const actionsFromHighestToLowestPriority: ActionToTakeWhenPausedClass[] = [
    ShouldStepInToAvoidSkippedSource, // Stepping in to avoid a skipper source takes preference over hitting breakpoints, etc...

    HitAndSatisfiedCountBPCondition,
    HitBreakpoint,
    HitStillPendingBreakpoint,
    ExceptionWasThrown,
    PromiseWasRejected,

    PausedWhileLoadingScriptToResolveBreakpoints
];

const priorityIndexAndActionClassPairs = actionsFromHighestToLowestPriority.map((situationClass, index) => <[ActionToTakeWhenPausedClass, number]>[situationClass, index]);
export const actionClassToPriorityIndexMapping = new ValidatedMap(priorityIndexAndActionClassPairs);
