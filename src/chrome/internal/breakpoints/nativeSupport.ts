import { IScript } from '../scripts/script';
import { URLRegexp } from '../locations/subtypes';
import { CDTPScriptUrl } from '../sources/resourceIdentifierSubtypes';
import { IResourceIdentifier } from '../sources/resourceIdentifier';
import { AlwaysPause, ConditionalPause } from './bpActionWhenHit';

export type NativelySupportedResources = IScript | IResourceIdentifier<CDTPScriptUrl> | URLRegexp;
export type NativelySupportedHitActions = AlwaysPause | ConditionalPause;