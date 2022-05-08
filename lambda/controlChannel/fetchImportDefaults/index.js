import { sortImportTree } from '/opt/utilities/executeCode/sortImportTree.js'
import { splitType } from '/opt/utilities/types.js'
import { objectMap } from '/opt/utilities/objects.js'
import { assetDB } from '/opt/utilities/dynamoDB/index.js'
import { componentAppearanceReduce, isComponentKey } from '/opt/utilities/components/components.js'

const importMetaByAssetId = async (assetId) => {
    const { importTree = {}, namespaceMap = {}, defaultNames = {}, defaultExits = [] } = await assetDB.getItem({
        AssetId: `ASSET#${assetId}`,
        DataCategory: 'Meta::Asset',
        ProjectionFields: ['importTree', 'namespaceMap', 'defaultNames', 'defaultExits']
    })
    return { [assetId]: { importTree, namespaceMap, defaultNames, defaultExits } }
}

export const fetchImportDefaults = async ({ importsByAssetId, assetId: topLevelAssetId }) => {

    //
    // Get meta data from the asset you're fetching defaults for
    //
    const topLevelMetaFetch = await importMetaByAssetId(topLevelAssetId)
    const topLevelMeta = topLevelMetaFetch[topLevelAssetId]

    //
    // Query all the direct imports to assemble an import tree (which may not match with the
    // importTree currently stored in the DB, if importsByAssetId is being passed from an asset
    // that has been edited in the client but not yet saved) and then follow up by querying any
    // ancestor dependencies that are not top level imports.
    //

    const directImportMetaFetch = await Promise.all(Object.keys(importsByAssetId).map((assetId) => (importMetaByAssetId(assetId))))
    const directImportMeta = Object.assign({}, ...directImportMetaFetch)
    const directImportTree = objectMap(directImportMeta, ({ importTree }) => (importTree))
    const sortedImports = sortImportTree(directImportTree)
    const ancestorLookupsNeeded = sortedImports.filter((importId) => (!Object.keys(importsByAssetId).includes(importId)))
    const ancestorImportMetaFetch = await Promise.all(ancestorLookupsNeeded.map((assetId) => (importMetaByAssetId(assetId))))
    const importMeta = Object.assign(directImportMeta, ...ancestorImportMetaFetch)

    const localIdsByItemId = Object.entries(topLevelMeta?.namespaceMap || {})
        .reduce((previous, [key, { assetId }]) => ({
            ...previous,
            [assetId]: [...(previous[assetId] || []), key]
        }), {})
    const localIdsByNamespaceKey = Object.entries(topLevelMeta?.namespaceMap || {})
        .reduce((previous, [key, { key: namespaceKey }]) => ({
            ...previous,
            [namespaceKey]: [...(previous[namespaceKey] || []), key]
        }), {})

    //
    // Create a list for each imported Asset of the ancestors for that particular asset,
    // and then create a list of all asset-item pairs that are part of the import tree
    // for the values actually imported
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
    // TODO:  Treat components (Room, Feature, etc.) separately from Maps.  For Maps, keep a running
    // tally of aggregated defaultNames and defaultExits.  At each asset, compare to check whether there
    // are new exits that must be added to the map layer, or if there is data for the Map itself in the
    // asset.  In either case, append a new inherited-layer to the list.  Deliver the inherited layers
    // instead of accumulated names and renders.
    //
    const ancestryDefaultComponentAppearances = sortedImports
        .reduce((previous, importAssetId) => {
            const itemsForThisAsset = batchGetImports
                .filter(({ DataCategory }) => (DataCategory === `ASSET#${importAssetId}`))
                .filter(({ AssetId }) => (isComponentKey(AssetId)))
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
        defaultAppearances.reduce(componentAppearanceReduce, { name: '', render: [], contents: [] })
    )
    const filterAppearances = ({ name, render = [], contents = [] }) => ({
        ...(name ? { name } : {}),
        ...(render.length ? { render } : {}),
        ...(contents.length ? { contents } : {})
    })

    const { mapAppearances: ancestryDefaultMapAppearances } = sortedImports
        //
        // TODO:  Extend this reduce to maintain three running aggregates rather than one:
        //    * mapAppearances:  As currently being aggregated
        //    * aggregateNames:  A record keyed by translatedId, with the
        //      current aggregated Names for each item.  Update at each new importAssetId
        //      by mapping and aggregating importMeta[importAssetId]?.defaultNames
        //    * aggregateExits: A list of unique exits, with to and from keyed by translatedId.
        //      Update at each new importAssetId by mapping and aggregating
        //      importMeta[importAssetId]?.defaultExits
        //
        .reduce((previous, importAssetId) => {
            console.log(`NamespaceMap (${importAssetId}): ${JSON.stringify(importMeta[importAssetId]?.namespaceMap, null, 4)}`)
            const itemsForThisAsset = batchGetImports
                .filter(({ DataCategory }) => (DataCategory === `ASSET#${importAssetId}`))
                .filter(({ AssetId }) => (splitType(AssetId)[0] === 'MAP'))
            return itemsForThisAsset.reduce((accumulator, { AssetId, defaultAppearances }) => {
                const translateId = (importedId) => {
                    const namespaceKey = importMeta[importAssetId]?.namespaceMap?.[importedId]?.key || `${importAssetId}#${importedId}`
                    if (localIdsByNamespaceKey[namespaceKey]) {
                        return localIdsByNamespaceKey[namespaceKey]
                    }
                    return namespaceKey
                }
                const newDefaultNames = Object.entries(importMeta[importAssetId]?.defaultNames || {})
                    .reduce((innerAccumulator, [key, value]) => {
                        const translatedKey = translateId(key)
                        return {
                            ...innerAccumulator,
                            [translatedKey]: [innerAccumulator[translatedKey] || '', value.name || ''].join('')
                        }
                    }, accumulator.aggregateNames)
                const newMapLayer = {
                    //
                    // TODO: Exits should include:
                    //      * Any exit that is new since the last iteration, and which corresponds to
                    //        rooms already in the map
                    //      * Any exit to or from rooms newly added to the map, which corresponds to
                    //        rooms currently in the map
                    //
                    exits: [],
                    rooms: Object.assign({}, ...defaultAppearances.map(({ rooms = {} }) => (
                        Object.entries(rooms)
                            .reduce((previous, [key, value]) => ({
                                ...previous,
                                [translateId(key)]: {
                                    ...value,
                                    name: newDefaultNames[translateId(key)]
                                }
                            }), {})
                    )))
                }
                console.log(JSON.stringify(localIdsByItemId, null, 4))
                const localIds = localIdsByItemId[AssetId] || []
                console.log(JSON.stringify(localIds, null, 4))
                const newMapAppearances = localIds.reduce((innerAccumulator, localId) => ({
                    ...innerAccumulator,
                    [localId]: [
                        ...(innerAccumulator[localId] || []),
                        newMapLayer
                    ]    
                }), accumulator.mapAppearances)

                return {
                    mapAppearances: newMapAppearances,
                    aggregateNames: newDefaultNames
                }
            }, previous)
        }, { mapAppearances: {}, aggregateNames: {}, aggregateExits: {} })
    return Object.assign({},
        objectMap(objectMap(ancestryDefaultComponentAppearances, reduceAppearances), filterAppearances),
        objectMap(ancestryDefaultMapAppearances, (value) => ({ layers: value }))
    )
}

export default fetchImportDefaults
