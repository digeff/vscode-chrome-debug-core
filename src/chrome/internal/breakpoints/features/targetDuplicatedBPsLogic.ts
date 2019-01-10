/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

// import { BPRecipeInScript, BPRecipeInUrl, BPRecipeInUrlRegexp, IBPRecipe, BPRecipe } from './bpRecipe';
// import { AlwaysBreak, ConditionalBreak } from './bpBehavior';
// import { BreakpointInScript, BreakpointInUrl, BreakpointInUrlRegexp, IBreakpoint } from './breakpoint';
// import { SetUsingProjection } from '../../collections/setUsingProjection';
// import { Script } from '../scripts/script';
// import { ScriptOrSourceOrIdentifierOrUrlRegexp } from '../locations/locationInResource';

// export interface ITargetDuplicatedBPsLogicDependencies {
//     setBreakpoint(bpRecipe: BPRecipeInScript<AlwaysBreak | ConditionalBreak>): Promise<BreakpointInScript>;
//     setBreakpointByUrl(bpRecipe: BPRecipeInUrl<AlwaysBreak | ConditionalBreak>): Promise<BreakpointInUrl[]>;
//     setBreakpointByUrlRegexp(bpRecipe: BPRecipeInUrlRegexp<AlwaysBreak | ConditionalBreak>): Promise<BreakpointInUrlRegexp[]>;
// }

// class DuplicatedBPsLogic<TResource extends ScriptOrSourceOrIdentifierOrUrlRegexp, TBreakpoint extends IBPRecipe<TResource, AlwaysBreak | ConditionalBreak>> {
//     private readonly _canonicalizedBPRecipes = new SetUsingProjection<BPRecipe<TResource>>();

//     public setBreakpoint(bpRecipe: TBreakpoint): Promise<IBreakpoint<Script>> {
//         const existingRecipe = this._canonicalizedBPRecipes.tryGetting(bpRecipe);
//         return new BreakpointInScript();
//     }
// }

// export class TargetDuplicatedBPsLogic {
//     public async setBreakpoint(bpRecipe: BPRecipeInScript<AlwaysBreak | ConditionalBreak>): Promise<BreakpointInScript> {
//         return this._dependencies.setBreakpoint(bpRecipe);
//     }

//     public async setBreakpointByUrl(bpRecipe: BPRecipeInUrl<AlwaysBreak | ConditionalBreak>): Promise<BreakpointInUrl[]> {
//         return this._dependencies.setBreakpointByUrl(bpRecipe);
//     }

//     public async setBreakpointByUrlRegexp(bpRecipe: BPRecipeInUrlRegexp<AlwaysBreak | ConditionalBreak>): Promise<BreakpointInUrlRegexp[]> {
//         return this._dependencies.setBreakpointByUrlRegexp(bpRecipe);
//     }

//     constructor(private readonly _dependencies: ITargetDuplicatedBPsLogicDependencies) { }
// }