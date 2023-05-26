import { PutEventsCommand } from "@aws-sdk/client-eventbridge"

import { assetDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { splitType } from '@tonylb/mtw-utilities/dist/types'
import { ebClient } from '../clients'
import internalCache from "../internalCache"
import { newGuestName } from "../player/guestNames"

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

type HealPlayerOptions = {
    updateCognito: boolean;
}

export const healPlayer = async (player: string, options?: HealPlayerOptions) => {
    const { found, guestName } = await internalCache.PlayerSettings.get(player)
    const confirmedGuestName = guestName || await newGuestName()
    if (!guestName) {
        await assetDB.optimisticUpdate({
            key: {
                AssetId: `PLAYER#${player}`,
                DataCategory: 'Meta::Player'
            },
            updateKeys: ['guestName'],
            updateReducer: (draft) => {
                draft.guestName = confirmedGuestName
            }
        })
        //
        // TODO: Add options to healPlayer, and use to determine whether to
        // update Cognito with new guestName (if generated):  That step
        // should happen in the case of a direct heal, but should not happen
        // when being called from the PostConfirmation_ConfirmSignUp lifecycle
        // hook
        //
        internalCache.PlayerSettings.set(player, { guestName: confirmedGuestName })
    }
    
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
                Assets,
                guestName: confirmedGuestName
            })
        }]
    }))
}