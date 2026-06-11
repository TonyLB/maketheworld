import { DataSource, SerializableObject, StreamEventFunction, StreamEnvelopeFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import { EventPayload, StreamingEventHeader, StreamingEventEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { WMLStreamingEventHeader } from '@tonylb/mtw-interfaces/ts/eventBridge/wml'
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
/** SubscribedContent = payload type of events we subscribe to (incoming). UpdatePayload = what we publish. Header = extended header (e.g. WMLStreamingEventHeader for RequestIds). */
export class WMLDataSource<SnapshotPayload extends SerializableObject, UpdatePayload extends EventPayload, SubscribedContent extends EventPayload = UpdatePayload, ExternalUpdate extends EventPayload = EventPayload, Header extends StreamingEventHeader = WMLStreamingEventHeader> extends DataSource<SnapshotPayload, UpdatePayload, SubscribedContent, ExternalUpdate, 'AssetId', SnapshotPayload, Header> {
    constructor(params: {
        dataSourceKey: string;
        snapshotContentGenerator?: (streamKey: string) => Promise<SnapshotPayload>; // Optional - not needed for non-replayable data sources
        snapshotTimeoutMs?: number;
        replayable?: boolean;
        subscribedEventTypeGuard?: (envelope: StreamingEventEnvelope<unknown>) => envelope is StreamingEventEnvelope<SubscribedContent>;
        receiveEvents?: (params: { 
            events: Array<StreamingEventEnvelope<SubscribedContent>>,
            streamEvent: StreamEventFunction<UpdatePayload, Header>,
            streamEnvelope: StreamEnvelopeFunction
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
