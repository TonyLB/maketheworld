import { DataSource, SerializableObject } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import { EventPayload, StreamingEventPayload } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import messageBus from '../messageBus'
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns'

// Local SNS client wrapper matching the interface expected by DataSource
const snsClient = new SNSClient({ region: process.env.AWS_REGION })

export class EphemeraDataSource<
    SnapshotPayload extends SerializableObject,
    UpdatePayload extends EventPayload,
    SubscribedEvent extends StreamingEventPayload = never
> extends DataSource<SnapshotPayload, UpdatePayload, SubscribedEvent, EventPayload, 'EphemeraId'> {
    constructor(params: {
        dataSourceKey: string;
        snapshotContentGenerator?: (streamKey: string) => Promise<SnapshotPayload>;
        snapshotTimeoutMs?: number;
        replayable?: boolean;
        subscribedEventTypeGuard?: (event: StreamingEventPayload) => event is SubscribedEvent;
        receiveEvents?: (params: {
            events: SubscribedEvent[];
            streamEvent: (params: { update: UpdatePayload; streamKey: string }) => Promise<void>;
        }) => Promise<void>;
        eventSerializer?: any;
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


