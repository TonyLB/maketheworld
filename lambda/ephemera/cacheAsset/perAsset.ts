//
// This file has utilities for merging a new list of EphemeraItems into the current database, updating
// both the per-Asset entries and (if necessary) the Meta::<Component> aggregate entries
//
import evaluateCode from "@tonylb/mtw-utilities/dist/computation/sandbox";
import { connectionDB, ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB"
import { AssetKey, splitType } from "@tonylb/mtw-utilities/dist/types";
import { WritableDraft } from "immer/dist/internal";
import { EphemeraItem } from "./baseClasses";

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
}

export const mergeIntoEphemera = async (assetId: string, items: EphemeraItem[]): Promise<void> => {
    //
    // TODO:  Better error handling and validation throughout
    //
    const DataCategory = AssetKey(assetId)
    const currentItems = (await ephemeraDB.query({ IndexName: 'DataCategoryIndex', DataCategory })) || []
    const firstPassMerging = currentItems.reduce((previous, { DataCategory, ...item }) => ({
            ...previous,
            [item.EphemeraId]: { current: item }
        }), {})
    const secondPassMerging = items.reduce((previous, item) => {
        const key = item.EphemeraId
        return {
            ...previous,
            [key]: {
                ...(previous[key] || {}),
                incoming: item
            }
        }
    }, firstPassMerging)
    const thirdPassMerging = Object.entries(secondPassMerging)
        .map(([key, items]) => {
            if (items.current && !items.incoming) {
                return ephemeraDB.removePerAsset({ EphemeraId: key, DataCategory })
            }
            if (!items.current || (JSON.stringify(items.current) !== JSON.stringify(items.incoming))) {
                return ephemeraDB.addPerAsset({
                    fetchArgs: initializeComponent,
                    updateKeys: ['cached', 'activeCharacters', 'src', 'rootAsset', '#value'],
                    ExpressionAttributeNames: {
                        '#value': 'value'
                    },
                    reduceMetaData: ({ item, fetchedArgs }) => (draft: WritableDraft<EphemeraAssetMeta>) => {
                        if (!draft.cached) {
                            draft.cached = []
                        }
                        if (!(assetId in draft.cached)) {
                            draft.cached.push(assetId)
                        }
                        if (fetchedArgs?.activeCharacters) {
                            draft.activeCharacters = fetchedArgs.activeCharacters
                        }
                        if (item.tag === 'Action' && item.src) {
                            draft.src = item.src
                            draft.rootAsset = assetId
                        }
                        if (item.tag === 'Variable' && item.default) {
                            if ((typeof draft.value === 'undefined') && item.default) {
                                draft.value = evaluateCode(`return (${item.default})`)({})
                            }
                        }
                    }
                })({ DataCategory, ...items.incoming })
            }
            else {
                return undefined
            }
        })
        .filter((value) => (value))

    await Promise.all(thirdPassMerging)

}