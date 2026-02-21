import { DataSource, SerializableObject, StreamEnvelopeFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import { EventPayload, StreamingEventHeader, StreamingEventEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { DataSourceAggregator } from '@tonylb/mtw-lambda-patterns/ts/dataSource/aggregation'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { snsClient } from '../clients'
import messageBus from '../messageBus'

/**
 * Assets-specific DataSource base class that pre-configures common parameters
 * for the assets lambda context.
 * 
 * This eliminates repetitive constructor arguments by pre-configuring:
 * - DynamoDB utilities for the assets table
 * - SNS utilities for the lambda's region/account
 * - MessageBus instance for internal event coordination
 * - Primary key name used in the assets domain
 * - Feedback topic ARN for replay data delivery
 */
/** SubscribedContent = payload type of events we subscribe to (incoming). UpdatePayload = what we publish. */
export class AssetsDataSource<
    SnapshotPayload extends SerializableObject,
    UpdatePayload extends EventPayload,
    SubscribedContent extends EventPayload = UpdatePayload,
    ExternalUpdatePayload extends EventPayload = EventPayload,
    ExternalSnapshotPayload extends SerializableObject = SnapshotPayload
> extends DataSource<SnapshotPayload, UpdatePayload, SubscribedContent, ExternalUpdatePayload, 'AssetId', ExternalSnapshotPayload> {
    constructor(params: {
        dataSourceKey: string;
        snapshotContentGenerator?: (streamKey: string) => Promise<SnapshotPayload>; // Optional - not needed for non-replayable data sources
        snapshotTimeoutMs?: number;
        replayable?: boolean;
        subscribedEventTypeGuard?: (envelope: StreamingEventEnvelope<unknown>) => envelope is StreamingEventEnvelope<SubscribedContent>;
        receiveEvents?: (params: { 
            events: Array<StreamingEventEnvelope<SubscribedContent>>,
            streamEvent: (params: { update: UpdatePayload; streamKey: string; header: { type: string } }) => Promise<void>,
            streamEnvelope: StreamEnvelopeFunction
        }) => Promise<void>;
        eventSerializer?: any; // Pass through to parent DataSource
        aggregator?: DataSourceAggregator<SnapshotPayload, UpdatePayload>;
    }) {
        super({
            dynamo: assetDB,
            sns: {
                send: async (command: any) => {
                    await snsClient.send(command);
                }
            },
            messageBus: messageBus,
            primaryKeyName: 'AssetId',
            feedbackTopicArn: process.env.FEEDBACK_TOPIC!,
            replayable: params.replayable ?? true, // Default to replayable for backward compatibility
            snapshotContentGenerator: params.snapshotContentGenerator,
            eventSerializer: params.eventSerializer,
            aggregator: params.aggregator,
            ...params
        });
    }
}
