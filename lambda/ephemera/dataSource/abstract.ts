import {
    DataSource,
    DataSourcePublisherStrategy,
    SerializableObject,
    StreamEventFunction,
    StreamEnvelopeFunction,
} from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import { EventPayload, StreamingEventEnvelope, StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import messageBus from '../messageBus'
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns'

// Local SNS client wrapper matching the interface expected by DataSource
const snsClient = new SNSClient({ region: process.env.AWS_REGION })

/** SubscribedContent = payload type of events we subscribe to (incoming). UpdatePayload = what we publish. */
export class EphemeraDataSource<
    SnapshotPayload extends SerializableObject,
    UpdatePayload extends EventPayload,
    SubscribedContent extends EventPayload = UpdatePayload
> extends DataSource<SnapshotPayload, UpdatePayload, SubscribedContent, EventPayload, 'EphemeraId'> {
    constructor(params: {
        dataSourceKey: string;
        snapshotContentGenerator?: (streamKey: string) => Promise<SnapshotPayload>;
        snapshotTimeoutMs?: number;
        replayable?: boolean;
        subscribedEventTypeGuard?: (envelope: StreamingEventEnvelope<unknown>) => envelope is StreamingEventEnvelope<SubscribedContent>;
        receiveEvents?: (params: {
            events: Array<StreamingEventEnvelope<SubscribedContent>>;
            streamEvent: StreamEventFunction<UpdatePayload, StreamingEventHeader>;
            streamEnvelope: StreamEnvelopeFunction;
        }) => Promise<void>;
        eventSerializer?: any;
        publisherStrategy?: DataSourcePublisherStrategy;
        subscriptionPriority?: number;
    }) {
        super({
            dynamo: ephemeraDB,
            sns: {
                send: async (command: PublishCommand) => {
                    await snsClient.send(command)
                },
            },
            messageBus: messageBus,
            primaryKeyName: 'EphemeraId',
            feedbackTopicArn: process.env.FEEDBACK_TOPIC!,
            replayable: params.replayable ?? true,
            snapshotContentGenerator: params.snapshotContentGenerator,
            eventSerializer: params.eventSerializer,
            ...params,
        })
    }
}

export default EphemeraDataSource


