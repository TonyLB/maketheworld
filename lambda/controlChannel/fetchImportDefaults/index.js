import { sortImportTree } from '/opt/utilities/executeCode/sortImportTree.js'
import { unique } from '/opt/utilities/lists.js'
import { splitType } from '/opt/utilities/types.js'
import { objectMap } from '/opt/utilities/objects.js'
import { assetDB } from '/opt/utilities/dynamoDB/index.js'

const importMetaByAssetId = async (assetId) => {
    const { importTree = {}, namespaceMap = {}, defaultNames = {}, defaultExits = [] } = await assetDB.getItem({
        AssetId: `ASSET#${assetId}`,
        DataCategory: 'Meta::Asset',
        ProjectionFields: ['importTree', 'namespaceMap', 'defaultNames', 'defaultExits']
    })
    return { [assetId]: { importTree, namespaceMap, defaultNames, defaultExits } }
}

//
// TODO:  Refactor algorithm to figure out ScopedIds from a single query against
// the top-level importing asset:  All of the imported fields should have
// top-level adjacency-list entries, so there is no reason to spawn off
// queries in a parallelized loop in this way.  The value of fetching the
// defaultAppearance from the *direct* import is obsoleted by the fact that
// we're batchGetting defaultAppearance from *all* imports.
//
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
// not one-to-one (although it's hard to imagine a use-case for
// double-importing and it's probably a good thing to validate against
// it eventually)
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

export const fetchImportDefaults = async ({ importsByAssetId, assetId: topLevelAssetId }) => {
    
    const [topLevelMetaFetch, importMetaFetch, assetLookups] = await Promise.all([
        importMetaByAssetId(topLevelAssetId),
        //
        // Get importTree maps to find ancestor assets to search in
        //
        Promise.all(Object.keys(importsByAssetId).map((assetId) => (importMetaByAssetId(assetId)))),
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
    const topLevelMeta = topLevelMetaFetch[topLevelAssetId]
    const importMeta = Object.assign({}, ...importMetaFetch)
    const importTree = objectMap(importMeta, ({ importTree }) => (importTree))
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
    // and then create a cross-product of all the globalized IDs (for Maps and Components)
    // multiplied by all of the ancestor Assets that might have information about them
    //
    const importedByTopLevel = (assetId) => ({ key: namespaceKey }) => {
        
        if (splitType(namespaceKey)[0] === assetId) {
            return true
        }
        return Boolean(Object.values(importMeta[assetId]?.namespaceMap || {}).find(({ key }) => (key === namespaceKey)))
    }
    const neededImports = sortedImports
        .map((assetId) => (
            Object.values(topLevelMeta.namespaceMap)
                .filter(importedByTopLevel(assetId))
                .map(({ assetId: itemId }) => ({ DataCategory: `ASSET#${assetId}`, AssetId: itemId }))
        ))
        .reduce((previous, list) => ([...previous, ...list]), [])

    const batchGetImports = await assetDB.batchGetItem({
        Items: neededImports,
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
