import { unmarshall } from '@aws-sdk/util-dynamodb'

import { handleCharacterEvents } from './character.js'
import { handleAssetEvents } from './asset.js'

//
// TODO: Optimize Record-handling procedure for batches of multiple
// records, so that it doesn't unnecessarily duplicate reads and
// writes.
//

export const handleDynamoEvent = async ({ dbClient, events }) => {
    const characterEvents = events
        .map(({ eventName, dynamodb }) => ({
            eventName,
            oldImage: unmarshall(dynamodb.OldImage) || {},
            newImage: unmarshall(dynamodb.NewImage) || {}
        }))
    await Promise.all([
        handleCharacterEvents({
            dbClient,
            events: characterEvents.filter(({ oldImage, newImage }) => ([oldImage.DataCategory, newImage.DataCategory].includes('Meta::Character')))
        }),
        handleAssetEvents({
            dbClient,
            events: characterEvents.filter(({ oldImage, newImage }) => ([oldImage.DataCategory, newImage.DataCategory].includes('Meta::Asset')))
        })
    ])
}