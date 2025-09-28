import { DataSource, SerializableObject } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import { StreamingEventPayload } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
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
export class AssetsDataSource<SnapshotPayload extends SerializableObject, UpdatePayload = any, SubscribedEvent extends StreamingEventPayload = never> extends DataSource<SnapshotPayload, UpdatePayload, SubscribedEvent, string | SerializableObject, 'AssetId'> {
    constructor(params: {
        dataSourceKey: string;
        snapshotContentGenerator?: (streamKey: string) => Promise<SnapshotPayload>; // Optional - not needed for non-replayable data sources
        snapshotTimeoutMs?: number;
        replayable?: boolean;
        subscribedEventTypeGuard?: (event: StreamingEventPayload) => event is SubscribedEvent;
        receiveEvents?: (params: { 
            events: SubscribedEvent[], 
            streamEvent: (params: { update: UpdatePayload, streamKey: string }) => Promise<void>
        }) => Promise<void>;
        eventSerializer?: any; // Pass through to parent DataSource
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
            ...params
        });
    }
}
