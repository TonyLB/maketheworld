//
// This file has utilities for merging a new list of EphemeraItems into the current database, updating
// both the per-Asset entries and (if necessary) the Meta::<Component> aggregate entries
//
import { isEphemeraActionId, isEphemeraComputedId, isEphemeraRoomId, isEphemeraVariableId } from "@tonylb/mtw-interfaces/dist/baseClasses"
import evaluateCode from "@tonylb/mtw-utilities/dist/computation/sandbox"
import { connectionDB, ephemeraDB, nonLegacyEphemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB"
import { unique } from "@tonylb/mtw-utilities/dist/lists"
import { AssetKey, splitType } from "@tonylb/mtw-utilities/dist/types"
import { WritableDraft } from "immer/dist/internal"
import internalCache from "../internalCache"
import { DependencyNode, RoomCharacterListItem } from "../internalCache/baseClasses"
import messageBus from "../messageBus"
import { EphemeraItem } from "./baseClasses"

type ActiveCharacterOutput = {
    EphemeraId: string;
    RoomId: string;
    Name: string;
    ConnectionIds: string[];
}

export const getAllActiveCharacters = async (): Promise<ActiveCharacterOutput[]> => {
    const connectedCharacters = await connectionDB.query<{ ConnectionId: string; connections: string[] }[]>({
        IndexName: 'DataCategoryIndex',
        DataCategory: 'Meta::Character',
        ProjectionFields: ['ConnectionId']
    })
    const connectionsByCharacterId = connectedCharacters.reduce<Record<string, string[]>>((previous, { ConnectionId, connections }) => ({ ...previous, [ConnectionId]: connections }), {})
    const characterMetaFetch = await ephemeraDB.batchGetItem<ActiveCharacterOutput>({
        Items: connectedCharacters.map(({ ConnectionId: EphemeraId }) => ({ EphemeraId, DataCategory: 'Meta::Character' })),
        ExpressionAttributeNames: {
            "#name": "Name"
        },
        ProjectionFields: ['EphemeraId', 'RoomId', '#name']
    })
    const charactersInPlay: ActiveCharacterOutput[] = characterMetaFetch
        .map(({ EphemeraId, RoomId, Name }) => ({ EphemeraId, RoomId, Name, ConnectionIds: connectionsByCharacterId[EphemeraId] || [] }))
        .filter(({ ConnectionIds }) => (ConnectionIds.length > 0))

    return charactersInPlay
}

let activeCharacterPromise: Promise<ActiveCharacterOutput[]> | undefined

type ActiveCharacterItem = {
    EphemeraId: string;
    Name: string;
    ConnectionIds: string[];
}

type MetaFetchOutput = {
    activeCharacters?: ActiveCharacterItem[];
}

const initializeComponent = async ({ item: { EphemeraId }, meta }: { item: { EphemeraId: string }, meta?: { cached: string[], activeCharacters?: any } }): Promise<MetaFetchOutput> => {
    const [componentType, componentId] = splitType(EphemeraId)
    if (componentType === 'ROOM' && !Object.values(meta?.activeCharacters || {}).length) {
        if (!activeCharacterPromise) {
            activeCharacterPromise = getAllActiveCharacters()
        }
        const allActiveCharacters = await activeCharacterPromise
        return {
            activeCharacters: allActiveCharacters
                .filter(({ RoomId }) => (RoomId === componentId))
                .map(({ EphemeraId, Name, ConnectionIds }) => ({ EphemeraId, Name, ConnectionIds }))
        }
    }
    // else if (componentType === 'Room' && ) {
        
    // }
    else {
        return {}
    }
}

type EphemeraAssetMeta = {
    cached: string[];
    activeCharacters?: ActiveCharacterItem[];
    src?: string;
    rootAsset?: string;
    value?: any;
    Descent?: DependencyNode[];
}

export const mergeIntoEphemera = async (assetId: string, items: EphemeraItem[]): Promise<void> => {
    //
    // TODO:  Better error handling and validation throughout
    //
    const DataCategory = AssetKey(assetId)
    await nonLegacyEphemeraDB.mergeTransact({
        query: {
            IndexName: 'DataCategoryIndex',
            Key: { DataCategory }
        },
        items: items as any,
        mergeFunction: ({ incoming }) => (incoming),
        transactFactory: async ({ key, action }) => {
            const [ephemeraTag] = splitType(key.EphemeraId)
            const [_, assetKey] = splitType(key.DataCategory)
            const tag = `${ephemeraTag[0].toUpperCase()}${ephemeraTag.slice(1).toLowerCase()}`
            if (action === 'delete') {
                return [{ Update: {
                    Key: { EphemeraId: key, DataCategory: `Meta::${tag}` } as any,
                    updateKeys: ['cached'],
                    updateReducer: (draft) => {
                        draft.cached = (draft.cached || []).filter((value) => (value !== assetKey))
                    }
                }}]
            }
            if (typeof action === 'object') {
                const ephemeraId = action.EphemeraId
                let activeCharacters: RoomCharacterListItem[] | undefined = undefined
                if (isEphemeraRoomId(ephemeraId)) {
                    activeCharacters = await internalCache.RoomCharacterList.get(ephemeraId)
                }
                if (isEphemeraComputedId(ephemeraId) && action.src) {
                    messageBus.send({
                        type: 'DependencyCascade',
                        targetId: ephemeraId
                    })
                }
                return [{ Update: {
                    Key: { EphemeraId: key, DataCategory: `Meta::${tag}` } as any,
                    updateKeys: ['cached', 'activeCharacters', 'src', 'rootAsset', 'value'],
                    updateReducer: (draft) => {
                        draft.cached = unique(draft.cached || [], [assetKey])
                        draft.activeCharacters = activeCharacters
                        draft.src = action.src
                        draft.rootAsset = assetId
                        if (isEphemeraVariableId(ephemeraId) && action.default) {
                            if (typeof draft.value === 'undefined') {
                                draft.value = evaluateCode(`return (${action.default})`)({})
                                internalCache.AssetState.set(ephemeraId, draft.value)
                            }
                        }
                    }
                }}]
            }
            return []
        }
    })
    // const currentItems = (await ephemeraDB.query({ IndexName: 'DataCategoryIndex', DataCategory })) || []
    // //
    // // Refactor using lists and .find rather than the confusing map implementation
    // //
    // const firstPassMerging = currentItems.reduce((previous, { DataCategory, ...item }) => ({
    //         ...previous,
    //         [item.EphemeraId]: { current: item }
    //     }), {})
    // const secondPassMerging = items.reduce((previous, item) => {
    //     const key = item.EphemeraId
    //     return {
    //         ...previous,
    //         [key]: {
    //             ...(previous[key] || {}),
    //             incoming: item
    //         }
    //     }
    // }, firstPassMerging)
    // const thirdPassMerging = Object.entries(secondPassMerging)
    //     .map(([key, items]) => {
    //         if (items.current && !items.incoming) {
    //             return ephemeraDB.removePerAsset({ EphemeraId: key, DataCategory })
    //         }
    //         if (!items.current || (JSON.stringify(items.current) !== JSON.stringify(items.incoming))) {
    //             //
    //             // TODO: Deprecate addPerAsset
    //             //

    //             //
    //             // TODO: For each incoming item, create a two-element transaction:
    //             //    * Put the Meta::<AssetId> asset detail record
    //             //    * Update the Meta::<Component> component overview record
    //             //

    //             //
    //             // TODO: Wrap in exponentialBackoffWrapper
    //             //
    //             return ephemeraDB.addPerAsset({
    //                 fetchArgs: initializeComponent,
    //                 updateKeys: ['cached', 'activeCharacters', 'src', 'rootAsset', '#value'],
    //                 ExpressionAttributeNames: {
    //                     '#value': 'value'
    //                 },
    //                 reduceMetaData: ({ item, fetchedArgs }) => (draft: WritableDraft<EphemeraAssetMeta>) => {
    //                     if (!draft.cached) {
    //                         draft.cached = []
    //                     }
    //                     if (!(draft.cached.includes(assetId))) {
    //                         draft.cached = unique(draft.cached, [assetId]) as string[]
    //                     }
    //                     if (fetchedArgs?.activeCharacters) {
    //                         draft.activeCharacters = fetchedArgs.activeCharacters
    //                     }
    //                     const ephemeraId = item.EphemeraId
    //                     if ((isEphemeraComputedId(ephemeraId) || isEphemeraActionId(ephemeraId)) && item.src) {
    //                         draft.src = item.src
    //                         draft.rootAsset = assetId
    //                         if (isEphemeraComputedId(ephemeraId)) {
    //                             messageBus.send({
    //                                 type: 'DependencyCascade',
    //                                 targetId: ephemeraId
    //                             })
    //                         }
    //                     }
    //                     if (isEphemeraVariableId(ephemeraId) && item.default) {
    //                         if ((typeof draft.value === 'undefined') && item.default) {
    //                             draft.value = evaluateCode(`return (${item.default})`)({})
    //                             internalCache.AssetState.set(ephemeraId, draft.value)
    //                         }
    //                     }
    //                 }
    //             })({ DataCategory, ...items.incoming })
    //         }
    //         else {
    //             return undefined
    //         }
    //     })
    //     .filter((value) => (value))

    // await Promise.all(thirdPassMerging)

}