import { CognitoIdentityProviderClient, ListUsersCommand } from "@aws-sdk/client-cognito-identity-provider"

import { assetDB, ephemeraDB } from '../dynamoDB/index.js'
import { splitType } from '../types.js'
import { asyncSuppressExceptions } from '../errors.js'

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
        userNames.map((userName) => (
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

const unencumberedImports = (tree, excludeList = [], depth = 0) => {
    if (depth > 200) {
        return []
    }
    const directImports = Object.entries(tree)
        .filter(([key]) => (!excludeList.includes(key)))
    const unencumbered = directImports
        .map(([key, imports]) => ([key, Object.keys(imports)]))
        .map(([key, imports]) => ([
            key,
            imports.filter((dependency) => (!excludeList.includes(dependency)))
        ]))
    const unencumberedImportsAll = [
        ...unencumbered.filter(([key, imports]) => (imports.length === 0)).map(([key]) => key),
        ...Object.values(tree).map((recurse) => (unencumberedImports(recurse, excludeList, depth + 1))).reduce((previous, list) => ([...previous, ...list]), [])
    ]
    return [...(new Set(unencumberedImportsAll))]
}

const sortImportTree = (tree, currentList = []) => {
    const readyImports = unencumberedImports(tree, currentList)
    if (readyImports.length > 0) {
        return [
            ...readyImports.sort((a, b) => (a.localeCompare(b))),
            ...sortImportTree(tree, [...currentList, ...readyImports])
        ]
    }
    else {
        return []
    }
}

export const healGlobalValues = async ({ shouldHealConnections = true, shouldHealGlobalAssets = true }) => {
    return await asyncSuppressExceptions(async () => {
        const healConnections = async () => {
            const Items = await ephemeraDB.query({
                IndexName: 'DataCategory',
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
        return {}
    }, async () => ({}))
}

export const healPersonalAssets = async ({ PlayerName }) => {
    if (!PlayerName) {
        return
    }

    const queryItems = await assetDB.query({
        IndexName: 'PlayerIndex',
        player: PlayerName,
        ProjectionFields: ['DataCategory', 'AssetId', 'importTree']
    })

    const personalAssetEntries = queryItems
        .filter(({ DataCategory }) => (DataCategory === 'Meta::Asset'))
        .map(({ AssetId, importTree }) => ({ AssetId: splitType(AssetId)[1], importTree }))
        .filter(({ AssetId }) => (AssetId))
        .map(({ AssetId, importTree }) => ({ [AssetId]: importTree }))
    const personalAssets = sortImportTree(Object.assign({}, ...personalAssetEntries))

    const characters = queryItems
        .filter(({ DataCategory }) => (DataCategory === 'Meta::Character'))

    if (CharacterId)
    await Promise.all(
        characters.map(({ AssetId }) => (
            ephemeraDB.update({
                EphemeraId: `CHARACTERINPLAY#${splitType(AssetId)[1]}`,
                DataCategory: 'Meta::Character',
                UpdateExpression: `SET assets = :assets`,
                ExpressionAttributeValues: {
                    ':assets': personalAssets
                }
            })        
        ))
    )

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
            ProjectionFields: ['AssetId', 'importTree']
        })
        const personalAssets = Items
            .map(({ AssetId, importTree }) => ({ AssetId: splitType(AssetId)[1], importTree }))
            .filter(({ AssetId }) => (AssetId))
            .map(({ AssetId, importTree }) => ({ [AssetId]: importTree }))
        return sortImportTree(Object.assign({}, ...personalAssets))
    }    
    return []
}

export const defaultColorFromCharacterId = (CharacterId) => (
    ['green', 'purple', 'pink'][parseInt(CharacterId.slice(0, 3), 16) % 3]
)

export const healCharacter = async (CharacterId) => {
    try {
        const Item = await assetDB.getItem({
            AssetId: `CHARACTER#${CharacterId}`,
            DataCategory: 'Meta::Character',
            ProjectionFields: ['player', '#Name', 'HomeId', 'Color'],
            ExpressionAttributeNames: {
                '#Name': 'Name'
            }
        })

        const healCharacterItem = async () => {
            if (Item) {
                const { Name, HomeId, player, Color = defaultColorFromCharacterId(CharacterId) } = Item
                const personalAssets = await generatePersonalAssetList(player)
                await ephemeraDB.update({
                    EphemeraId: `CHARACTERINPLAY#${CharacterId}`,
                    DataCategory: 'Meta::Character',
                    UpdateExpression: `SET #Name = :name, assets = :assets, RoomId = if_not_exists(RoomId, :homeId), Connected = if_not_exists(Connected, :false), Color = :color`,
                    ExpressionAttributeNames: {
                        '#Name': 'Name'
                    },
                    ExpressionAttributeValues: {
                        ':name': Name,
                        ':homeId': HomeId || 'VORTEX',
                        ':false': false,
                        ':assets': personalAssets,
                        ':color': Color
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
