import { splitType } from "../utilities/types.js"
import { updateEphemera, assetDataCategoryQuery } from "../utilities/dynamoDB/index.js"

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
    const Items = await assetDataCategoryQuery({
        dbClient,
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
    await updateEphemera({
        dbClient,
        EphemeraId: 'Global',
        DataCategory: 'Assets',
        UpdateExpression: `SET assets = :assets`,
        ExpressionAttributeValues: {
            ':assets': globalAssetsSorted
        }
    })
    
}

// const healPersonalAssets = async ({ dbClient, PlayerName }) => {
//     if (!PlayerName) {
//         return
//     }
//     try {
//         const characters = await dbClient.send(new QueryCommand({
//             TableName: assetsTable,
//             IndexName: 'PlayerIndex',
//             KeyConditionExpression: "player = :player AND DataCategory = :dc",
//             ExpressionAttributeValues: marshall({
//                 ":dc": `Meta::Asset`,
//                 ":player": PlayerName
//             }),
//             ProjectionExpression: 'AssetId, importTree'
//         }))
//         const personalAssetEntries = characters
//             .map(({ AssetId, importTree }) => ({ AssetId: splitType(AssetId)[1], importTree }))
//             .filter(({ AssetId }) => (AssetId))
//             .map(({ AssetId, importTree }) => ({ [AssetId]: importTree }))
//         const personalAssets = sortImportTree(Object.assign({}, ...personalAssetEntries))

//         await dbClient.send(new UpdateItemCommand({
//             TableName: ephemeraTable,
//             Key: marshall({
//                 EphemeraId: `CHARACTERINPLAY#${CharacterId}`,
//                 DataCategory: 'Connection'
//             }),
//             UpdateExpression: `SET #Name = :name, assets = :assets, RoomId = if_not_exists(RoomId, :homeId), Connected = if_not_exists(Connected, :false)`,
//             ExpressionAttributeNames: {
//                 '#Name': 'Name'
//             },
//             ExpressionAttributeValues: marshall({
//                 ':name': Name,
//                 ':homeId': HomeId || 'VORTEX',
//                 ':false': false,
//                 ':assets': personalAssets
//             })
//         }))

//     }
//     catch(error) {
//         //
//         // TODO: Handle absence of character from Assets table
//         //
//     }

// }

export const handleAssetEvents = async ({ dbClient, events }) => {
    await Promise.all([
        ...(events.find(({ oldImage, newImage }) => (oldImage?.zone === 'Canon' || newImage?.zone === 'Canon'))
            ? [healGlobalValues(dbClient)]
            : []
        )
    ])
}
