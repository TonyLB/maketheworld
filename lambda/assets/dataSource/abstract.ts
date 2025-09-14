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
export class AssetsDataSource<SnapshotPayload extends SerializableObject, UpdatePayload extends string | SerializableObject, SubscribedEvent extends StreamingEventPayload = never> extends DataSource<SnapshotPayload, UpdatePayload, SubscribedEvent> {
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
    }) {
        super({
            dynamo: {
                putItem: async (item: Record<string, any>) => {
                    await assetDB.putItem(item as any);
                },
                getItem: async (args: any) => {
                    return await assetDB.getItem(args) as any;
                },
                query: async (args: any) => {
                    return await assetDB.query(args) as any;
                },
                optimisticUpdate: async (params: any) => {
                    return await assetDB.optimisticUpdate(params);
                }
            },
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
