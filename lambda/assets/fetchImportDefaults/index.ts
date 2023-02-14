import { FetchImportDefaultsMessage, FetchImportsMessage, MessageBus } from "../messageBus/baseClasses"

import internalCache from '../internalCache'
import { AssetClientImportDefaults, AssetClientImportDefaultsFeature, AssetClientImportDefaultsRoom } from "@tonylb/mtw-interfaces/dist/asset"
import { apiClient } from "@tonylb/mtw-utilities/dist/apiManagement/apiManagementClient"
import { ComponentRenderItem, isNormalExit, isNormalFeature, isNormalImport, isNormalRoom, NormalComponent, NormalItem } from "@tonylb/mtw-wml/dist/normalize/baseClasses"
import { unique } from "@tonylb/mtw-utilities/dist/lists"
import { RoomExit } from "@tonylb/mtw-interfaces/dist/messages"
import { isEphemeraRoomId } from "@tonylb/mtw-interfaces/dist/baseClasses"
import { assetWorkspaceFromAssetId } from "../utilities/assets"
import { SelectObjectContentCommand } from "@aws-sdk/client-s3"
import { convertSelectDataToJson } from "../utilities/stream"
import AssetWorkspace from "@tonylb/mtw-asset-workspace"
import { SchemaTag } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { splitType } from "@tonylb/mtw-utilities/dist/types"
import { componentRenderToSchemaTaggedMessage } from "@tonylb/mtw-wml/dist/normalize"

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

type RecursiveFetchSelectReturnKeyItem = {
    key: string; tag: 'Room' | 'Feature';
    name: ComponentRenderItem[];
    render: ComponentRenderItem[];
}

type RecursiveFetchSelectReturnStubItem = {
    key: string; tag: 'Room' | 'Feature';
    name: ComponentRenderItem[];
    render: null;
}

type RecursiveFetchSelectReturnExitItem = {
    key: string;
    tag: 'Exit';
    exitName: string;
}

type RecursiveFetchSelectReturn = RecursiveFetchSelectReturnKeyItem | RecursiveFetchSelectReturnStubItem | RecursiveFetchSelectReturnExitItem

const isRecursiveFetchSelectReturnKeyItem = (value: RecursiveFetchSelectReturn): value is RecursiveFetchSelectReturnKeyItem => {
    if (value.tag === 'Room' || value.tag === 'Feature') {
        if (Array.isArray(value.render)) {
            return true
        }
    }
    return false
}

const isRecursiveFetchSelectReturnStubItem = (value: RecursiveFetchSelectReturn): value is RecursiveFetchSelectReturnStubItem => {
    if (value.tag === 'Room' || value.tag === 'Feature') {
        if (!Array.isArray(value.render)) {
            return true
        }
    }
    return false
}

const isRecursiveFetchSelectReturnExitItem = (value: RecursiveFetchSelectReturn): value is RecursiveFetchSelectReturnExitItem => (value.tag === 'Exit')

export const recursiveFetchImports = async ({ payload, messageBus }: { payload: Record<AssetKey, RecursiveFetchImportArgument>, messageBus: MessageBus }): Promise<void> => {

    //
    // TODO:  ABORT!  ABORT!  Using S3Select for data as intricately interwoven as the NormalForm files is an exercise in frustration
    // and inefficiency.  Until and unless I can think of a cleaner way to represent the data that would allow for easy
    // disentangling of a specific subsection of the NormalForm to deliver, return to the original plan of pulling the JSON file
    // from the internalCache and applying `normalSubset` to the (now guaranteed standardized) file format to pull out the
    // relevant data.
    //

    const s3Client = await internalCache.Connection.get('s3Client')
    if (!s3Client) {
        return
    }
    const fetches = Object.assign({}, ...Object.values(payload).map(async ({ assetId, keys, stubKeys }): Promise<Record<string, SchemaTag[]>> => {
        const assetWorkspace = await assetWorkspaceFromAssetId(assetId)
        if (!assetWorkspace) {
            return { [assetId]: [] }
        }
        const keysExpression = `(${keys.map((key) => (`'${key}'`)).join(',')})`
        const selectExpression = `SELECT
                _1."key", _1.tag, _1.name as exitName, _1.appearances[0].name,
                CASE _1."key" IN ${keysExpression} WHEN true THEN _1.appearances[0].render END as render,
                CASE (_1."key" IN ${keysExpression}) AND (_1.tag = 'Room') WHEN true THEN _1.appearances[0].contents END as contents
            FROM s3Object[*].normal.*
            WHERE
                (_1."key" IN ${keysExpression}) OR
                (_1.tag  = 'Room') OR
                ((_1.tag = 'Exit') AND (_1."from" IN ${keysExpression} OR _1."to" in ${keysExpression}))`
        const params = {
            Bucket: S3_BUCKET,
            Key: `${assetWorkspace.fileNameBase}.json`,
            ExpressionType: 'SQL',
            Expression: selectExpression,
            InputSerialization: {
                JSON: { Type: 'Document' }
            },
            OutputSerialization: {
                JSON: { RecordDelimiter: ',' }
            }
        }
        const s3SelectResponse = await s3Client.send(new SelectObjectContentCommand(params))
        //
        // TODO: Better error handling
        //
        if (s3SelectResponse.$metadata.httpStatusCode === 200 && s3SelectResponse.Payload) {
            const convertedData = (await convertSelectDataToJson(s3SelectResponse.Payload)) as RecursiveFetchSelectReturn[]
            const importItemByKey = convertedData.reduce<Record<string, RecursiveFetchSelectReturn>>((previous, item) => ({
                ...previous,
                [item.key]: item
            }), {})
            const keyImportItems = keys.map((key) => (importItemByKey[key])).filter(isRecursiveFetchSelectReturnKeyItem)
            //
            // TODO: Create a recursive tree-walker to pull out all conditional keys from the key item contents.
            //
            const exitItems = Object.values(importItemByKey)
                .filter(isRecursiveFetchSelectReturnExitItem)
                .map(({ key, exitName }) => {
                    const [from, to] = splitType(key)
                    return {
                        key,
                        from,
                        to,
                        name: exitName
                    }
                })
            const exitStubs = [
                    ...exitItems.map(({ to }) => (to)),
                    ...exitItems.map(({ from }) => (from)),
                ]
            const allStubs = (unique(stubKeys, exitStubs) as string[]).filter((value) => (!keys.includes(value)))
            //
            // TODO: Use the list of allStubs and allIfs to run a second Select through the S3 file to get
            // information needed to support the key elements.
            //
            const schemaTags: SchemaTag[] = [
                ...keyImportItems.map(({ key, name, render }): SchemaTag => ({
                    tag: 'Room',
                    key,
                    name: name.map(componentRenderToSchemaTaggedMessage),
                    render: render.map(componentRenderToSchemaTaggedMessage),
                    global: false,
                    contents: []
                })),
                ...allStubs.map((key): SchemaTag => {
                    
                })
            ]

            return {}
        }
        else {
            return { [assetId]: [] }
        }
    
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
