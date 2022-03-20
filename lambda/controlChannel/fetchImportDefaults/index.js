import { sortImportTree } from '/opt/utilities/executeCode/sortImportTree.js'
import { unique } from '/opt/utilities/lists.js'
import { objectMap } from '/opt/utilities/objects.js'
import { assetDB } from '/opt/utilities/dynamoDB/index.js'

const importTreeByAssetId = async (assetId) => {
    const { importTree = {} } = await assetDB.getItem({
        AssetId: `ASSET#${assetId}`,
        DataCategory: 'Meta::Asset',
        ProjectionFields: ['importTree']
    })
    return { [assetId]: importTree }
}

const getAssetInfoByScopedId = (assetId) => async (scopedId) => {
    const [{ AssetId, defaultAppearances = [] } = {}] = await assetDB.query({
        IndexName: 'ScopedIdIndex',
        scopedId,
        KeyConditionExpression: 'DataCategory = :dc',
        ExpressionAttributeValues: {
            ':dc': `ASSET#${assetId}`
        },
        ProjectionFields: ['AssetId', 'defaultAppearances']
    })
    return { [scopedId]: { AssetId, defaultAppearances } }
}

//
// Cut out the middleman of scopedIds from import assets, and create a
// mapping directly from the local ID as mapped in the dependent asset
// to the database UUID assigned to the item.
//
// Note that, because you can import the same global item from different
// assets under different pseudonyms, the mapping *back* is technically
// not one-to-one (although it's hard to imagine a use-case)
//
export const getTranslateMapsFromAssetInfoReducer = (importsByAssetId) => (priorTranslateMaps, { assetId, assetInfo }) => {
    const localImportMapping = importsByAssetId[assetId] || {}
    const localIdsByScopedId = Object.entries(localImportMapping)
        .reduce((previous, [localId, scopedId]) => ({
            ...previous,
            [scopedId]: [
                ...(previous[scopedId] || []),
                localId
            ]
        }), {})

    const finalDefaultAppearanceByLocalId = Object.entries(assetInfo)
        .reduce((previous, [scopedId, { defaultAppearances }]) => (
            localIdsByScopedId[scopedId]
                .reduce((accumulator, localId) => ({
                    ...accumulator,
                    [localId]: defaultAppearances
                }), previous)
        ), {})

    const localIdScopedIdTuples = Object.entries(assetInfo)
        .map(([scopedId, { AssetId }]) => ([scopedId, AssetId]))
        .filter(([scopedId]) => (localIdsByScopedId[scopedId]))
        .reduce((previous, [scopedId, itemId]) => ([
            ...previous,
            ...localIdsByScopedId[scopedId].map((localId) => ([localId, itemId]))
        ]), [])
    const itemIdByLocalId = localIdScopedIdTuples
        .reduce((previous, [localId, itemId]) => ({
            ...previous,
            [localId]: itemId
        }), {})
    const localIdsByItemId = localIdScopedIdTuples
        .reduce((previous, [localId, itemId]) => ({
            ...previous,
            [itemId]: [
                ...(previous[itemId] || []),
                localId
            ]
        }), {})

    return {
        itemIdByLocalId: {
            ...priorTranslateMaps.itemIdByLocalId,
            ...itemIdByLocalId
        },
        localIdsByItemId: Object.entries(localIdsByItemId)
            .reduce((previous, [itemId, localIds]) => ({
                ...previous,
                [itemId]: [
                    ...(previous[itemId] || []),
                    ...localIds
                ]
            }), priorTranslateMaps.localIdsByItemId),
        finalDefaultAppearanceByLocalId: {
            ...priorTranslateMaps.finalDefaultAppearanceByLocalId,
            ...finalDefaultAppearanceByLocalId
        }
    }
}

export const fetchImportDefaults = async (importsByAssetId) => {
    
    const [importMapFetch, assetLookups] = await Promise.all([
        //
        // Get importTree maps to find ancestor assets to search in
        //
        Promise.all(Object.keys(importsByAssetId).map((assetId) => (importTreeByAssetId(assetId)))),
        //
        // Query direct-imports to get the globalized AssetId (as well as the defaultAppearances,
        // as long as we're querying a record)
        //
        Promise.all(Object.entries(importsByAssetId).map(async ([assetId, items]) => {
            const uniqueScopedIds = unique(Object.values(items))
            const assetInfoByScopedId = await Promise.all(uniqueScopedIds.map((scopedId) => (getAssetInfoByScopedId(assetId)(scopedId))))
            return { assetId, assetInfo: Object.assign({}, ...assetInfoByScopedId) }
        }))
    ])
    const importTree = Object.assign({}, ...importMapFetch)
    const sortedImports = sortImportTree(importTree)

    const {
        itemIdByLocalId,
        localIdsByItemId,
        finalDefaultAppearanceByLocalId
    } = assetLookups.reduce(getTranslateMapsFromAssetInfoReducer(importsByAssetId), {
        itemIdByLocalId: {},
        localIdsByItemId: {},
        finalDefaultAppearanceByLocalId: {}
    })
    //
    // Create a list for each imported Asset of the ancestors for that particular asset,
    // and then create a cross-product of all the globalized IDs (for items that have
    // globalized IDs, i.e. Rooms and Features) multiplied by all of the ancestor Assets
    // that might have information about them
    //
    const allPossibleImports = Object.entries(importTree)
        .map(([assetId, ancestryTree]) => {
            const localSortedImports = sortImportTree(ancestryTree)
            const assetsToBatchGet = unique(Object.keys(importsByAssetId[assetId] || {}).map((localId) => (itemIdByLocalId[localId])))
            const crossProduct = localSortedImports.reduce((previous, dcAsset) => ([
                ...previous,
                ...assetsToBatchGet.map((AssetId) => ({ DataCategory: `ASSET#${dcAsset}`, AssetId }))
            ]), [])
            return crossProduct
        })
        .reduce((previous, batch) => ([...previous, ...batch]), [])

    const batchGetImports = await assetDB.batchGetItem({
        Items: allPossibleImports,
        ProjectionFields: ['AssetId', 'DataCategory', 'defaultAppearances']
    })
    //
    // Now that you have all possible defaultAppearances, parse through the list
    // in sortedImports order, reducing as you go, in order to create the
    // final aggregate defaultAppearances
    //
    const ancestryDefaultAppearances = sortedImports
        .reduce((previous, importAssetId) => {
            const itemsForThisAsset = batchGetImports
                .filter(({ DataCategory }) => (DataCategory === `ASSET#${importAssetId}`))
            return itemsForThisAsset.reduce((accumulator, { AssetId, defaultAppearances }) => {
                const localIds = localIdsByItemId[AssetId] || []
                return localIds.reduce((innerAccumulator, localId) => ({
                    ...innerAccumulator,
                    [localId]: [
                        ...(innerAccumulator[localId] || []),
                        ...defaultAppearances
                    ]
                }), accumulator)
            }, previous)
        }, {})
    const allDefaultAppearances = Object.entries(finalDefaultAppearanceByLocalId)
        .reduce((previous, [localId, defaultAppearances]) => ({
            ...previous,
            [localId]: [
                ...(previous[localId] || []),
                ...defaultAppearances
            ]
        }), ancestryDefaultAppearances)
    const reduceAppearances = (defaultAppearances) => (
        defaultAppearances
            .reduce((accumulator, { name = '', render = [], contents = [] }) => ({
                ...accumulator,
                name: `${accumulator.name}${name}`,
                render: [...accumulator.render, ...render],
                contents: [...accumulator.contents, ...contents]
            }), { name: '', render: [], contents: [] })
        )
    const filterAppearances = ({ name, render = [], contents = [] }) => ({
        ...(name ? { name } : {}),
        ...(render.length ? { render } : {}),
        ...(contents.length ? { contents } : {})
    })
    return objectMap(objectMap(allDefaultAppearances, reduceAppearances), filterAppearances)
}

export default fetchImportDefaults
