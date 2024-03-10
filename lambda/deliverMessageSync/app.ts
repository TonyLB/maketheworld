// Copyright 2023 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { unmarshall } from "@aws-sdk/util-dynamodb"
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns"
import AWSXRay from 'aws-xray-sdk'

const { FEEDBACK_TOPIC } = process.env

const snsClient = AWSXRay.captureAWSv3Client(new SNSClient({ region: process.env.AWS_REGION }))

export const handler = async (event: any) => {

    const { ConnectionId, RequestId, Target: TargetId, Items } = event

    //
    // TODO: Adapt translation function from syncHandler to apply to Items and generate
    // messages
    //
    const messages = Items
        .map(unmarshall)
        .map(({ Target, DeltaId, RowId, ...rest }) => ({ Target: TargetId, MessageId: RowId, ...rest }))

    if (TargetId.split('#').length > 1) {
        if (RequestId) {
            await snsClient.send(new PublishCommand({
                TopicArn: FEEDBACK_TOPIC,
                Message: JSON.stringify({
                    messageType: 'Messages',
                    messages,
                    LastSync: Math.max(...messages.map(({ CreatedTime }) => (CreatedTime))),
                }),
                MessageAttributes: {
                    RequestId: { DataType: 'String', StringValue: RequestId },
                    ConnectionIds: { DataType: 'String.Array', StringValue: JSON.stringify([ConnectionId]) },
                    Type: { DataType: 'String', StringValue: 'Success' }
                }
            }))
        }
        else {
            await snsClient.send(new PublishCommand({
                TopicArn: FEEDBACK_TOPIC,
                Message: JSON.stringify({
                    messageType: 'Messages',
                    messages
                }),
                MessageAttributes: {
                    ConnectionIds: { DataType: 'String.Array', StringValue: JSON.stringify([ConnectionId]) },
                    Type: { DataType: 'String', StringValue: 'Success' }
                }
            }))
        }
    }
    else {
        if (RequestId) {
            await snsClient.send(new PublishCommand({
                TopicArn: FEEDBACK_TOPIC,
                Message: JSON.stringify({
                    messageType: 'Notifications',
                    notifications: messages,
                    LastSync: Math.max(...messages.map(({ CreatedTime }) => (CreatedTime))),
                }),
                MessageAttributes: {
                    RequestId: { DataType: 'String', StringValue: RequestId },
                    ConnectionIds: { DataType: 'String.Array', StringValue: JSON.stringify([ConnectionId]) },
                    Type: { DataType: 'String', StringValue: 'Success' }
                }
            }))
        }
        else {
            await snsClient.send(new PublishCommand({
                TopicArn: FEEDBACK_TOPIC,
                Message: JSON.stringify({
                    messageType: 'Notifications',
                    notifications: messages
                }),
                MessageAttributes: {
                    ConnectionIds: { DataType: 'String.Array', StringValue: JSON.stringify([ConnectionId]) },
                    Type: { DataType: 'String', StringValue: 'Success' }
                }
            }))
        }
    }

    return { statusCode: 200 }

}