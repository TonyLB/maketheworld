import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB/index'
import {
    EphemeraCharacter,
    EphemeraItem,
    EphemeraPushArgs
} from './baseClasses'
import { defaultColorFromCharacterId } from '../lib/characterColor'
import { AssetKey, splitType } from '@tonylb/mtw-utilities/ts/types'
import { MessageBus } from '../messageBus/baseClasses'
import { mergeIntoEphemera } from './mergeIntoEphemera'
import {
    EphemeraAssetId,
    EphemeraCharacterId,
    EphemeraId,
    isEphemeraActionId,
    isEphemeraAssetId,
    isEphemeraBookmarkId,
    isEphemeraCharacterId,
    isEphemeraComputedId,
    isEphemeraFeatureId,
    isEphemeraId,
    isEphemeraImageId,
    isEphemeraKnowledgeId,
    isEphemeraMapId,
    isEphemeraMessageId,
    isEphemeraMomentId,
    isEphemeraRoomId,
    isEphemeraVariableId
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../internalCache'
import { CharacterMetaItem } from '../internalCache/characterMeta'
import ReadOnlyAssetWorkspace, { AssetWorkspaceAddress } from '@tonylb/mtw-asset-workspace/ts/readOnly'
import { graphStorageDB } from '../dependentMessages/graphCache'
import topologicalSort from '@tonylb/mtw-utilities/ts/graphStorage/utils/graph/topologicalSort'
import GraphUpdate from '@tonylb/mtw-utilities/ts/graphStorage/update'
import { isSchemaImage, isSchemaImport, isSchemaMessage, isSchemaRoom, SchemaFirstImpressionTag, SchemaOneCoolThingTag, SchemaOutfitTag, SchemaOutputTag, SchemaPronounsTag, SchemaRemoveTag, SchemaReplaceMatchTag, SchemaReplacePayloadTag, SchemaReplaceTag, SchemaTag } from '@tonylb/mtw-wml/ts/schema/baseClasses'
import { selectDependencies } from '@tonylb/mtw-wml/ts/schema/selectors/dependencies'
import { selectKeysReferenced } from '@tonylb/mtw-wml/ts/schema/selectors/keysReferenced'
import { StateItemId, isStateItemId } from '../internalCache/baseClasses'
import { map } from '@tonylb/mtw-wml/ts/tree/map'
import { schemaOutputToString } from '@tonylb/mtw-wml/ts/schema/utils/schemaOutput/schemaOutputToString'
import { EditWrappedStandardNode, StandardComponent, SerializableStandardRoom, unwrapStandardComponent } from '@tonylb/mtw-wml/ts/standardize/baseClasses'
import { standardItemToSchemaItem } from '@tonylb/mtw-wml/ts/standardize'
import { GenericTree, GenericTreeNode, treeNodeTypeguard } from '@tonylb/mtw-wml/ts/tree/baseClasses'
import TagTree from '@tonylb/mtw-wml/ts/tagTree'
import SchemaTagTree from '@tonylb/mtw-wml/ts/tagTree/schema'
import { unwrapSubject } from '@tonylb/mtw-wml/ts/schema/utils'

const ephemeraItemFromStandard = (assetWorkspace: ReadOnlyAssetWorkspace) => (item: StandardComponent): EphemeraItem | undefined => {
    const { properties = {} } = assetWorkspace
    const EphemeraId = assetWorkspace.universalKey(item.key)
    if (!EphemeraId) {
        return undefined
    }
    //
    // Generate stateMapping from dependencies and assetWorkspace.universalKey (in case it is needed)
    //
    const dependencies = selectDependencies([standardItemToSchemaItem(item)])
    const stateMapping = dependencies.reduce<Record<string, StateItemId>>((previous, key) => {
        const universalKey = assetWorkspace.universalKey(key)
        if (universalKey && isStateItemId(universalKey)) {
            return { ...previous, [key]: universalKey }
        }
        return previous
    }, {})
    //
    // Generate keyMapping from references and assetWorkspace.universalKey (in case it is needed)
    //
    const keysReferenced = selectKeysReferenced([standardItemToSchemaItem(item)])
    const keyMapping = keysReferenced.reduce<Record<string, EphemeraId>>((previous, key) => {
        const universalKey = assetWorkspace.universalKey(key)
        if (universalKey && isEphemeraId(universalKey)) {
            return { ...previous, [key]: universalKey }
        }
        return previous
    }, {})
    const unwrapSchemaOutputField = <T extends SchemaTag>(node: EditWrappedStandardNode<T, SchemaRemoveTag | SchemaReplaceTag | SchemaReplaceMatchTag | SchemaReplacePayloadTag | SchemaOutputTag> | undefined, tagToRemove: SchemaTag["tag"]): GenericTree<SchemaRemoveTag | SchemaReplaceTag | SchemaReplaceMatchTag | SchemaReplacePayloadTag | SchemaOutputTag> => {
        if (!node) {
            return []
        }
        const tagTree = new SchemaTagTree([node])
        tagTree.prune({ match: tagToRemove })
        return tagTree.tree as GenericTree<SchemaRemoveTag | SchemaReplaceTag | SchemaReplaceMatchTag | SchemaReplacePayloadTag | SchemaOutputTag>
    }
    if (isEphemeraRoomId(EphemeraId) && item.tag === 'Room') {
        return {
            key: item.key,
            EphemeraId: EphemeraId,
            shortName: unwrapSchemaOutputField(item.shortName, 'ShortName'),
            name: unwrapSchemaOutputField(item.name, 'Name'),
            summary: unwrapSchemaOutputField(item.summary, 'Summary'),
            render: unwrapSchemaOutputField(item.description, 'Description'),
            exits: item.exits,
            stateMapping,
            keyMapping
        }
    }
    if (isEphemeraFeatureId(EphemeraId) && item.tag === 'Feature') {
        return {
            key: item.key,
            EphemeraId,
            name: unwrapSchemaOutputField(item.name, 'Name'),
            render: unwrapSchemaOutputField(item.description, 'Description'),
            stateMapping,
            keyMapping
        }
    }
    if (isEphemeraKnowledgeId(EphemeraId) && item.tag === 'Knowledge') {
        return {
            key: item.key,
            EphemeraId,
            name: unwrapSchemaOutputField(item.name, 'Name'),
            render: unwrapSchemaOutputField(item.description, 'Description'),
            stateMapping,
            keyMapping
        }
    }
    if (isEphemeraBookmarkId(EphemeraId) && item.tag === 'Bookmark') {
        return {
            key: item.key,
            EphemeraId,
            render: unwrapSchemaOutputField(item.description, 'Description'),
            stateMapping,
            keyMapping
        }
    }
    if (isEphemeraMessageId(EphemeraId) && item.tag === 'Message') {
        const rooms = item.rooms
            .map(({ data: tag }) => {
                if (isSchemaRoom(tag)) {
                    const roomId = assetWorkspace.universalKey(tag.key)
                    if (roomId && isEphemeraRoomId(roomId)) {
                        return [roomId]
                    }
                }
                return []
            })
            .flat(1)
        return {
            key: item.key,
            EphemeraId,
            rooms,
            render: unwrapSchemaOutputField(item.description, 'Description'),
            stateMapping,
            keyMapping
        }
    }
    if (isEphemeraMomentId(EphemeraId) && item.tag === 'Moment') {
        const messages = item.messages.map(({ data }) => {
            if (!isSchemaMessage(data)) {
                return []
            }
            const universalKey = assetWorkspace.universalKey(data.key)
            if (universalKey && isEphemeraMessageId(universalKey)) {
                return [universalKey]
            }
            return []
        }).flat(1)
        return {
            key: item.key,
            EphemeraId,
            messages,
            stateMapping
        }
    }
    if (isEphemeraMapId(EphemeraId) && item.tag === 'Map') {
        return {
            key: item.key,
            EphemeraId,
            name: unwrapSchemaOutputField(item.name, 'Name'),
            images: map(item.images, (node) => {
                const { data, children } = node
                if (isSchemaImage(data)) {
                    const fileLookup = properties[data.key]
                    if (fileLookup && 'fileName' in fileLookup) {
                        return [{
                            data: {
                                ...data,
                                fileURL: data.fileURL ?? fileLookup.fileName
                            },
                            children
                        }]
                    }
                }
                return [{ data, children }]
            }),
            rooms: item.positions,
            stateMapping,
            keyMapping
        }
    }
    const unwrappedItem = unwrapStandardComponent(item)
    if (isEphemeraCharacterId(EphemeraId) && unwrappedItem.tag === 'Character') {
        // const image = item.images.length > 0 && normal[item.images.slice(-1)[0]]
        // const fileURL = (image && isNormalImage(image) && assetWorkspace.properties[image.key] && assetWorkspace.properties[image.key].fileName) || ''
        const { tag, ...pronouns } = unwrappedItem.pronouns?.data ?? { subject: 'they', object: 'them', possessive: 'their', adjective: 'theirs', reflexive: 'themself' }
        const assets = (assetWorkspace.standard?.metaData ?? [])
            .filter(treeNodeTypeguard(isSchemaImport))
            .map(({ data }) => (data.from))
        const address = assetWorkspace.address
        const player = address.zone === 'Personal' ? address.player : undefined
        return {
            key: item.key,
            EphemeraId,
            address: assetWorkspace.address,
            Name: schemaOutputToString(unwrapSubject(unwrappedItem.name ?? { data: { tag: 'String', value: '' }, children: [] })?.children as GenericTree<SchemaOutputTag> ?? []),
            Pronouns: pronouns as Omit<SchemaPronounsTag, 'tag'>,
            FirstImpression: (unwrappedItem.firstImpression?.data as SchemaFirstImpressionTag)?.value ?? '',
            OneCoolThing: (unwrappedItem.oneCoolThing?.data as SchemaOneCoolThingTag)?.value ?? '',
            Outfit: (unwrappedItem.outfit?.data as SchemaOutfitTag)?.value ?? '',
            // image,
            assets,
            Color: defaultColorFromCharacterId(splitType(EphemeraId)[1]) as any,
            // fileURL,
            Connected: false,
            ConnectionIds: [],
            RoomId: 'VORTEX',
            player
        }

    }
    if (isEphemeraActionId(EphemeraId) && item.tag === 'Action') {
        return {
            key: item.key,
            EphemeraId,
            src: item.src
        }    
    }
    if (isEphemeraVariableId(EphemeraId) && item.tag === 'Variable') {
        return {
            key: item.key,
            EphemeraId,
            default: item.default
        }
    }
    if (isEphemeraComputedId(EphemeraId) && item.tag === 'Computed') {
        return {
            key: item.key,
            EphemeraId,
            src: item.src,
            dependencies: (item.dependencies ?? [])
                .map((key) => ({
                    key,
                    EphemeraId: (assetWorkspace.universalKey(key) ?? '')
                }))
        }
    }
    if (isEphemeraAssetId(EphemeraId) || isEphemeraImageId(EphemeraId)) {
        return undefined
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
    const updateKeys: (keyof EphemeraCharacter)[] = ['address', 'Pronouns', 'FirstImpression', 'OneCoolThing', 'Outfit', 'fileURL', 'Color', 'player']
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

type CacheAssetArguments = {
    messageBus: MessageBus;
    assetId: EphemeraAssetId | EphemeraCharacterId;
    check?: boolean;
    updateOnly?: boolean;
}

//
// cacheAsset takes an Asset or Character Id (which must have had its address pre-populated in the internalCache.AssetAddress cache), looks it
// up in the cache, and uses the address to read in data from the S3 data lake, and cache that data appropriately in Ephemera table structures.
//
export const cacheAsset = async ({ assetId, messageBus, check = false, updateOnly = false }: CacheAssetArguments): Promise<void> => {

    const address = await internalCache.AssetAddress.get(assetId)
    if (typeof address === 'undefined') {
        return
    }
    const assetWorkspace = new ReadOnlyAssetWorkspace(address.address)
    await assetWorkspace.loadJSON()
    //
    // Process file if an Asset
    //
    if (assetWorkspace.standard && assetWorkspace.standard.tag === 'Asset') {
        const assetId = assetWorkspace.address.zone === 'Draft' ? `draft[${assetWorkspace.address.player}]` : assetWorkspace.standard.key
        if (check || updateOnly) {
            const assetEphemeraId = assetWorkspace.universalKey(assetId) ?? AssetKey(assetId)
            if (!(assetEphemeraId && isEphemeraAssetId(assetEphemeraId))) {
                return
            }
            const { EphemeraId = null } = await internalCache.AssetMeta.get(assetEphemeraId) || {}
            if ((check && Boolean(EphemeraId)) || (updateOnly && !Boolean(EphemeraId))) {
                return
            }
        }
    
    
        const ephemeraExtractor = ephemeraItemFromStandard(assetWorkspace)
        const ephemeraItems: EphemeraItem[] = Object.values(assetWorkspace.standard.byId || {})
            .map(ephemeraExtractor)
            .filter((value: EphemeraItem | undefined): value is EphemeraItem => (Boolean(value)))
    
        const graphUpdate = new GraphUpdate({ internalCache: internalCache._graphCache as any, dbHandler: graphStorageDB })

        await mergeIntoEphemera(assetId, ephemeraItems, graphUpdate)

        const assets = (assetWorkspace.standard?.metaData ?? [])
            .filter(treeNodeTypeguard(isSchemaImport))
            .map(({ data }) => (data.from))

        graphUpdate.setEdges([{
            itemId: AssetKey(assetId),
            edges: assets
                .map((from) => ({ target: AssetKey(from), context: '' })),
            options: { direction: 'back' }
        }])

        await Promise.all([
            graphUpdate.flush(),
            pushEphemera({
                EphemeraId: AssetKey(assetId),
                scopeMap: Object.assign({}, ...assetWorkspace.namespaceIdToDB.map(({ internalKey, universalKey }) => ({ [internalKey]: universalKey })))
            })
        ])

        //
        // Use MessageBus to queue RoomHeader messages for any room that has a person to
        // report to
        //
        // TODO: Optimize RoomHeader messages to only deliver to characters who have
        // the asset that is being cached
        //
        Object.values(assetWorkspace.standard?.byId || {})
            .filter((item): item is SerializableStandardRoom => (item.tag === 'Room'))
            .map(({ key }) => (assetWorkspace.universalKey(key)))
            .filter((value): value is string => (Boolean(value)))
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
    if (assetWorkspace.standard && assetWorkspace.standard.tag === 'Character') {
        const characterId = assetWorkspace.standard.key
        const ephemeraItem = ephemeraItemFromStandard(assetWorkspace)(assetWorkspace.standard.byId[characterId])
        if (ephemeraItem) {
            const characterEphemeraId = assetWorkspace.universalKey(ephemeraItem.key) || ''
            if (!(characterEphemeraId && isEphemeraCharacterId(characterEphemeraId))) {
                return
            }
            const ephemeraToCache = await pushCharacterEphemeraToInternalCache(ephemeraItem as EphemeraCharacter)
            if (check || updateOnly) {
                const { EphemeraId = null, RoomId = 'ROOM#VORTEX' } = ephemeraToCache || {}
                if ((check && Boolean(EphemeraId)) || (updateOnly && !Boolean(EphemeraId))) {
                    return
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
                internalCache.CharacterSessions.get(characterEphemeraId).then((sessions) => (internalCache.SessionConnections.get(sessions ?? []))),
                pushCharacterEphemera(ephemeraItem as EphemeraCharacter, ephemeraToCache)
            ])
            if (characterConnections && characterConnections.length) {
                const { assets } = await internalCache.CharacterMeta.get(characterEphemeraId)
                //
                // TODO: Refactor cacheAsset to work with multiple assets in parallel
                //
                await Promise.all(assets.map(AssetKey).map((assetId) => (cacheAsset({ messageBus, assetId, check: true }))))
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
