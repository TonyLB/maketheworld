import { unmarshall } from '@aws-sdk/util-dynamodb'

import { handleCharacterEvents } from './character.js'
import { handleAssetEvents } from './asset.js'
import { handlePlayerEvents } from './player.js'

//
// TODO: Optimize Record-handling procedure for batches of multiple
// records, so that it doesn't unnecessarily duplicate reads and
// writes.
//

export const handleDynamoEvent = async ({ events }) => {
    const translatedEvents = events
        .map(({ eventName, dynamodb }) => ({
            eventName,
            oldImage: unmarshall(dynamodb.OldImage || {}),
            newImage: unmarshall(dynamodb.NewImage || {})
        }))
    await Promise.all([
        handleCharacterEvents({
            events: translatedEvents.filter(({ oldImage, newImage }) => ([oldImage.DataCategory, newImage.DataCategory].includes('Meta::Character')))
        }),
        handleAssetEvents({
            events: translatedEvents.filter(({ oldImage, newImage }) => ([oldImage.DataCategory, newImage.DataCategory].includes('Meta::Asset')))
        }),
        handlePlayerEvents({
            events: translatedEvents
        })
    ])
}