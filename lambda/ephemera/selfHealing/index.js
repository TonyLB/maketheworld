import { splitType } from '/opt/utilities/types.js'
import { scanEphemera, ephemeraDB, assetDB } from '/opt/utilities/dynamoDB/index.js'

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

export const healGlobalValues = async () => {
    try {
        const healConnections = async () => {
            const Items = await scanEphemera({
                FilterExpression: "begins_with(EphemeraId, :player) AND begins_with(DataCategory, :connection)",
                ExpressionAttributeValues: {
                    ':player': 'PLAYER#',
                    ':connection': 'CONNECTION#'
                },
                ProjectionFields: ['EphemeraId', 'DataCategory']
            })
        
            const connectionMap = Items
                .map(({ EphemeraId, DataCategory }) => ({ Player: splitType(EphemeraId)[1], Connection: splitType(DataCategory)[1]}))
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

        const [connections] = await Promise.all([
            healConnections(),
            healGlobalAssets()
        ])
        return connections
    }
    catch(error) {}
    return {}
    
}

export const healCharacter = async (CharacterId) => {
    try {
        const { Item } = await assetDB.getItem({
            AssetId: `CHARACTER#${CharacterId}`,
            DataCategory: 'Meta::Character',
            ProjectionFields: ['player', '#Name', 'HomeId'],
            ExpressionAttributeNames: {
                '#Name': 'Name'
            }
        })
        
        const healPersonalAssetList = async () => {
            if (Item) {
                const { player } = Item
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
            }
            return []
        }

        const healCharacterItem = async () => {
            if (Item) {
                const { Name, HomeId } = Item
                const personalAssets = await healPersonalAssetList()
                await ephemeraDB.update({
                    EphemeraId: `CHARACTERINPLAY#${CharacterId}`,
                    DataCategory: 'Connection',
                    UpdateExpression: `SET #Name = :name, assets = :assets, RoomId = if_not_exists(RoomId, :homeId), Connected = if_not_exists(Connected, :false)`,
                    ExpressionAttributeNames: {
                        '#Name': 'Name'
                    },
                    ExpressionAttributeValues: {
                        ':name': Name,
                        ':homeId': HomeId || 'VORTEX',
                        ':false': false,
                        ':assets': personalAssets
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
