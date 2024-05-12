// Copyright 2024 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { unmarshall } from '@aws-sdk/util-dynamodb'

export const handler = async (event: any) => {

    // console.log(`Event: ${JSON.stringify(event, null, 4)}`)
    const { Records = [] } = event
    const deleteStreamEvents = Records.filter(({ eventSource, eventName, dynamodb = {} as any }) => (eventSource === 'aws:dynamodb' && eventName === 'REMOVE' && unmarshall(dynamodb.Keys ?? {}).ConnectionId.split('#')[0] === 'CONNECTION'))
    if (deleteStreamEvents.length) {
        await Promise.all(deleteStreamEvents.map(async (record) => {
            const { dynamodb } = record
            const connectionId = unmarshall(dynamodb.Keys ?? {}).ConnectionId.split('#').slice(1)[0]
            console.log(`Delete: ${connectionId} from ${unmarshall(dynamodb.OldImage ?? {}).SessionId}`)
        }))
    }

}