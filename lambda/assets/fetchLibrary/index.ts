import { assetDB } from "@tonylb/mtw-utilities/dist/dynamoDB"
import { splitType } from "@tonylb/mtw-utilities/dist/types"

import { FetchLibraryMessage, MessageBus } from "../messageBus/baseClasses"

import internalCache from '../internalCache'

import { apiClient } from '@tonylb/mtw-utilities/dist/apiManagement/apiManagementClient'

const convertAssetQuery = (queryItems) => {
    const Characters = queryItems
        .filter(({ DataCategory }) => (DataCategory === 'Meta::Character'))
        .map(({ AssetId, Name, scopedId, fileName, fileURL, FirstImpression, Pronouns, OneCoolThing, Outfit }) => ({ CharacterId: splitType(AssetId)[1], Name, scopedId, fileName, fileURL, Pronouns, FirstImpression, OneCoolThing, Outfit }))
    const Assets = queryItems
        .filter(({ DataCategory }) => (DataCategory === 'Meta::Asset'))
        .map(({ AssetId, scopedId, Story, instance }) => ({ AssetId: splitType(AssetId)[1], scopedId, Story, instance }))

    return {
        Characters,
        Assets
    }
}

const fetchLibrary = async () => {
    const Items = await assetDB.query({
        IndexName: 'ZoneIndex',
        zone: 'Library',
        KeyConditionExpression: 'begins_with(DataCategory, :dcPrefix)',
        ExpressionAttributeValues: {
            ':dcPrefix': 'Meta::'
        },
        ExpressionAttributeNames: {
            '#name': 'Name'
        },
        ProjectionFields: ['AssetId', 'DataCategory', 'Connected', 'RoomId', '#name', 'fileURL', 'FirstImpression', 'Pronouns', 'OneCoolThing', 'Outfit']
    })

    const { Characters, Assets } = convertAssetQuery(Items)

    return {
        messageType: 'Library',
        Characters,
        Assets
    }
}

export const fetchLibraryMessage = async ({ payloads, messageBus }: { payloads: FetchLibraryMessage[], messageBus: MessageBus }): Promise<void> => {
    const libraryEphemera = await fetchLibrary()
    messageBus.send({
        type: 'ReturnValue',
        body: libraryEphemera
    })
}

export default fetchLibraryMessage
