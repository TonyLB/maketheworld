import { CognitoIdentityProviderClient, ListUsersCommand } from "@aws-sdk/client-cognito-identity-provider"

import { assetDB, ephemeraDB } from '../dynamoDB'
import { splitType } from '../types'
import { asyncSuppressExceptions } from '../errors'
import sortImportTree from '../executeCode/sortImportTree'

const { COGNITO_POOL_ID } = process.env

const params = { region: process.env.AWS_REGION }
const cognitoClient = new CognitoIdentityProviderClient(params)

export const healPlayers = async () => {
    //
    // TODO: Filter on only confirmed players, to prevent healing in lots of unconfirmed names
    //
    const [{ Users = [] }, characterQueryReturn] = await Promise.all([
        cognitoClient.send(new ListUsersCommand({
            UserPoolId: COGNITO_POOL_ID
        })),
        assetDB.query({
            IndexName: 'DataCategoryIndex',
            DataCategory: 'Meta::Character',
            ProjectionFields: ['AssetId', '#name', 'fileName', 'scopedId', 'player'],
            ExpressionAttributeNames: { '#name': 'Name' }
        })
    ])
    const userNames = Users
        .map(({ Username }) => (Username))
        .filter((userName) => (userName))
    const charactersByPlayer = characterQueryReturn
        .map(({ player, AssetId, Name, fileName, scopedId }) => ({
            player,
            Name,
            fileName,
            scopedId,
            CharacterId: splitType(AssetId)[1]
        }))
        .reduce((previous, { player, CharacterId, Name, scopedId, fileName }) => ({
            ...previous,
            [player]: {
                ...(previous[player] || {}),
                [CharacterId]: {
                    Name,
                    fileName,
                    scopedId
                }
            }
        }), {})
    await Promise.all(
        userNames.map((userName = '') => (
            assetDB.update({
                AssetId: `PLAYER#${userName}`,
                DataCategory: 'Meta::Player',
                UpdateExpression: "SET #code = if_not_exists(#code, :false), #characters = :characters",
                ExpressionAttributeValues: {
                    ':false': false,
                    ':characters': charactersByPlayer[userName] || {}
                },
                ExpressionAttributeNames: {
                    '#code': 'CodeOfConductConsent',
                    '#characters': 'Characters'
                }
            })
        ))
    )
    return {}
}

export const healGlobalValues = async ({ shouldHealConnections = true, shouldHealGlobalAssets = true }) => {
    return await asyncSuppressExceptions(async () => {
        const healConnections = async () => {
            const Items = await ephemeraDB.query({
                IndexName: 'DataCategoryIndex',
                DataCategory: 'Meta::Connection',
                ProjectionFields: ['EphemeraId', 'player']
            })
        
            const connectionMap = Items
                .map(({ EphemeraId, player }) => ({ Player: player, Connection: splitType(EphemeraId)[1]}))
                .reduce((previous, { Player, Connection }) => ({ ...previous, [Connection]: Player }), {})
        
            await ephemeraDB.putItem({
                EphemeraId: 'Global',
                DataCategory: 'Connections',
                connections: connectionMap
            })
        }

        const healGlobalAssets = async () => {
            const Items = await assetDB.query({
                IndexName: 'DataCategoryIndex',
                DataCategory: 'Meta::Asset',
                FilterExpression: "#zone = :canon",
                ExpressionAttributeNames: {
                    '#zone': 'zone'
                },
                ExpressionAttributeValues: {
                    ':canon': 'Canon'
                },
                ProjectionFields: ['AssetId', 'importTree']
            })
            const globalAssets = Items
                .map(({ AssetId, importTree }) => ({ AssetId: splitType(AssetId)[1], importTree }))
                .filter(({ AssetId }) => (AssetId))
                .map(({ AssetId, importTree }) => ({ [AssetId]: importTree }))
            const globalAssetsSorted = sortImportTree(Object.assign({}, ...globalAssets))
            await ephemeraDB.update({
                EphemeraId: 'Global',
                DataCategory: 'Assets',
                UpdateExpression: `SET assets = :assets`,
                ExpressionAttributeValues: {
                    ':assets': globalAssetsSorted
                }
            })
        }

        if (shouldHealConnections) {
            const [connections] = await Promise.all([
                healConnections(),
                ...(shouldHealGlobalAssets ? [healGlobalAssets()] : [])
            ])
            return connections    
        }
        else {
            if (shouldHealGlobalAssets) {
                await healGlobalAssets()
            }
        }
        return
    }, async () => ({}))
}

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

export const generateLibrary = async () => {
    const items = await assetDB.query({
        IndexName: 'ZoneIndex',
        zone: 'Library',
        ProjectionFields: ['AssetId', 'DataCategory', '#name', 'scopedId', 'fileName', 'fileURL', 'Story', 'instance'],
        ExpressionAttributeNames: {
            '#name': 'Name'
        }
    })
    const { Characters, Assets } = convertAssetQuery(items)
    return {
        Characters,
        Assets
    }
}

export const defaultColorFromCharacterId = (CharacterId: string): string => (
    ['green', 'purple', 'pink'][parseInt(CharacterId.slice(0, 3), 16) % 3]
)

export const healCharacter = async (CharacterId: string) => {
    try {
        const Item = await assetDB.getItem<{
            Name: string;
            fileURL: string;
            player: string;
            HomeId: string;
            Color: string;
            Pronouns: {
                subject: string;
                object: string;
                possessive: string;
                adjective: string;
                reflexive: string;
            };
            FirstImpression: string;
            OneCoolThing: string;
            Outfit: string;
        }>({
            AssetId: `CHARACTER#${CharacterId}`,
            DataCategory: 'Meta::Character',
            ProjectionFields: ['player', '#Name', 'fileURL', 'HomeId', 'Color', 'Pronouns', 'FirstImpression', 'OneCoolThing', 'Outfit'],
            ExpressionAttributeNames: {
                '#Name': 'Name'
            }
        })

        const healCharacterItem = async () => {
            if (Item) {
                const {
                    Name,
                    fileURL,
                    HomeId,
                    player,
                    Color = defaultColorFromCharacterId(CharacterId),
                    Pronouns = {
                        subject: 'they',
                        object: 'them',
                        possessive: 'their',
                        adjective: 'theirs',
                        reflexive: 'themself'
                    },
                    FirstImpression,
                    OneCoolThing,
                    Outfit
                } = Item
                const personalAssets = await generatePersonalAssetList(player)
                await ephemeraDB.update({
                    EphemeraId: `CHARACTERINPLAY#${CharacterId}`,
                    DataCategory: 'Meta::Character',
                    UpdateExpression: `SET #Name = :name, fileURL = :fileURL, assets = :assets, RoomId = if_not_exists(RoomId, :homeId), Connected = if_not_exists(Connected, :false), Color = :color, Pronouns = :pronouns, FirstImpression = :firstImpression, Outfit = :outfit, OneCoolThing = :oneCoolThing`,
                    ExpressionAttributeNames: {
                        '#Name': 'Name'
                    },
                    ExpressionAttributeValues: {
                        ':name': Name,
                        ':fileURL': fileURL,
                        ':homeId': HomeId || 'VORTEX',
                        ':false': false,
                        ':assets': personalAssets,
                        ':color': Color,
                        ':pronouns': Pronouns,
                        ':firstImpression': FirstImpression,
                        ':oneCoolThing': OneCoolThing,
                        ':outfit': Outfit
                    }
                })
            }
        }

        await healCharacterItem()

    }
    catch(error) {
        //
        // TODO: Handle absence of character from Assets table
        //
    }
    return {}

}
