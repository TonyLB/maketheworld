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

export const fetchImportDefaults = async ({ importsByAssetId, assetId: topLevelAssetId }) => {
    
    const [topLevelMetaFetch, importMetaFetch] = await Promise.all([
        importMetaByAssetId(topLevelAssetId),
        //
        // Get importTree maps to find ancestor assets to search in
        //
        Promise.all(Object.keys(importsByAssetId).map((assetId) => (importMetaByAssetId(assetId)))),
    ])
    const topLevelMeta = topLevelMetaFetch[topLevelAssetId]
    const importMeta = Object.assign({}, ...importMetaFetch)
    const importTree = objectMap(importMeta, ({ importTree }) => (importTree))
    const sortedImports = sortImportTree(importTree)
    const localIdsByItemId = Object.entries(topLevelMeta?.namespaceMap || {})
        .reduce((previous, [key, { assetId }]) => ({
            ...previous,
            [assetId]: [...(previous[assetId] || []), key]
        }), {})

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
        .filter(({ AssetId }) => (AssetId))

    const batchGetImports = await assetDB.batchGetItem({
        Items: neededImports,
        ProjectionFields: ['AssetId', 'DataCategory', 'defaultAppearances']
    })
    //
    // Now that you have all possible defaultAppearances, parse through the list
    // in sortedImports order, reducing as you go, in order to create the
    // final aggregate defaultAppearances
    //
    const ancestryDefaultAppearances = [...sortedImports, topLevelAssetId]
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
    return objectMap(objectMap(ancestryDefaultAppearances, reduceAppearances), filterAppearances)
}

export default fetchImportDefaults
