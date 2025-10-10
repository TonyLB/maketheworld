import { ISSMAttemptNode, ISSMChoiceNode, ISSMDataLayout, ISSMDataReturn, ISSMAction } from '../stateSeekingMachine/baseClasses'

//
// Generic base classes for data source state machines
// Each data source will instantiate these with specific snapshot and update payload types
//

export interface DataSourceInternal {
    incrementalBackoff: number;
    pendingStreamKeys?: string[];
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

export interface DataSourceNodes<SnapshotPayload, UpdatePayload> {
    INITIALIZE: ISSMAttemptNode<DataSourceInternal, DataSourcePublic<SnapshotPayload, UpdatePayload>>;
    INITIALIZEERROR: ISSMChoiceNode;
    READY: ISSMChoiceNode;
    SUBSCRIBE: ISSMAttemptNode<DataSourceInternal, DataSourcePublic<SnapshotPayload, UpdatePayload>>;
    SUBSCRIBEBACKOFF: ISSMAttemptNode<DataSourceInternal, DataSourcePublic<SnapshotPayload, UpdatePayload>>;
    SUBSCRIBEERROR: ISSMChoiceNode;
    SUBSCRIBED: ISSMChoiceNode;
    UNSUBSCRIBE: ISSMAttemptNode<DataSourceInternal, DataSourcePublic<SnapshotPayload, UpdatePayload>>;
    UNSUBSCRIBEBACKOFF: ISSMAttemptNode<DataSourceInternal, DataSourcePublic<SnapshotPayload, UpdatePayload>>;
}

