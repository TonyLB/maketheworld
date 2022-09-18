import { PutEventsCommand } from "@aws-sdk/client-eventbridge"

import sortImportTree from '@tonylb/mtw-utilities/dist/executeCode/sortImportTree'
import { assetDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { splitType } from '@tonylb/mtw-utilities/dist/types'
import { ebClient } from '../clients'

export const generatePersonalAssetList = async (player) => {
    if (player) {
        const Items = await assetDB.query({
            IndexName: 'PlayerIndex',
            player,
            KeyConditionExpression: "DataCategory = :dc",
            ExpressionAttributeValues: {
                ":dc": `Meta::Asset`
            },
            ProjectionFields: ['AssetId', 'importTree', 'Story']
        })
        const personalAssets = Items
            .filter(({ Story }) => (!Story))
            .map(({ AssetId, importTree }) => ({ AssetId: splitType(AssetId)[1], importTree }))
            .filter(({ AssetId }) => (AssetId))
            .map(({ AssetId, importTree }) => ({ [AssetId]: importTree }))
        return sortImportTree(Object.assign({}, ...personalAssets))
    }    
    return []
}

export const convertAssetQuery = (queryItems) => {
    const Characters = queryItems
        .filter(({ DataCategory }) => (DataCategory === 'Meta::Character'))
        .map(({ AssetId, Name, scopedId, fileName, fileURL }) => ({ CharacterId: splitType(AssetId)[1], Name, scopedId, fileName, fileURL }))
    const Assets = queryItems
        .filter(({ DataCategory }) => (DataCategory === 'Meta::Asset'))
        .map(({ AssetId, scopedId, Story, instance }) => ({ AssetId: splitType(AssetId)[1], scopedId, Story, instance }))

    return {
        Characters,
        Assets
    }
}

export const generatePersonalAssetLibrary = async (player) => {
    if (player) {
        const items = await assetDB.query({
            IndexName: 'PlayerIndex',
            player,
            ProjectionFields: ['AssetId', 'DataCategory', '#name', 'scopedId', 'fileName', 'fileURL', 'Story', 'instance'],
            ExpressionAttributeNames: {
                '#name': 'Name'
            }
        })
        const { Characters, Assets } = convertAssetQuery(items)
        return {
            PlayerName: player,
            Characters,
            Assets
        }
    }
    return {}
}

export const healPlayer = async (player) => {
    const { Characters, Assets } = await generatePersonalAssetLibrary(player)
    console.log(`Publishing to eventBus: ${process.env.EVENT_BUS_NAME}`)
    console.log(JSON.stringify({ Characters, Assets }, null, 4))
    await ebClient.send(new PutEventsCommand({
        Entries: [{
            EventBusName: process.env.EVENT_BUS_NAME,
            Source: 'mtw.coordination',
            DetailType: 'Update Player',
            Detail: JSON.stringify({
                PlayerName: player,
                Characters,
                Assets
            })
        }]
    }))
}