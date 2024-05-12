// Copyright 2024 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn"

export const sfnClient = new SFNClient({ region: process.env.AWS_REGION })

export const handler = async (event: any) => {

    // console.log(`Event: ${JSON.stringify(event, null, 4)}`)
    const { Records = [] } = event
    const deleteStreamEvents = Records.filter(({ eventSource, eventName, dynamodb = {} as any }) => (eventSource === 'aws:dynamodb' && eventName === 'REMOVE' && unmarshall(dynamodb.Keys ?? {}).ConnectionId.split('#')[0] === 'CONNECTION' && unmarshall(dynamodb.Keys ?? {}).DataCategory === 'Meta::Connection'))
    if (deleteStreamEvents.length) {
        await Promise.all(deleteStreamEvents.map(async (record) => {
            const { dynamodb } = record
            const connectionId = unmarshall(dynamodb.Keys ?? {}).ConnectionId.split('#').slice(1)[0]
            const sessionId = unmarshall(dynamodb.OldImage ?? {}).SessionId
            if (sessionId && connectionId) {
                console.log(`Delete: ${connectionId} from ${sessionId}`)
                await sfnClient.send(new StartExecutionCommand({
                    stateMachineArn: process.env.DROP_CONNECTION_SFN,
                    input: JSON.stringify({ sessionId, connectionId })
                }))
            }
        }))
    }

}