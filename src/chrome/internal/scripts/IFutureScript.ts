import { IdentifiedLoadedSource } from '../sources/identifiedLoadedSource';
import { Position } from '../locations/location';

export interface IFutureScript {
    readonly mappedSources: IdentifiedLoadedSource[]; // Sources before compilation
    readonly startPositionInSource: Position;
}
