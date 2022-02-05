import { GetItemCommand, ScanCommand, PutItemCommand, UpdateItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'

import { splitType } from '/opt/utilities/types.js'

const { TABLE_PREFIX } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`
const assetsTable = `${TABLE_PREFIX}_assets`

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

export const healGlobalValues = async (dbClient) => {
    try {
        const healConnections = async () => {
            const { Items = [] } = await dbClient.send(new ScanCommand({
                TableName: ephemeraTable,
                FilterExpression: "begins_with(EphemeraId, :player) AND begins_with(DataCategory, :connection)",
                ExpressionAttributeValues: marshall({
                    ':player': 'PLAYER#',
                    ':connection': 'CONNECTION#'
                }),
                ProjectionExpression: 'EphemeraId, DataCategory'
            }))
        
            const connectionMap = Items
                .map(unmarshall)
                .map(({ EphemeraId, DataCategory }) => ({ Player: splitType(EphemeraId)[1], Connection: splitType(DataCategory)[1]}))
                .reduce((previous, { Player, Connection }) => ({ ...previous, [Connection]: Player }), {})
        
            await dbClient.send(new PutItemCommand({
                TableName: ephemeraTable,
                Item: marshall({
                    EphemeraId: 'Global',
                    DataCategory: 'Connections',
                    connections: connectionMap
                })
            }))
        }

        const healGlobalAssets = async () => {
            const { Items = [] } = await dbClient.send(new QueryCommand({
                TableName: assetsTable,
                IndexName: 'DataCategoryIndex',
                KeyConditionExpression: "DataCategory = :dc",
                FilterExpression: "#zone = :canon",
                ExpressionAttributeValues: marshall({
                    ":dc": `Meta::Asset`,
                    ':canon': 'Canon'
                }),
                ExpressionAttributeNames: {
                    '#zone': 'zone'
                },
                ProjectionExpression: 'AssetId, importTree'
            }))
            const globalAssets = Items.map(unmarshall)
                .map(({ AssetId, importTree }) => ({ AssetId: splitType(AssetId)[1], importTree }))
                .filter(({ AssetId }) => (AssetId))
                .map(({ AssetId, importTree }) => ({ [AssetId]: importTree }))
            const globalAssetsSorted = sortImportTree(Object.assign({}, ...globalAssets))
            await dbClient.send(new UpdateItemCommand({
                TableName: ephemeraTable,
                Key: marshall({
                    EphemeraId: `Global`,
                    DataCategory: 'Assets'
                }),
                UpdateExpression: `SET assets = :assets`,
                ExpressionAttributeValues: marshall({
                    ':assets': globalAssetsSorted
                })
            }))
        }

        const [connections] = await Promise.all([
            healConnections(),
            healGlobalAssets()
        ])
        return connections
    }
    catch(error) {}
    return {}
    
}

export const healCharacter = async (dbClient, CharacterId) => {
    try {
        const { Item } = await dbClient.send(new GetItemCommand({
            TableName: assetsTable,
            Key: marshall({
                AssetId: `CHARACTER#${CharacterId}`,
                DataCategory: 'Meta::Character'
            }),
            ProjectionExpression: 'player, #Name, HomeId',
            ExpressionAttributeNames: {
                '#Name': 'Name'
            }
        }))
        
        const healPersonalAssetList = async () => {
            if (Item) {
                const { player } = unmarshall(Item)
                if (player) {
                    const { Items = [] } = await dbClient.send(new QueryCommand({
                        TableName: assetsTable,
                        IndexName: 'PlayerIndex',
                        KeyConditionExpression: "player = :player AND DataCategory = :dc",
                        ExpressionAttributeValues: marshall({
                            ":dc": `Meta::Asset`,
                            ":player": player
                        }),
                        ProjectionExpression: 'AssetId, importTree'
                    }))
                    const personalAssets = Items.map(unmarshall)
                        .map(({ AssetId, importTree }) => ({ AssetId: splitType(AssetId)[1], importTree }))
                        .filter(({ AssetId }) => (AssetId))
                        .map(({ AssetId, importTree }) => ({ [AssetId]: importTree }))
                    return sortImportTree(Object.assign({}, ...personalAssets))
                }    
            }
            return []
        }

        const healCharacterItem = async () => {
            if (Item) {
                const { Name, HomeId } = unmarshall(Item)
                const personalAssets = await healPersonalAssetList()
                await dbClient.send(new UpdateItemCommand({
                    TableName: ephemeraTable,
                    Key: marshall({
                        EphemeraId: `CHARACTERINPLAY#${CharacterId}`,
                        DataCategory: 'Connection'
                    }),
                    UpdateExpression: `SET #Name = :name, assets = :assets, RoomId = if_not_exists(RoomId, :homeId), Connected = if_not_exists(Connected, :false)`,
                    ExpressionAttributeNames: {
                        '#Name': 'Name'
                    },
                    ExpressionAttributeValues: marshall({
                        ':name': Name,
                        ':homeId': HomeId || 'VORTEX',
                        ':false': false,
                        ':assets': personalAssets
                    })
                }))
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
