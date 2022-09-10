//
// This file has utilities for merging a new list of EphemeraItems into the current database, updating
// both the per-Asset entries and (if necessary) the Meta::<Component> aggregate entries
//
import { ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB"
import { AssetKey, splitType } from "@tonylb/mtw-utilities/dist/types";
import { EphemeraItem } from "./baseClasses";

type ActiveCharacterOutput = {
    EphemeraId: string;
    RoomId: string;
    Name: string;
    ConnectionId: string;
}

export const getAllActiveCharacters = async (): Promise<ActiveCharacterOutput[]> => {
    const charactersInPlay: ActiveCharacterOutput[] = (await ephemeraDB.query({
        IndexName: 'DataCategoryIndex',
        DataCategory: 'Meta::Character',
        ExpressionAttributeNames: {
            "#name": "Name"
        },
        ExpressionAttributeValues: {
            ':true': true
        },
        ProjectionFields: ['EphemeraId', 'RoomId', '#name', 'Connected', 'ConnectionId']
    })).filter(({ Connected }) => (Connected))
        .map(({ EphemeraId, RoomId, Name, ConnectionId }) => ({ EphemeraId, RoomId, Name, ConnectionId }))

    return charactersInPlay
}

let activeCharacterPromise: Promise<ActiveCharacterOutput[]> | undefined

const initializeComponent = async (EphemeraId: string): Promise<Record<string, any>> => {
    const [componentType, componentId] = splitType(EphemeraId)
    if (componentType === 'ROOM') {
        if (!activeCharacterPromise) {
            activeCharacterPromise = getAllActiveCharacters()
        }
        const allActiveCharacters = await activeCharacterPromise
        return {
            activeCharacters: allActiveCharacters
                .filter(({ RoomId }) => (RoomId === componentId))
                .map(({ EphemeraId, Name, ConnectionId }) => ({ EphemeraId, Name, ConnectionId }))
        }
    }
    else {
        return {}
    }
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
                return ephemeraDB.addPerAsset({ DataCategory, ...items.incoming }, initializeComponent)
            }
            else {
                return undefined
            }
        })
        .filter((value) => (value))

    await Promise.all(thirdPassMerging)

}