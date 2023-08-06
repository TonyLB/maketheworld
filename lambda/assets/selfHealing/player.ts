import { PutEventsCommand } from "@aws-sdk/client-eventbridge"
import { v4 as uuidv4 } from 'uuid'

import { assetDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { splitType } from '@tonylb/mtw-utilities/dist/types'
import { ebClient } from '../clients'
import internalCache from "../internalCache"
import { newGuestName } from "../player/guestNames"

import { CognitoIdentityProviderClient, ListUsersCommand } from "@aws-sdk/client-cognito-identity-provider"

const { COGNITO_POOL_ID } = process.env

const params = { region: process.env.AWS_REGION }
const cognitoClient = new CognitoIdentityProviderClient(params)

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
            Key: {
                player,
            },
            ProjectionFields: ['AssetId', 'DataCategory', 'Name', 'scopedId', 'fileName', 'fileURL', 'Story', 'instance'],
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

export const healPlayer = async (player: string) => {
    const { guestName, guestId } = await internalCache.PlayerSettings.get(player)
    const confirmedGuestName = guestName || await newGuestName()
    const confirmedGuestId = guestId || uuidv4()
    if (!guestName || !guestId) {
        await assetDB.optimisticUpdate({
            Key: {
                AssetId: `PLAYER#${player}`,
                DataCategory: 'Meta::Player'
            },
            updateKeys: ['guestName', 'guestId'],
            updateReducer: (draft) => {
                draft.guestName = confirmedGuestName
                draft.guestId = confirmedGuestId
            }
        })
        internalCache.PlayerSettings.set(player, { guestName: confirmedGuestName, guestId: confirmedGuestId })
    }
    
    const { Characters, Assets } = await generatePersonalAssetLibrary(player)
    await ebClient.send(new PutEventsCommand({
        Entries: [{
            EventBusName: process.env.EVENT_BUS_NAME,
            Source: 'mtw.coordination',
            DetailType: 'Update Player',
            Detail: JSON.stringify({
                PlayerName: player,
                Characters,
                Assets,
                guestName: confirmedGuestName,
                guestId: confirmedGuestId
            })
        }]
    }))
}

export const healAllPlayers = async () => {
    //
    // TODO: Filter on only confirmed players, to prevent healing in lots of unconfirmed names
    //
    const { Users = [] } = await cognitoClient.send(new ListUsersCommand({
            UserPoolId: COGNITO_POOL_ID
        }))
    const userNames = Users
        .map(({ Username }) => (Username))
        .filter((userName) => (userName))
    await Promise.all(
        userNames
            .filter((userName): userName is string => (Boolean(userName)))
            .map(healPlayer)
    )
    return {}
}