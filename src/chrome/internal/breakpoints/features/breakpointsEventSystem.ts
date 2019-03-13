import { CDTPBPRecipe } from '../../../cdtpDebuggee/cdtpPrimitives';
import { BPRecipeInSource } from '../bpRecipeInSource';
import { Communicator } from '../../../communication/communicator';
import { BreakpointsEvents } from './breakpointsEvents';
import { PublisherWithParamsFunction } from '../../../communication/notificationsCommunicator';

export interface IBreakpointsEventsListener {
    listenForOnClientBPRecipeAdded(listener: (bpRecipie: BPRecipeInSource) => void): void;
    listenForOnClientBPRecipeRemoved(listener: (bpRecipie: BPRecipeInSource) => void): void;
    listenForOnDebuggeeBPRecipeAdded(listener: (bpRecipie: CDTPBPRecipe) => void): void;
    listenForOnDebuggeeBPRecipeRemoved(listener: (bpRecipie: CDTPBPRecipe) => void): void;
    listenForOnBPRecipeIsBoundForRuntimeSource(listener: (bpRecipie: BPRecipeInSource) => void): void;
    listenForOnBPRecipeIsUnboundForRuntimeSource(listener: (bpRecipie: BPRecipeInSource) => void): void;
}

export interface IBreakpointsEventsPublisher {
    publisherForClientBPRecipeAdded(): void;
    publisherForClientBPRecipeRemoved(): PublisherWithParamsFunction<BPRecipeInSource, void>;
    publisherForDebuggeeBPRecipeAdded(): PublisherWithParamsFunction<CDTPBPRecipe, void>;
    publisherForDebuggeeBPRecipeRemoved(): PublisherWithParamsFunction<CDTPBPRecipe, void>;
    publisherForBPRecipeIsBoundForRuntimeSource(): PublisherWithParamsFunction<BPRecipeInSource, void>;
    publisherForBPRecipeIsUnboundForRuntimeSource(): PublisherWithParamsFunction<BPRecipeInSource, void>;
}

export class BreakpointsEventSystem implements IBreakpointsEventsListener, IBreakpointsEventsPublisher {
    private readonly _communicator = new Communicator();

    public listenForOnClientBPRecipeAdded(listener: (bpRecipie: BPRecipeInSource) => void): void {
        this._communicator.subscribe(BreakpointsEvents.OnClientBPRecipeAdded, listener);
    }

    public listenForOnClientBPRecipeRemoved(listener: (bpRecipie: BPRecipeInSource) => void): void {
        this._communicator.subscribe(BreakpointsEvents.OnClientBPRecipeRemoved, listener);
    }

    public listenForOnDebuggeeBPRecipeAdded(listener: (bpRecipie: CDTPBPRecipe) => void): void {
        this._communicator.subscribe(BreakpointsEvents.OnDebuggeeBPRecipeAdded, listener);
    }

    public listenForOnDebuggeeBPRecipeRemoved(listener: (bpRecipie: CDTPBPRecipe) => void): void {
        this._communicator.subscribe(BreakpointsEvents.OnDebuggeeBPRecipeRemoved, listener);
    }

    public listenForOnBPRecipeIsBoundForRuntimeSource(listener: (bpRecipie: BPRecipeInSource) => void): void {
        this._communicator.subscribe(BreakpointsEvents.OnBPRecipeIsBoundForRuntimeSource, listener);
    }

    public listenForOnBPRecipeIsUnboundForRuntimeSource(listener: (bpRecipie: BPRecipeInSource) => void): void {
        this._communicator.subscribe(BreakpointsEvents.OnBPRecipeIsUnboundForRuntimeSource, listener);
    }

    public publisherForClientBPRecipeAdded(): PublisherWithParamsFunction<BPRecipeInSource, void> {
        return this._communicator.getPublisher(BreakpointsEvents.OnClientBPRecipeAdded);
    }

    public publisherForClientBPRecipeRemoved(): PublisherWithParamsFunction<BPRecipeInSource, void> {
        return this._communicator.getPublisher(BreakpointsEvents.OnClientBPRecipeRemoved);
    }

    public publisherForDebuggeeBPRecipeAdded(): PublisherWithParamsFunction<CDTPBPRecipe, void> {
        return this._communicator.getPublisher(BreakpointsEvents.OnDebuggeeBPRecipeAdded);
    }

    public publisherForDebuggeeBPRecipeRemoved(): PublisherWithParamsFunction<CDTPBPRecipe, void> {
        return this._communicator.getPublisher(BreakpointsEvents.OnDebuggeeBPRecipeRemoved);
    }

    public publisherForBPRecipeIsBoundForRuntimeSource(): PublisherWithParamsFunction<BPRecipeInSource, void> {
        return this._communicator.getPublisher(BreakpointsEvents.OnBPRecipeIsBoundForRuntimeSource);
    }

    public publisherForBPRecipeIsUnboundForRuntimeSource(): PublisherWithParamsFunction<BPRecipeInSource, void> {
        return this._communicator.getPublisher(BreakpointsEvents.OnBPRecipeIsUnboundForRuntimeSource);
    }
}
