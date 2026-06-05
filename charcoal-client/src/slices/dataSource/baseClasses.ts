import { ISSMAttemptNode, ISSMChoiceNode, ISSMRedirectNode, ISSMDataLayout, ISSMDataReturn, ISSMAction, ISSMHoldNode } from '../stateSeekingMachine/baseClasses'
import type { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

//
// Generic base classes for data source state machines
// Each data source will instantiate these with specific snapshot and update payload types
//

export interface DataSourceInternal {
    incrementalBackoff: number;
    subscribeStreamKeys: string[];      // Queue of stream keys to subscribe
    unsubscribeStreamKeys: string[];    // Queue of stream keys to unsubscribe
    error?: string;
    streamEventSubscription?: string;  // Subscription ID for StreamEventPubSub
}

/**
 * Stored envelope for one entry in recentEvents. Generic in Payload and Header so slices
 * can use extended header types (e.g. WMLStreamingEventHeader) for type-safe narrowing.
 */
export type RecentEventEnvelope<Payload, Header extends StreamingEventHeader = StreamingEventHeader> = {
    header: Header;
    content: Payload;
    timestamp: number;
}

export type RequestIdTrackingHeaderField = 'RequestIds' | 'RequestId' | 'both'

export type RequestIdTrackingConfig = {
    /** Which extended header field(s) to read. Default: 'both'. */
    headerField?: RequestIdTrackingHeaderField
    /** Selector TTL for confirmed ids (default 5 minutes); applied at read time, not in reducer */
    confirmedTtlMs?: number
}

export type ConfirmedRequestId = { id: string; seenAt: number }

export interface DataSourcePublic<
    SnapshotPayload,
    UpdatePayload,
    Header extends StreamingEventHeader = StreamingEventHeader
> {
    // Active stream keys that are currently subscribed
    // Used to track which streams should be displayed/used by the UI
    activeStreamKeys: string[];

    // All stream data, including inactive streams that may still receive events
    // Keeps data structure around even after unsubscribe to handle async events
    subscribedStreams: {
        [streamKey: string]: {
            materializedView: SnapshotPayload;
            recentEvents: Array<RecentEventEnvelope<UpdatePayload | SnapshotPayload, Header>>;
            /** Present only when requestIdTracking is enabled on the slice factory */
            confirmedRequestIds?: ConfirmedRequestId[];
        }
    }
}

export type DataSourceData<SnapshotPayload, UpdatePayload, Header extends StreamingEventHeader = StreamingEventHeader> = {
    internalData: DataSourceInternal;
    publicData: DataSourcePublic<SnapshotPayload, UpdatePayload, Header>;
}

export type DataSourceRecord<SnapshotPayload, UpdatePayload, Header extends StreamingEventHeader = StreamingEventHeader> = ISSMDataLayout<DataSourceInternal, DataSourcePublic<SnapshotPayload, UpdatePayload, Header>>
export type DataSourceReturn<SnapshotPayload, UpdatePayload, Header extends StreamingEventHeader = StreamingEventHeader> = ISSMDataReturn<DataSourceInternal, DataSourcePublic<SnapshotPayload, UpdatePayload, Header>>
export type DataSourceAction<SnapshotPayload, UpdatePayload, Header extends StreamingEventHeader = StreamingEventHeader> = ISSMAction<DataSourceInternal, DataSourcePublic<SnapshotPayload, UpdatePayload, Header>>

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

export interface DataSourceNodes<SnapshotPayload, UpdatePayload, Header extends StreamingEventHeader = StreamingEventHeader> {
    INITIAL: ISSMHoldNode<DataSourceInternal, DataSourcePublic<SnapshotPayload, UpdatePayload, Header>>;
    INITIALIZE: ISSMAttemptNode<DataSourceInternal, DataSourcePublic<SnapshotPayload, UpdatePayload, Header>>;
    INITIALIZEERROR: ISSMChoiceNode;
    READY: ISSMChoiceNode;
    SUBSCRIBE: ISSMAttemptNode<DataSourceInternal, DataSourcePublic<SnapshotPayload, UpdatePayload, Header>>;
    SUBSCRIBEBACKOFF: ISSMAttemptNode<DataSourceInternal, DataSourcePublic<SnapshotPayload, UpdatePayload, Header>>;
    SUBSCRIBEERROR: ISSMChoiceNode;
    SUBSCRIBED: ISSMRedirectNode;     // REDIRECT back to READY after subscription
    UNSUBSCRIBE: ISSMAttemptNode<DataSourceInternal, DataSourcePublic<SnapshotPayload, UpdatePayload, Header>>;
    UNSUBSCRIBEBACKOFF: ISSMAttemptNode<DataSourceInternal, DataSourcePublic<SnapshotPayload, UpdatePayload, Header>>;
    UNSUBSCRIBED: ISSMRedirectNode;   // REDIRECT back to READY after unsubscription
}

