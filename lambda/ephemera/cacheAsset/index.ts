import {
    isNormalAsset,
    NormalItem,
    isNormalExit,
    isNormalAction,
    isNormalCharacter,
    ComponentRenderItem,
    isNormalRoom,
    isNormalFeature,
    isNormalMap,
    isNormalVariable,
    isNormalComputed,
    isNormalImage,
    NormalReference,
    isNormalCondition,
    isNormalBookmark,
    isNormalMessage,
    isNormalMoment,
    isNormalKnowledge,
    isNormalImport
} from '@tonylb/mtw-normal'
import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index.js'
import {
    EphemeraCharacter,
    EphemeraCondition,
    EphemeraExit,
    EphemeraItem,
    EphemeraItemDependency,
    EphemeraPushArgs
} from './baseClasses'
import { conditionsFromContext } from './utilities'
import { defaultColorFromCharacterId } from '../lib/characterColor'
import { AssetKey, splitType } from '@tonylb/mtw-utilities/dist/types.js'
import { CacheAssetByIdMessage, CacheAssetMessage, CacheCharacterAssetsMessage, MessageBus } from '../messageBus/baseClasses.js'
import { mergeIntoEphemera } from './mergeIntoEphemera'
import { EphemeraAssetId, EphemeraError, isEphemeraActionId, isEphemeraAssetId, isEphemeraBookmarkId, isEphemeraCharacterId, isEphemeraComputedId, isEphemeraFeatureId, isEphemeraKnowledgeId, isEphemeraMapId, isEphemeraMessageId, isEphemeraMomentId, isEphemeraRoomId, isEphemeraVariableId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { TaggedConditionalItemDependency, TaggedMessageContent } from '@tonylb/mtw-interfaces/ts/messages.js'
import internalCache from '../internalCache'
import { CharacterMetaItem } from '../internalCache/characterMeta'
import { unique } from '@tonylb/mtw-utilities/dist/lists.js'
import { ebClient } from '../clients.js'
import { PutEventsCommand } from '@aws-sdk/client-eventbridge'
import ReadOnlyAssetWorkspace, { AssetWorkspaceAddress } from '@tonylb/mtw-asset-workspace/dist/readOnly'
import { graphStorageDB } from '../dependentMessages/graphCache'
import topologicalSort from '@tonylb/mtw-utilities/dist/graphStorage/utils/graph/topologicalSort'
import GraphUpdate from '@tonylb/mtw-utilities/dist/graphStorage/update'

//
// TODO:
//
// Consider how to handle the various cases of change,
// in relation to the characters possibly occupying the rooms
//
// What does it mean when the underlying assets of a room change, in terms
// of notifying people in it?
//

//
// Translates from normal form to a fetch-ready record to be stored in the Ephemera table.
//
const ephemeraTranslateRender = (assetWorkspace: ReadOnlyAssetWorkspace) => (renderItem: ComponentRenderItem): TaggedMessageContent => {
    if (renderItem.tag === 'Link') {
        const to = assetWorkspace.namespaceIdToDB[renderItem.to]
        if (!(to && isEphemeraActionId(to) || isEphemeraCharacterId(to) || isEphemeraFeatureId(to) || isEphemeraKnowledgeId(to))) {
            throw new EphemeraError(`Illegal target in link: ${to}`)
        }
        return {
            ...renderItem,
            to
        }
    }
    else if (renderItem.tag === 'Bookmark') {
        const to = assetWorkspace.namespaceIdToDB[renderItem.to]
        if (!isEphemeraBookmarkId(to)) {
            throw new EphemeraError(`Illegal key in bookmark: ${to}`)
        }
        return {
            ...renderItem,
            to
        }
    }
    else if (renderItem.tag === 'Condition') {
        const mappedConditions = renderItem.conditions.map<EphemeraCondition>((condition) => {
            const dependencies = condition.dependencies.map<TaggedConditionalItemDependency>((depend) => {
                const dependTranslated = assetWorkspace.namespaceIdToDB[depend]
                if (!(dependTranslated && (isEphemeraComputedId(dependTranslated) || isEphemeraVariableId(dependTranslated)))) {
                    throw new EphemeraError(`Illegal dependency in If: ${depend}`)
                }
                return {
                    key: depend,
                    EphemeraId: dependTranslated
                }
            })
            return {
                if: condition.if,
                not: condition.not,
                dependencies
            }
        })
        return {
            ...renderItem,
            conditions: mappedConditions,
            contents: renderItem.contents.map(ephemeraTranslateRender(assetWorkspace))
        }
    }
    else {
        return renderItem as TaggedMessageContent
    }
}

//
// Extract fetch-ready list of exits from EphemeraRoom contents
//
const ephemeraExtractExits = (assetWorkspace: ReadOnlyAssetWorkspace) => (contents: NormalReference[]): EphemeraExit[] => {
    return contents.reduce<EphemeraExit[]>((previous, item) => {
        const itemLookup = assetWorkspace.normal?.[item.key]
        if (itemLookup) {
            if (isNormalExit(itemLookup)) {
                const to = assetWorkspace.namespaceIdToDB[itemLookup.to]
                if (!isEphemeraRoomId(to)) {
                    throw new EphemeraError(`Illegal target in exit: ${to}`)
                }
                return [
                    ...previous,
                    {
                        conditions: [],
                        name: itemLookup.name || '',
                        to
                    }
                ]
            }
            if (isNormalCondition(itemLookup)) {
                const nestedExits = ephemeraExtractExits(assetWorkspace)(itemLookup.appearances[item.index].contents)
                if (nestedExits.length) {
                    const mappedConditions = itemLookup.conditions.map<EphemeraCondition>((condition) => {
                        const dependencies = condition.dependencies.map<EphemeraItemDependency>((depend) => {
                            const dependTranslated = assetWorkspace.namespaceIdToDB[depend]
                            if (!dependTranslated) {
                                throw new EphemeraError(`Illegal dependency in If: ${depend}`)
                            }
                            if (!(isEphemeraComputedId(dependTranslated) || isEphemeraVariableId(dependTranslated))) {
                                throw new EphemeraError(`Illegal dependency in If: ${depend}`)
                            }
                            return {
                                key: depend,
                                EphemeraId: dependTranslated
                            }
                        })
                        return {
                            if: condition.if,
                            not: condition.not,
                            dependencies
                        }
                    })
                    return [
                        ...previous,
                        ...(nestedExits.map((exit) => ({
                            ...exit,
                            conditions: [
                                ...mappedConditions,
                                ...exit.conditions
                            ]
                        })))
                    ]
                }
            }
        }
        return previous
    }, [])
}

const ephemeraItemFromNormal = (assetWorkspace: ReadOnlyAssetWorkspace) => (item: NormalItem): EphemeraItem | undefined => {
    const { namespaceIdToDB: namespaceMap, normal = {}, properties = {} } = assetWorkspace
    const conditionsTransform = conditionsFromContext(assetWorkspace)
    const conditionsRemap = (conditions: { if: string; not?: boolean; dependencies: string[] }[]): EphemeraCondition[] => {
        return conditions.map((condition) => {
            const dependencies = condition.dependencies.reduce<EphemeraCondition["dependencies"]>((previous, key) => {
                const dependencyLookup = assetWorkspace.namespaceIdToDB[key]
                if (!(isEphemeraComputedId(dependencyLookup) || isEphemeraVariableId(dependencyLookup))) {
                    throw new EphemeraError(`Illegal dependency: ${key}`)
                }
                return [
                    ...previous,
                    {
                        key,
                        EphemeraId: dependencyLookup
                    }
                ]
            }, [])
            return {
                if: condition.if,
                not: condition.not,
                dependencies
            }
        })
    }
    const EphemeraId = namespaceMap[item.key]
    if (!EphemeraId) {
        return undefined
    }
    const renderTranslate = ephemeraTranslateRender(assetWorkspace)
    const exitTranslate = ephemeraExtractExits(assetWorkspace)
    if (isEphemeraRoomId(EphemeraId) && isNormalRoom(item)) {
        return {
            key: item.key,
            EphemeraId: EphemeraId,
            appearances: item.appearances
                .map((appearance) => ({
                    conditions: conditionsTransform(appearance.contextStack),
                    name: (appearance.name ?? []).map(renderTranslate),
                    render: (appearance.render || []).map(renderTranslate),
                    exits: exitTranslate(appearance.contents)
                }))
        }
    }
    if (isEphemeraFeatureId(EphemeraId) && isNormalFeature(item)) {
        return {
            key: item.key,
            EphemeraId,
            appearances: item.appearances
                .map((appearance) => ({
                    conditions: conditionsTransform(appearance.contextStack),
                    name: (appearance.name ?? []).map(renderTranslate),
                    render: (appearance.render || []).map(renderTranslate),
                }))
        }
    }
    if (isEphemeraKnowledgeId(EphemeraId) && isNormalKnowledge(item)) {
        return {
            key: item.key,
            EphemeraId,
            appearances: item.appearances
                .map((appearance) => ({
                    conditions: conditionsTransform(appearance.contextStack),
                    name: (appearance.name ?? []).map(renderTranslate),
                    render: (appearance.render || []).map(renderTranslate),
                }))
        }
    }
    if (isEphemeraBookmarkId(EphemeraId) && isNormalBookmark(item)) {
        return {
            key: item.key,
            EphemeraId,
            appearances: item.appearances
                .map((appearance) => ({
                    conditions: conditionsTransform(appearance.contextStack),
                    render: (appearance.render || []).map(renderTranslate),
                }))
        }
    }
    if (isEphemeraMessageId(EphemeraId) && isNormalMessage(item)) {
        return {
            key: item.key,
            EphemeraId,
            appearances: item.appearances
                .map((appearance) => ({
                    conditions: conditionsTransform(appearance.contextStack),
                    render: (appearance.render || []).map(renderTranslate),
                    rooms: (appearance.rooms || []).map(({ key }) => (namespaceMap[key])).filter((value) => (value)).filter(isEphemeraRoomId)
                }))
        }
    }
    if (isEphemeraMomentId(EphemeraId) && isNormalMoment(item)) {
        return {
            key: item.key,
            EphemeraId,
            appearances: item.appearances
                .map((appearance) => ({
                    conditions: conditionsTransform(appearance.contextStack),
                    messages: (appearance.messages || []).map((key) => (namespaceMap[key])).filter((value) => (value)).filter(isEphemeraMessageId)
                }))
        }
    }
    if (isEphemeraMapId(EphemeraId) && isNormalMap(item)) {
        return {
            key: item.key,
            EphemeraId,
            appearances: item.appearances
                .map((appearance) => {
                    const image = appearance.images.length > 0 && normal[appearance.images.slice(-1)[0]]
                    const fileURL = (image && isNormalImage(image) && assetWorkspace.properties[image.key] && assetWorkspace.properties[image.key].fileName) || ''
                    return {
                        conditions: conditionsTransform(appearance.contextStack),
                        name: (appearance.name ?? []).map(renderTranslate),
                        fileURL,
                        rooms: appearance.rooms.map(({ conditions, key,  x, y }) => ({
                            conditions: conditionsRemap(conditions),
                            EphemeraId: namespaceMap[key] || '',
                            x,
                            y
                        }))
                    }
                })
        }
    }
    if (isEphemeraCharacterId(EphemeraId) && isNormalCharacter(item)) {
        const image = item.images.length > 0 && normal[item.images.slice(-1)[0]]
        const fileURL = (image && isNormalImage(image) && assetWorkspace.properties[image.key] && assetWorkspace.properties[image.key].fileName) || ''
        return {
            key: item.key,
            EphemeraId,
            address: assetWorkspace.address,
            Name: item.Name,
            Pronouns: item.Pronouns,
            FirstImpression: item.FirstImpression,
            OneCoolThing: item.OneCoolThing,
            Outfit: item.Outfit,
            assets: item.assets,
            Color: defaultColorFromCharacterId(splitType(EphemeraId)[1]) as any,
            fileURL,
            Connected: false,
            ConnectionIds: [],
            RoomId: 'VORTEX'
        }

    }
    if (isEphemeraActionId(EphemeraId) && isNormalAction(item)) {
        return {
            key: item.key,
            EphemeraId,
            src: item.src
        }    
    }
    if (isEphemeraVariableId(EphemeraId) && isNormalVariable(item)) {
        return {
            key: item.key,
            EphemeraId,
            default: item.default
        }
    }
    if (isEphemeraComputedId(EphemeraId) && isNormalComputed(item)) {
        return {
            key: item.key,
            EphemeraId,
            src: item.src,
            dependencies: item.dependencies
                .map((key) => ({
                    key,
                    EphemeraId: (assetWorkspace.namespaceIdToDB[key] || '')
                }))
        }
    }
    console.log(`WARNING: Unknown combination of types in cacheAsset:  NormalItem with tag '${item.tag}' and Ephemera wrapper: '${splitType(EphemeraId)[0]}'`)
    return undefined
}


export const pushEphemera = async({
    EphemeraId,
    scopeMap = {}
}: EphemeraPushArgs) => {
    await ephemeraDB.putItem({
        EphemeraId,
        DataCategory: 'Meta::Asset',
        scopeMap
    })
}

const pushCharacterEphemeraToInternalCache = async (character: EphemeraCharacter): Promise<CharacterMetaItem | undefined> => {
    const [previous, graph] = await Promise.all([
        internalCache.CharacterMeta.get(character.EphemeraId, { check: true }),
        internalCache.Graph.get((character.assets || []).map(AssetKey), 'back')
    ])
    if (!previous) {
        return undefined
    }
    const sortedAssets = topologicalSort(graph.filter({ keys: character.assets.map(AssetKey) }).reverse()).flat().map((assetId) => (assetId.split('#')?.[1] || '')).filter((value) => (value))
    const updated: CharacterMetaItem = {
        ...previous,
        Pronouns: character.Pronouns,
        Name: character.Name,
        assets: sortedAssets
    }
    internalCache.CharacterMeta.set(updated)
    return updated
}

export const pushCharacterEphemera = async (character: Omit<EphemeraCharacter, 'address' | 'Connected' | 'ConnectionIds'> & { address?: AssetWorkspaceAddress; Connected?: boolean; ConnectionIds?: string[] }, meta?: CharacterMetaItem) => {
    const updateKeys: (keyof EphemeraCharacter)[] = ['address', 'Pronouns', 'FirstImpression', 'OneCoolThing', 'Outfit', 'fileURL', 'Color']
    await ephemeraDB.optimisticUpdate({
        Key: {
            EphemeraId: character.EphemeraId,
            DataCategory: 'Meta::Character'
        },
        updateKeys: [...updateKeys, 'assets', 'Name'],
        updateReducer: (draft) => {
            draft.Name = character.Name
            draft.assets = meta ? meta.assets : character.assets
            updateKeys.forEach((key) => {
                draft[key] = character[key]
            })
        },
    })
}

export const cacheAssetMessage = async ({ payloads, messageBus }: { payloads: CacheAssetMessage[], messageBus: MessageBus }): Promise<void> => {
    //
    // To avoid race conditions, Cache payloads are currently evaluated sequentially
    //
    for (const { address, options } of payloads) {
        const { check = false, updateOnly = false } = options

        const assetWorkspace = new ReadOnlyAssetWorkspace(address)
        await assetWorkspace.loadJSON()
        //
        // Process file if an Asset
        //
        const assetItem = Object.values(assetWorkspace.normal || {}).find(isNormalAsset)
        if (assetItem) {
            if (check || updateOnly) {
                const assetEphemeraId = assetWorkspace.namespaceIdToDB[assetItem.key] || `ASSET#${assetItem.key}`
                if (!(assetEphemeraId && isEphemeraAssetId(assetEphemeraId))) {
                    continue
                }
                const { EphemeraId = null } = await internalCache.AssetMeta.get(assetEphemeraId) || {}
                if ((check && Boolean(EphemeraId)) || (updateOnly && !Boolean(EphemeraId))) {
                    continue
                }
            }
        
            //
            // Instanced stories are not directly cached, they are instantiated ... so
            // this would be a miscall, and should be ignored.
            //
            if (assetItem.instance) {
                continue
            }
            const assetId = assetItem.key
        
            const ephemeraExtractor = ephemeraItemFromNormal(assetWorkspace)
            const ephemeraItems: EphemeraItem[] = Object.values(assetWorkspace.normal || {})
                .map(ephemeraExtractor)
                .filter((value: EphemeraItem | undefined): value is EphemeraItem => (Boolean(value)))
        
            const graphUpdate = new GraphUpdate({ internalCache: internalCache._graphCache, dbHandler: graphStorageDB })

            await mergeIntoEphemera(assetId, ephemeraItems, graphUpdate)

            graphUpdate.setEdges([{
                itemId: AssetKey(assetItem.key),
                edges: Object.values(assetWorkspace.normal || {})
                    .filter(isNormalImport)
                    .map(({ from }) => ({ target: AssetKey(from), context: '' })),
                options: { direction: 'back' }
            }])

            await Promise.all([
                graphUpdate.flush(),
                pushEphemera({
                    EphemeraId: AssetKey(assetItem.key),
                    scopeMap: assetWorkspace.namespaceIdToDB
                })
            ])

            //
            // Use MessageBus to queue RoomHeader messages for any room that has a person to
            // report to
            //
            // TODO: Optimize RoomHeader messages to only deliver to characters who have
            // the asset that is being cached
            //
            Object.values(assetWorkspace.normal || {})
                .filter(isNormalRoom)
                .map(({ key }) => (assetWorkspace.namespaceIdToDB[key]))
                .filter((value) => (value))
                .filter(isEphemeraRoomId)
                .forEach((roomId) => {
                    messageBus.send({
                        type: 'Perception',
                        ephemeraId: roomId,
                        header: true
                    })
                })
        }

        //
        // Process file if a Character
        //
        const characterItem = Object.values(assetWorkspace.normal || {}).find(isNormalCharacter)
        if (characterItem) {
            const ephemeraItem = ephemeraItemFromNormal(assetWorkspace)(characterItem)
            if (ephemeraItem) {
                const characterEphemeraId = assetWorkspace.namespaceIdToDB[ephemeraItem.key] || ''
                if (!(characterEphemeraId && isEphemeraCharacterId(characterEphemeraId))) {
                    continue
                }
                const ephemeraToCache = await pushCharacterEphemeraToInternalCache(ephemeraItem as EphemeraCharacter)
                if (check || updateOnly) {
                    const { EphemeraId = null, RoomId = 'ROOM#VORTEX' } = ephemeraToCache || {}
                    if ((check && Boolean(EphemeraId)) || (updateOnly && !Boolean(EphemeraId))) {
                        continue
                    }
                    if (updateOnly) {
                        const { assets = {} } = await internalCache.ComponentRender.get(characterEphemeraId, RoomId)
                        if (Object.values(assets).length) {
                            messageBus.send({
                                type: 'Perception',
                                ephemeraId: RoomId,
                                characterId: characterEphemeraId,
                                header: true
                            })
                        }
                    }
                }
                const [characterConnections] = await Promise.all([
                    internalCache.CharacterConnections.get(characterEphemeraId),
                    pushCharacterEphemera(ephemeraItem as EphemeraCharacter, ephemeraToCache)
                ])
                if (characterConnections && characterConnections.length) {
                    messageBus.send({
                        type: 'CacheCharacterAssets',
                        characterId: characterEphemeraId
                    })
                    messageBus.send({
                        type: 'CheckLocation',
                        characterId: characterEphemeraId,
                        arriveMessage: ` has returned from visiting in a temporary space.`,
                        leaveMessage: ` has lost access to this space, and been removed.`
                    })
                }
            }
        }
    }

}

export const cacheAssetByIdMessage = async ({ payloads, messageBus }: { payloads: CacheAssetByIdMessage[], messageBus: MessageBus }): Promise<void> => {
    const assetsNeedingCache = await Promise.all(
        (unique(payloads.map(({ assetId }) => (assetId))) as EphemeraAssetId[])
            .filter(async (assetId: EphemeraAssetId) => (Boolean(await internalCache.AssetMeta.get(assetId))))
    )
    await ebClient.send(new PutEventsCommand({
        Entries: assetsNeedingCache.map((assetId) => ({
            EventBusName: process.env.EVENT_BUS_NAME,
            Source: 'mtw.coordination',
            DetailType: 'Cache Asset By Id',
            Detail: JSON.stringify({ assetId })
        }))
    }))
}

export const cacheCharacterAssetsMessage = async ({ payloads, messageBus }: { payloads: CacheCharacterAssetsMessage[], messageBus: MessageBus }): Promise<void> => {
    const assetsNeedingCache = (await Promise.all(
        payloads.map(async ({ characterId }) => {
            const { assets } = await internalCache.CharacterMeta.get(characterId)
            return assets.map(AssetKey)
        }))
    ).flat()
    assetsNeedingCache.forEach((assetId) => {
        messageBus.send({
            type: 'CacheAssetById',
            assetId
        })    
    })
}
