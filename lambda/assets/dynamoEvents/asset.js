import { splitType } from "/opt/utilities/types.js"
import { updateEphemera, assetDataCategoryQuery, assetPlayerQuery } from "/opt/utilities/dynamoDB/index.js"

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
    const Items = await assetDataCategoryQuery({
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
        EphemeraId: 'Global',
        DataCategory: 'Assets',
        UpdateExpression: `SET assets = :assets`,
        ExpressionAttributeValues: {
            ':assets': globalAssetsSorted
        }
    })
    
}

const healPersonalAssets = async ({ PlayerName }) => {
    if (!PlayerName) {
        return
    }
    const [personalAssetQueryContents, characters] = await Promise.all([
        assetPlayerQuery({
            player: PlayerName,
            DataCategory: 'Meta::Asset',
            ProjectionFields: ['AssetId', 'importTree']
        }),
        assetPlayerQuery({
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

export const handleAssetEvents = async ({ events }) => {
    const oldImagePlayers = events
        .filter(({ oldImage }) => (oldImage.zone === 'Personal'))
        .filter(({ oldImage, newImage }) => (!(oldImage.player === newImage.player)))
        .map(({ oldImage }) => (oldImage.player))
    const newImagePlayers = events
        .filter(({ newImage }) => (newImage.zone === 'Personal'))
        .filter(({ oldImage, newImage }) => (!(oldImage.player === newImage.player)))
        .map(({ newImage }) => (newImage.player))
    const playersToUpdate = [...(new Set([...oldImagePlayers, ...newImagePlayers]))]
    await Promise.all([
        ...(events.find(({ oldImage, newImage }) => ([oldImage.zone, newImage.zone].includes('Canon')))
            ? [healGlobalValues()]
            : []
        ),
        Promise.all(playersToUpdate.map((PlayerName) => (healPersonalAssets({ PlayerName }))))
    ])
}
