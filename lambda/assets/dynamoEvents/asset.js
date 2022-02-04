import { splitType } from "../utilities/types.js"
import { updateEphemera, assetDataCategoryQuery, assetPlayerQuery } from "../utilities/dynamoDB/index.js"

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

const healPersonalAssets = async ({ dbClient, PlayerName }) => {
    if (!PlayerName) {
        return
    }
    const [personalAssetQueryContents, characters] = await Promise.all([
        assetPlayerQuery({
            dbClient,
            player: PlayerName,
            DataCategory: 'Meta::Asset',
            ProjectionFields: ['AssetId', 'importTree']
        }),
        assetPlayerQuery({
            dbClient,
            player: PlayerName,
            DataCategory: 'Meta::Character'
        })
    ])
    const personalAssetEntries = personalAssetQueryContents
        .map(({ AssetId, importTree }) => ({ AssetId: splitType(AssetId)[1], importTree }))
        .filter(({ AssetId }) => (AssetId))
        .map(({ AssetId, importTree }) => ({ [AssetId]: importTree }))
    const personalAssets = sortImportTree(Object.assign({}, ...personalAssetEntries))

    await Promise.all(
        characters.map(({ AssetId }) => (
            updateEphemera({
                dbClient,
                EphemeraId: `CHARACTERINPLAY#${splitType(AssetId)[1]}`,
                DataCategory: 'Connection',
                UpdateExpression: `SET assets = :assets`,
                ExpressionAttributeValues: {
                    ':assets': personalAssets
                }
            })        
        ))
    )

}

export const handleAssetEvents = async ({ dbClient, events }) => {
    const oldImagePlayers = events
        .filter(({ oldImage }) => ((oldImage.zone || '').slice(0, 7) === 'Player/'))
        .map(({ oldImage }) => (oldImage.zone.slice(7).split('/')[0]))
    const newImagePlayers = events
        .filter(({ newImage }) => ((newImage.zone || '').slice(0, 7) === 'Player/'))
        .map(({ newImage }) => (newImage.zone.slice(7).split('/')[0]))
    const playersToUpdate = [...(new Set([...oldImagePlayers, ...newImagePlayers]))]
    await Promise.all([
        ...(events.find(({ oldImage, newImage }) => (oldImage?.zone === 'Canon' || newImage?.zone === 'Canon'))
            ? [healGlobalValues(dbClient)]
            : []
        ),
        Promise.all(playersToUpdate.map((PlayerName) => (healPersonalAssets({ dbClient, PlayerName }))))
    ])
}
