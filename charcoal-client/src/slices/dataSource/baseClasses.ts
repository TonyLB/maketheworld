import { ISSMAttemptNode, ISSMChoiceNode, ISSMRedirectNode, ISSMDataLayout, ISSMDataReturn, ISSMAction, ISSMHoldNode } from '../stateSeekingMachine/baseClasses'

//
// Generic base classes for data source state machines
// Each data source will instantiate these with specific snapshot and update payload types
//

export interface DataSourceInternal {
    incrementalBackoff: number;
    subscribeStreamKeys: string[];      // Queue of stream keys to subscribe
    unsubscribeStreamKeys: string[];    // Queue of stream keys to unsubscribe
    error?: string;
    lifeLineSubscription?: string;  // Subscription ID for LifeLinePubSub
}

export interface DataSourcePublic<SnapshotPayload, UpdatePayload> {
    // Active stream keys that are currently subscribed
    // Used to track which streams should be displayed/used by the UI
    activeStreamKeys: string[];
    
    // All stream data, including inactive streams that may still receive events
    // Keeps data structure around even after unsubscribe to handle async events
    subscribedStreams: {
        [streamKey: string]: {
            materializedView: SnapshotPayload;
            recentEvents: Array<{
                event: UpdatePayload | SnapshotPayload;
                timestamp: number;
            }>;
        }
    }
}

export type DataSourceData<SnapshotPayload, UpdatePayload> = {
    internalData: DataSourceInternal;
    publicData: DataSourcePublic<SnapshotPayload, UpdatePayload>;
}

export type DataSourceRecord<SnapshotPayload, UpdatePayload> = ISSMDataLayout<DataSourceInternal, DataSourcePublic<SnapshotPayload, UpdatePayload>>
export type DataSourceReturn<SnapshotPayload, UpdatePayload> = ISSMDataReturn<DataSourceInternal, DataSourcePublic<SnapshotPayload, UpdatePayload>>
export type DataSourceAction<SnapshotPayload, UpdatePayload> = ISSMAction<DataSourceInternal, DataSourcePublic<SnapshotPayload, UpdatePayload>>

//
// Snapshot event shape from backend: may have inline payload or sidecarUrl.
// When sidecarUrl is present, the client fetches from that URL and resolves before applying.
//
export type SnapshotUpdateWithSidecar = {
    type: 'Snapshot';
    payload?: unknown;
    sidecarUrl?: string;
    createdAt?: number;
    expiresAt?: number;
}

//
// Client-side header/content envelope for streaming messages
// Mirrors the server-side header/content concept but is derived from the external
// wire payload and LifeLine metadata. Used for routing/branching only; we continue
// to keep internal snapshot/update events in subscribedStreams.recentEvents.
//
export type ClientStreamingHeader = {
    //
    // Discriminant for TypeScript unions and client-side branching
    //
    type: string;
    //
    // Optional small domain flags that are part of the event semantics
    // (for example, zone identifiers on certain DataSources)
    //
    zone?: string;
}

export type ClientStreamingEnvelope<Content> = {
    header: ClientStreamingHeader;
    content: Content;
}

//
// Common payload shapes for messages dispatched into dataSource reducers.
// These are the client view of the external snapshot/update payloads.
//
export type ClientSnapshotMessagePayload<ExternalSnapshotPayload> = {
    streamKey: string;
    timestamp: number;
} & ClientStreamingEnvelope<ExternalSnapshotPayload>

export type ClientUpdateMessagePayload<ExternalUpdatePayload> = {
    streamKey: string;
    timestamp: number;
} & ClientStreamingEnvelope<ExternalUpdatePayload>

export interface DataSourceNodes<SnapshotPayload, UpdatePayload> {
    INITIAL: ISSMHoldNode<DataSourceInternal, DataSourcePublic<SnapshotPayload, UpdatePayload>>;
    INITIALIZE: ISSMAttemptNode<DataSourceInternal, DataSourcePublic<SnapshotPayload, UpdatePayload>>;
    INITIALIZEERROR: ISSMChoiceNode;
    READY: ISSMChoiceNode;
    SUBSCRIBE: ISSMAttemptNode<DataSourceInternal, DataSourcePublic<SnapshotPayload, UpdatePayload>>;
    SUBSCRIBEBACKOFF: ISSMAttemptNode<DataSourceInternal, DataSourcePublic<SnapshotPayload, UpdatePayload>>;
    SUBSCRIBEERROR: ISSMChoiceNode;
    SUBSCRIBED: ISSMRedirectNode;     // REDIRECT back to READY after subscription
    UNSUBSCRIBE: ISSMAttemptNode<DataSourceInternal, DataSourcePublic<SnapshotPayload, UpdatePayload>>;
    UNSUBSCRIBEBACKOFF: ISSMAttemptNode<DataSourceInternal, DataSourcePublic<SnapshotPayload, UpdatePayload>>;
    UNSUBSCRIBED: ISSMRedirectNode;   // REDIRECT back to READY after unsubscription
}

