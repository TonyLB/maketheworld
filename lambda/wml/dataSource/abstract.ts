import { DataSource, SerializableObject, SidecarSnapshotDescriptor } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import { EventPayload, StreamingEventHeader, StreamingEventEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
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
/** SubscribedContent = payload type of events we subscribe to (incoming). UpdatePayload = what we publish. */
export class WMLDataSource<SnapshotPayload extends SerializableObject, UpdatePayload extends EventPayload, SubscribedContent extends EventPayload = UpdatePayload, ExternalUpdate extends EventPayload = EventPayload> extends DataSource<SnapshotPayload, UpdatePayload, SubscribedContent, ExternalUpdate, 'AssetId'> {
    constructor(params: {
        dataSourceKey: string;
        snapshotContentGenerator?: (streamKey: string) => Promise<SnapshotPayload>; // Optional - not needed for non-replayable data sources
        snapshotSidecarUrlGenerator?: (streamKey: string) => Promise<SidecarSnapshotDescriptor>;
        snapshotTimeoutMs?: number;
        replayable?: boolean;
        subscribedEventTypeGuard?: (header: StreamingEventHeader) => boolean;
        receiveEvents?: (params: { 
            events: Array<StreamingEventEnvelope<SubscribedContent>>,
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
