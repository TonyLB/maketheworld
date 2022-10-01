import { apiClient } from '@tonylb/mtw-utilities/dist/apiManagement/apiManagementClient'

import internalCache from '../internalCache'

import { splitType } from '@tonylb/mtw-utilities/dist/types'
import { objectMap } from '@tonylb/mtw-utilities/dist/objects'
import { assetDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { componentAppearanceReduce, isComponentKey } from '@tonylb/mtw-utilities/dist/components/components'
import { TaggedMessageContent, ImportDefaultsMessage, FetchImportDefaultsMessage, MessageBus } from '../messageBus/baseClasses'

type NamespaceMapItem = {
    assetId: string;
    key: string;
}

type AssetMeta = {
    importTree: Record<string, any>;
    namespaceMap: Record<string, NamespaceMapItem>;
    defaultNames: Record<string, { name: string; tag: 'Feature' | 'Room' }>;
    defaultExits: { name: string; to: string; from: string }[];
}

type AssetAppearance = {
    exits: {
        name: string;
        to: string;
    }[];
    name: string;
    render: ({
        spaceAfter?: boolean;
        spaceBefore?: boolean;
    } & TaggedMessageContent)[]
}

type MapAppearance = {
    rooms: Record<string, {
        name: string;
        x: number;
        y: number;
    }>;
}

const importMetaByAssetId = async (assetId: string) => {
    const { importTree = {}, namespaceMap = {}, defaultNames = {}, defaultExits = [] } = await assetDB.getItem<AssetMeta>({
        AssetId: `ASSET#${assetId}`,
        DataCategory: 'Meta::Asset',
        ProjectionFields: ['importTree', 'namespaceMap', 'defaultNames', 'defaultExits']
    }) || {}
    return { [assetId]: { importTree, namespaceMap, defaultNames, defaultExits } }
}

export const fetchImportDefaults = async ({ payloads, messageBus }: { payloads: FetchImportDefaultsMessage[], messageBus: MessageBus }) => {
    await Promise.all(payloads.map(async ({ importsByAssetId, assetId: topLevelAssetId }) => {

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
        const directImportMeta = Object.assign({}, ...directImportMetaFetch) as Record<string, AssetMeta>
        const directImportTree = objectMap(directImportMeta, ({ importTree }) => (importTree))
        //
        // TODO: As part of moving fetchImportDefaults into asset lambda, figure out how the ancestry should
        // be sorted
        //
        const unencumberedImports = (tree: Record<string, any>, excludeList: string[] = [], depth = 0) => {
            if (depth > 200) {
                return []
            }
            const directImports = Object.entries(tree)
                .filter(([key]) => (!excludeList.includes(key)))
            const unencumbered = directImports
                .map(([key, imports = {}]) => ({ key, imports: Object.keys(imports)}))
                .map(({ key, imports }: { key: string, imports: string[] }) => ([
                    key,
                    imports.filter((dependency) => (!excludeList.includes(dependency)))
                ]))
            const unencumberedImportsAll = [
                ...unencumbered.filter(([key, imports]) => (imports.length === 0)).map(([key]) => key),
                ...Object.values(tree).map((recurse = {}) => (unencumberedImports(recurse, excludeList, depth + 1))).reduce((previous, list) => ([...previous, ...list]), [])
            ]
            return [...(new Set(unencumberedImportsAll))]
        }
        
        const sortImportTree = (tree: Record<string, any>, currentList: string[] = []): string[] => {
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

        const sortedImports = sortImportTree(directImportTree)
        const ancestorLookupsNeeded = sortedImports.filter((importId) => (!Object.keys(importsByAssetId).includes(importId)))
        const ancestorImportMetaFetch = await Promise.all(ancestorLookupsNeeded.map((assetId) => (importMetaByAssetId(assetId))))
        const importMeta = Object.assign(directImportMeta, ...ancestorImportMetaFetch) as Record<string, AssetMeta>

        const localIdsByItemId = Object.entries(topLevelMeta?.namespaceMap || {})
            .reduce((previous, [key, { assetId }]) => ({
                ...previous,
                [assetId]: [...(previous[assetId] || []), key]
            }), {}) as Record<string, string[]>
        const localIdsByNamespaceKey = Object.entries(topLevelMeta?.namespaceMap || {})
            .reduce((previous, [key, { key: namespaceKey }]) => ({
                ...previous,
                [namespaceKey]: [...(previous[namespaceKey] || []), key]
            }), {}) as Record<string, string>

        //
        // Create a list for each imported Asset of the ancestors for that particular asset,
        // and then create a list of all asset-item pairs that are part of the import tree
        // for the values actually imported
        //
        const importedByTopLevel = (assetId: string) => ({ key: namespaceKey }: NamespaceMapItem) => {
            
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

        const batchGetImports = await assetDB.batchGetItem<{
            AssetId: string;
            DataCategory: string;
            defaultAppearances: MapAppearance[];
        }>({
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
            }, {} as Record<string, MapAppearance[]>)
        const reduceAppearances = (defaultAppearances: MapAppearance[]) => (
            defaultAppearances.reduce(componentAppearanceReduce, { name: '', render: [], contents: [] })
        )
        const filterAppearances = ({ name, render = [], contents = [] }) => ({
            ...(name ? { name } : {}),
            ...(render.length ? { render } : {}),
            ...(contents.length ? { contents } : {})
        })

        //
        // TODO: Accumulate running aggregates (by assetId in the sortedImports list) of
        // the following items:
        //    * aggregateNames:  A record keyed by translatedId, with the
        //      current aggregated Names for each item.  Update at each new importAssetId
        //      by mapping and aggregating importMeta[importAssetId]?.defaultNames
        //    * aggregateExits: A list of unique exits, with to and from keyed by translatedId.
        //      Update at each new importAssetId by mapping and aggregating
        //      importMeta[importAssetId]?.defaultExits
        //

        const { aggregatesByAssetId } = (sortedImports
            .reduce((previous, importAssetId) => {
                //
                // TODO:  Fix the assumption that localIdsByNamespaceKey is a one-to-one mapping (either
                // by making translateId more capable, or by validating against many-to-one imports)
                //
                const translateId = (importedId: string): string => {
                    const namespaceKey = importMeta[importAssetId]?.namespaceMap?.[importedId]?.key || `${importAssetId}#${importedId}`
                    if (localIdsByNamespaceKey[namespaceKey]) {
                        return localIdsByNamespaceKey[namespaceKey][0]
                    }
                    return namespaceKey
                }
                const newDefaultNames = Object.entries(importMeta[importAssetId]?.defaultNames || {})
                    .reduce((accumulator, [key, value]) => {
                        const translatedKey = translateId(key)
                        return {
                            ...accumulator,
                            [translatedKey]: [accumulator[translatedKey] || '', value.name || ''].join('')
                        }
                    }, previous.currentNames)
                const newAggregateExits = [
                    ...previous.currentExits,
                    ...(importMeta[importAssetId]?.defaultExits || []).map(({ to, from, ...rest }) => ({
                        to: translateId(to),
                        from: translateId(from),
                        ...rest
                    }))
                ]
                return {
                    aggregatesByAssetId: {
                        ...previous.aggregatesByAssetId,
                        [importAssetId]: {
                            exits: newAggregateExits,
                            names: newDefaultNames
                        }
                    },
                    currentExits: newAggregateExits,
                    currentNames: newDefaultNames
                }

            }, { aggregatesByAssetId: {}, currentExits: [], currentNames: {} } as { aggregatesByAssetId: Record<string, { exits: any[], names: Record<string, string> }>, currentExits: any[], currentNames: Record<string, string> }))

        const { mapAppearances: ancestryDefaultMapAppearances } = sortedImports
            //
            // Reduce maintains two running aggregates:
            //    * mapAppearances:  As currently being aggregated
            //    * aggregateExitsIncluded: A list of the unique exits that have already
            //      been included in previous layers (and therefore do not need to be included
            //      again)
            //
            .reduce((previous, importAssetId) => {
                const itemsForThisAsset = batchGetImports
                    .filter(({ DataCategory }) => (DataCategory === `ASSET#${importAssetId}`))
                    .filter(({ AssetId }) => (splitType(AssetId)[0] === 'MAP'))
                return itemsForThisAsset.reduce((accumulator, { AssetId, defaultAppearances = [] }) => {
                    //
                    // TODO:  Fix the assumption that localIdsByNamespaceKey is a one-to-one mapping (either
                    // by making translateId more capable, or by validating against many-to-one imports)
                    //
                    const translateId = (importedId) => {
                        const namespaceKey = importMeta[importAssetId]?.namespaceMap?.[importedId]?.key || `${importAssetId}#${importedId}`
                        if (localIdsByNamespaceKey[namespaceKey]) {
                            return localIdsByNamespaceKey[namespaceKey][0]
                        }
                        return namespaceKey
                    }
                    const defaultNames = aggregatesByAssetId[importAssetId]?.names || {}
                    const defaultExits = aggregatesByAssetId[importAssetId]?.exits || []
                    const addedRooms = Object.assign({}, ...defaultAppearances.map(({ rooms = {} }: { rooms: Record<string, any>}) => (
                        Object.entries(rooms)
                            .reduce((previous, [key, value]) => ({
                                ...previous,
                                [translateId(key)]: {
                                    ...value,
                                    name: defaultNames[translateId(key)]
                                }
                            }), {} as Record<string, any>)
                    ))) as Record<string, any>
                    const newRooms = Object.assign(accumulator.aggregateRooms, addedRooms) as Record<string, any>
                    const addedExits = defaultExits
                        .filter(({ to, from }) => ((to in newRooms) && (from in newRooms)))
                        .filter(({ to, from }) => (
                            !accumulator.aggregateExitsIncluded.find((check) => (check.to === to && check.from === from))
                        ))
                    const newMapLayer = {
                        //
                        // TODO: Exits should include:
                        //      * Any exit that is new since the last iteration, and which corresponds to
                        //        rooms already in the map
                        //      * Any exit to or from rooms newly added to the map, which corresponds to
                        //        rooms currently in the map
                        //
                        exits: addedExits,
                        rooms: addedRooms
                    }
                    const localIds = localIdsByItemId[AssetId] || []
                    const newMapAppearances = localIds.reduce((innerAccumulator, localId) => ({
                        ...innerAccumulator,
                        [localId]: [
                            ...(innerAccumulator[localId] || []),
                            newMapLayer
                        ]    
                    }), accumulator.mapAppearances)

                    return {
                        mapAppearances: newMapAppearances,
                        aggregateExitsIncluded: [ ...accumulator.aggregateExitsIncluded, ...addedExits ],
                        aggregateRooms: newRooms
                    }
                }, previous)
            }, { mapAppearances: {}, aggregateExitsIncluded: [], aggregateRooms: {} } as { mapAppearances: Record<string, { exits: any[]; rooms: Record<string, any> }[]>; aggregateExitsIncluded: any[]; aggregateRooms: Record<string, any> })
        const lastImportAssetId = sortedImports.length ? sortedImports.slice(-1)[0] : ''
        messageBus.send({
            type: 'ImportDefaults',
            components: Object.assign({},
                objectMap(
                    objectMap(
                        objectMap(
                            ancestryDefaultComponentAppearances,
                            reduceAppearances
                        ),
                        filterAppearances
                    ),
                    ((value) => ({ type: 'Component', ...value }))
                ),
                objectMap(ancestryDefaultMapAppearances, (value) => ({ type: 'Map', layers: value }))
            ) as Record<string, any>,
            aggregateExits: lastImportAssetId ? aggregatesByAssetId[lastImportAssetId]?.exits || [] : [] as any[]
        })
    }))
}

export const importDefaultsMessage = async ({ payloads }: { payloads: ImportDefaultsMessage[], messageBus?: MessageBus }): Promise<void> => {
    const ConnectionId = await internalCache.Global.get('ConnectionId')
    const RequestId = await internalCache.Global.get('RequestId')

    await Promise.all(payloads.map(async (payload) => {
        await apiClient.send({
            ConnectionId,
            Data: JSON.stringify({
                messageType: 'ImportDefaults',
                RequestId,
                importDefaults: payload
            })
        })    
    }))
}

export default fetchImportDefaults
