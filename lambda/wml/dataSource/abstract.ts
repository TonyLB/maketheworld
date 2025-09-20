import { DataSource, SerializableObject } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import { StreamingEventPayload } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { snsClient } from '../clients'

/**
 * WML-specific DataSource base class that pre-configures common parameters
 * for the wml lambda context.
 * 
 * This eliminates repetitive constructor arguments by pre-configuring:
 * - DynamoDB utilities for the assets table
 * - SNS utilities for the lambda's region/account
 * - MessageBus instance for internal event coordination
 * - Primary key name used in the WML domain
 * - Feedback topic ARN for replay data delivery
 */
export class WMLDataSource<SnapshotPayload extends SerializableObject, UpdatePayload = any, SubscribedEvent extends StreamingEventPayload = never> extends DataSource<SnapshotPayload, UpdatePayload, SubscribedEvent, string | SerializableObject, 'AssetId'> {
    constructor(params: {
        dataSourceKey: string;
        snapshotContentGenerator?: (streamKey: string) => Promise<SnapshotPayload>; // Optional - not needed for non-replayable data sources
        snapshotTimeoutMs?: number;
        replayable?: boolean;
        subscribedEventTypeGuard?: (event: StreamingEventPayload) => event is SubscribedEvent;
        receiveEvents?: (params: { 
            event: SubscribedEvent, 
            streamEvent: (params: { update: UpdatePayload, streamKey: string, detailType: string }) => Promise<void>
        }) => Promise<void>;
        eventSerializer?: any; // Will be properly typed when we implement the serializer
    }) {
        super({
            dynamo: assetDB,
            sns: {
                send: async (command: any) => {
                    await snsClient.send(command);
                }
            },
            messageBus: {
                send: () => {}, // TODO: Import actual messageBus when available
                subscribe: () => {}
            },
            primaryKeyName: 'AssetId',
            feedbackTopicArn: process.env.FEEDBACK_TOPIC!,
            replayable: params.replayable ?? true, // Default to replayable for backward compatibility
            snapshotContentGenerator: params.snapshotContentGenerator,
            ...params
        });
    }
}
