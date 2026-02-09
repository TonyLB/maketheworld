import { DataSource, SerializableObject, SidecarSnapshotDescriptor } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import { EventPayload, StreamingEventPayload } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { snsClient } from '../clients'
import messageBus from '../messageBus'

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
export class WMLDataSource<SnapshotPayload extends SerializableObject, UpdatePayload extends EventPayload, SubscribedEvent extends StreamingEventPayload = never, ExternalUpdate extends EventPayload = EventPayload> extends DataSource<SnapshotPayload, UpdatePayload, SubscribedEvent, ExternalUpdate, 'AssetId'> {
    constructor(params: {
        dataSourceKey: string;
        snapshotContentGenerator?: (streamKey: string) => Promise<SnapshotPayload>; // Optional - not needed for non-replayable data sources
        snapshotSidecarUrlGenerator?: (streamKey: string) => Promise<SidecarSnapshotDescriptor>;
        snapshotTimeoutMs?: number;
        replayable?: boolean;
        subscribedEventTypeGuard?: (event: StreamingEventPayload) => event is SubscribedEvent;
        receiveEvents?: (params: { 
            events: SubscribedEvent[], 
            streamEvent: (params: { update: UpdatePayload, streamKey: string }) => Promise<void>
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
            messageBus: messageBus,
            primaryKeyName: 'AssetId',
            feedbackTopicArn: process.env.FEEDBACK_TOPIC!,
            replayable: params.replayable ?? true, // Default to replayable for backward compatibility
            snapshotContentGenerator: params.snapshotContentGenerator,
            ...params
        });
    }
}
