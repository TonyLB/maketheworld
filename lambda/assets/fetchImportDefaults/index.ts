import { FetchImportDefaultsMessage, FetchImportsMessage, MessageBus } from "../messageBus/baseClasses"

import internalCache from '../internalCache'
import { AssetClientImportDefaults, AssetClientImportDefaultsFeature, AssetClientImportDefaultsRoom } from "@tonylb/mtw-interfaces/dist/asset"
import { apiClient } from "@tonylb/mtw-utilities/dist/apiManagement/apiManagementClient"
import { isNormalExit, isNormalFeature, isNormalImport, isNormalRoom, NormalItem } from "@tonylb/mtw-wml/dist/normalize/baseClasses"
import { unique } from "@tonylb/mtw-utilities/dist/lists"
import { RoomExit } from "@tonylb/mtw-interfaces/dist/messages"
import { isEphemeraRoomId } from "@tonylb/mtw-interfaces/dist/baseClasses"
import { assetWorkspaceFromAssetId } from "../utilities/assets"
import { SelectObjectContentCommand } from "@aws-sdk/client-s3"
import { convertSelectDataToJson } from "../utilities/stream"

const { S3_BUCKET } = process.env

type AssetKey = `ASSET#${string}`

type PayloadDefaultOutput = {
    assetId: AssetKey;
    defaultsByKey: AssetClientImportDefaults["defaultsByKey"]
}

const recursivePayloadDefault = async (payload: FetchImportDefaultsMessage): Promise<PayloadDefaultOutput> => {
    const jsonFile = await internalCache.JSONFile.get(payload.assetId)

    //
    // Check for any imports of relevant keys, and recurse as needed
    //
    const neededImports = payload.keys.reduce<{ assetId: AssetKey; key: string }[]>((previous, key) => {
        const importContext = (jsonFile.normal[key].appearances || [])
            .reduce<{ assetId: AssetKey; key: string } | undefined>((previous, { contextStack }) => (
                contextStack
                    .reduce<{ assetId: AssetKey; key: string } | undefined>((accumulator, reference) => {
                        if (reference.tag === 'Import') {
                            const importItem = jsonFile.normal[reference.key]
                            if (!(importItem && isNormalImport(importItem))) {
                                throw new Error(`Mismatched normal reference`)
                            }
                            return {
                                assetId: `ASSET#${importItem.from}`,
                                key: importItem.mapping[key].key
                            }
                        }
                        return accumulator
                    }, previous)), undefined)
        if (importContext) {
            return [
                ...previous,
                importContext
            ]
        }
        return previous
    }, [])
    const recursiveCalls = neededImports.reduce<Record<`ASSET#${string}`, FetchImportDefaultsMessage>>((previous, { assetId, key }) => ({
            ...previous,
            [assetId]: {
                type: 'FetchImportDefaults',
                assetId,
                keys: unique(previous[assetId] || [], [key])
            }
        }), {})
    const inheritedDefaults = Object.assign(
        {} as Record<AssetKey, PayloadDefaultOutput>, 
        ...(await Promise.all(Object.values(recursiveCalls).map(recursivePayloadDefault))
            .then((returnItems) => (returnItems.map(({ assetId, defaultsByKey }) => ({ [assetId]: { assetId, defaultsByKey } }))))
        )) as Record<AssetKey, PayloadDefaultOutput>

    //
    // Gather all defaults from item appearances with no conditions in their context stack, and add them to the inherited defaults
    //
    const defaultsByKey = payload.keys.reduce<Record<string, AssetClientImportDefaultsRoom | AssetClientImportDefaultsFeature>>((previous, key) => {
        const item = jsonFile.normal[key]
        if (isNormalRoom(item)) {
            const inheritedDefault = inheritedDefaults[key]
            const startingPoint: AssetClientImportDefaultsRoom = inheritedDefault.tag === 'Room' ? inheritedDefault : {
                tag: 'Room',
                Description: [],
                Name: [],
                Exits: []
            }
            const defaultItem = item.appearances
                .filter(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'If'))))
                .reduce<AssetClientImportDefaultsRoom>((accumulator, appearance) => {
                    const exits = appearance.contents
                        .filter(({ tag }) => (tag === 'Exit'))
                        .map((exit) => {
                            const exitItem = jsonFile[exit.key]
                            if (!isNormalExit(exitItem)) {
                                return undefined
                            }
                            const RoomId = jsonFile.namespaceIdToDB[key]
                            if (!isEphemeraRoomId(RoomId)) {
                                return undefined
                            }
                            return {
                                Name: exitItem.name,
                                RoomId,
                                Visibility: 'Public'
                            }
                        })
                        .filter((value): value is RoomExit => (Boolean(value)))
                    return {
                        tag: 'Room',
                        Description: [
                            ...(accumulator[key].Description || []),
                            ...(appearance.render || [])
                        ],
                        Name: [
                            ...(accumulator[key].Name || []),
                            ...(appearance.name || [])
                        ],
                        Exits: [
                            ...(accumulator[key].Exits || []),
                            ...((exits || []))
                        ]
                    }
                }, startingPoint)
            return {
                ...previous,
                [key]: defaultItem
            }
        }
        if (isNormalFeature(item)) {
            const inheritedDefault = inheritedDefaults[key]
            const startingPoint: AssetClientImportDefaultsFeature = inheritedDefault.tag === 'Feature' ? inheritedDefault : {
                tag: 'Feature',
                Description: [],
                Name: []
            }
            const defaultItem = item.appearances
                .filter(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'If'))))
                .reduce<AssetClientImportDefaultsFeature>((accumulator, appearance) => {
                    return {
                        tag: 'Feature',
                        Description: [
                            ...(accumulator[key].Description || []),
                            ...(appearance.render || [])
                        ],
                        Name: [
                            ...(accumulator[key].Name || []),
                            ...(appearance.name || [])
                        ]
                    }
                }, startingPoint)
            return {
                ...previous,
                [key]: defaultItem
            }
        }
        return previous
    }, {})

    return {
        assetId: payload.assetId,
        defaultsByKey
    }
}

export const fetchImportDefaultsMessage = async ({ payloads, messageBus }: { payloads: FetchImportDefaultsMessage[], messageBus: MessageBus }): Promise<void> => {
    const [ConnectionId, RequestId] = await Promise.all([
        internalCache.Connection.get("connectionId"),
        internalCache.Connection.get("RequestId")
    ])
    await Promise.all(
        payloads
            .map(async (payload) => {
                const defaultsByKey = await recursivePayloadDefault(payload)
                await apiClient.send({
                    ConnectionId,
                    Data: JSON.stringify({
                        RequestId,
                        messageType: 'ImportDefaults',
                        assetId: payload.assetId,
                        defaultsByKey
                    })
                })
            })
    )
}

type RecursiveFetchImportArgument = {
    assetId: `ASSET#${string}`;
    keys: string[];
    stubKeys: string[];
}

export const recursiveFetchImports = async ({ payload, messageBus }: { payload: Record<AssetKey, RecursiveFetchImportArgument>, messageBus: MessageBus }): Promise<void> => {
    const fetches = Object.values(payload).map(async ({ assetId, keys, stubKeys }): Promise<Record<string, NormalItem>> => {
        const { normal } = await internalCache.JSONFile.get(assetId)

        return {}
    //
    // TODO: Parse items to determine whether the keys require any stubs not yet present
    //

    //
    // TODO: Recurse to fetch stubs that are required but have not yet been fetched, either
    // those passed as stubKeys, or those added to the necessary stubs by parsing of keys
    //

    //
    // TODO: Once stubs are fetched, you know all further imports that are necessary. Recurse
    // to fetch those as well
    //
    })

}

export const fetchImportsMessage = async ({ payloads, messageBus }: { payloads: FetchImportsMessage[], messageBus: MessageBus }): Promise<void> => {
    const [ConnectionId, RequestId] = await Promise.all([
        internalCache.Connection.get("connectionId"),
        internalCache.Connection.get("RequestId")
    ])
    // await Promise.all(
    //     payloads
    //         .map(async (payload) => {
    //             const defaultsByKey = await recursivePayloadDefault(payload)
    //             await apiClient.send({
    //                 ConnectionId,
    //                 Data: JSON.stringify({
    //                     RequestId,
    //                     messageType: 'ImportDefaults',
    //                     assetId: payload.assetId,
    //                     defaultsByKey
    //                 })
    //             })
    //         })
    // )
}

export default fetchImportDefaultsMessage
