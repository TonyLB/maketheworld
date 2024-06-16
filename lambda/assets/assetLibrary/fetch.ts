import { assetDB } from "@tonylb/mtw-utilities/ts/dynamoDB"
import { splitType } from "@tonylb/mtw-utilities/ts/types"

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

export const fetchLibrary = async (RequestId: string) => {
    const Items = await assetDB.query({
        IndexName: 'ZoneIndex',
        Key: {
            zone: 'Library'
        },
        KeyConditionExpression: 'begins_with(DataCategory, :dcPrefix)',
        ExpressionAttributeValues: {
            ':dcPrefix': 'Meta::'
        },
        ProjectionFields: ['AssetId', 'DataCategory', 'Connected', 'RoomId', 'Name', 'fileURL', 'FirstImpression', 'Pronouns', 'OneCoolThing', 'Outfit']
    })

    const { Characters, Assets } = convertAssetQuery(Items)

    return {
        messageType: 'Library',
        RequestId,
        Characters,
        Assets
    }
}