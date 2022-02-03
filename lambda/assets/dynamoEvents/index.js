import { unmarshall } from '@aws-sdk/util-dynamodb'

import { handleCharacterEvent } from './character.js'

export const handleDynamoEvent = async ({ dbClient, event }) => {
    const { eventName, dynamodb } = event
    const oldImage = unmarshall(dynamodb.OldImage || {})
    const newImage = unmarshall(dynamodb.NewImage || {})
    if (newImage.DataCategory === 'Meta::Character') {
        return await handleCharacterEvent({ dbClient, eventName, oldImage, newImage })
    }
}