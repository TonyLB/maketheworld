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
} from '@tonylb/mtw-wml/ts/normalize/baseClasses'
import Normalizer from '@tonylb/mtw-wml/ts/normalize'
import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index.js'
import {
    EphemeraCharacter,
    EphemeraCondition,
    EphemeraItem,
    EphemeraPushArgs
} from './baseClasses'
import { conditionsFromContext } from './utilities'
import { defaultColorFromCharacterId } from '../lib/characterColor'
import { AssetKey, splitType } from '@tonylb/mtw-utilities/dist/types.js'
import { MessageBus } from '../messageBus/baseClasses.js'
import { mergeIntoEphemera } from './mergeIntoEphemera'
import {
    EphemeraAssetId,
    EphemeraCharacterId,
    EphemeraError,
    EphemeraId,
    isEphemeraActionId,
    isEphemeraAssetId,
    isEphemeraBookmarkId,
    isEphemeraCharacterId,
    isEphemeraComputedId,
    isEphemeraFeatureId,
    isEphemeraId,
    isEphemeraKnowledgeId,
    isEphemeraMapId,
    isEphemeraMessageId,
    isEphemeraMomentId,
    isEphemeraRoomId,
    isEphemeraVariableId
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../internalCache'
import { CharacterMetaItem } from '../internalCache/characterMeta'
import ReadOnlyAssetWorkspace, { AssetWorkspaceAddress } from '@tonylb/mtw-asset-workspace/dist/readOnly'
import { graphStorageDB } from '../dependentMessages/graphCache'
import topologicalSort from '@tonylb/mtw-utilities/dist/graphStorage/utils/graph/topologicalSort'
import GraphUpdate from '@tonylb/mtw-utilities/dist/graphStorage/update'
import { selectName } from '@tonylb/mtw-wml/ts/normalize/selectors/name'
import { selectRender } from '@tonylb/mtw-wml/ts/normalize/selectors/render'
import { selectExits } from '@tonylb/mtw-wml/ts/normalize/selectors/exits'
import { selectRooms } from '@tonylb/mtw-wml/ts/normalize/selectors/rooms'
import { isSchemaImage, isSchemaRoom } from '@tonylb/mtw-wml/ts/simpleSchema/baseClasses'
import { selectImages } from '@tonylb/mtw-wml/ts/normalize/selectors/images'
import { selectMapRooms } from '@tonylb/mtw-wml/ts/normalize/selectors/mapRooms'
import { selectDependencies } from '@tonylb/mtw-wml/ts/normalize/selectors/dependencies'
import { selectKeysReferenced } from '@tonylb/mtw-wml/ts/normalize/selectors/keysReferenced'
import { StateItemId, isStateItemId } from '../internalCache/baseClasses'
import { filter } from '@tonylb/mtw-wml/ts/tree/filter'
import { map } from '@tonylb/mtw-wml/ts/tree/map'

//
// TODO: Fix ephemeraItemFromNormal to store the new standard for how to deal with normal Items (i.e., children are GenericTree<SchemaTag>,
// all schemata have been standardized before storage)
//
const ephemeraItemFromNormal = (assetWorkspace: ReadOnlyAssetWorkspace) => (item: NormalItem): EphemeraItem | undefined => {
    const { normal = {}, properties = {} } = assetWorkspace
    const normalizer = new Normalizer()
    normalizer.loadNormal(normal)
    const EphemeraId = assetWorkspace.universalKey(item.key)
    if (!EphemeraId) {
        return undefined
    }
    //
    // Generate stateMapping from dependencies and assetWorkspace.universalKey (in case it is needed)
    //
    const dependencies = normalizer.select({ key: item.key, selector: selectDependencies })
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
    const keysReferenced = normalizer.select({ key: item.key, selector: selectKeysReferenced })
    const keyMapping = keysReferenced.reduce<Record<string, EphemeraId>>((previous, key) => {
        const universalKey = assetWorkspace.universalKey(key)
        if (universalKey && isEphemeraId(universalKey)) {
            return { ...previous, [key]: universalKey }
        }
        return previous
    }, {})
    if (isEphemeraRoomId(EphemeraId) && isNormalRoom(item)) {
        const name = normalizer.select({ key: item.key, selector: selectName })
        const render = normalizer.select({ key: item.key, selector: selectRender })
        const exits = normalizer.select({ key: item.key, selector: selectExits })
        return {
            key: item.key,
            EphemeraId: EphemeraId,
            name,
            render,
            exits,
            stateMapping,
            keyMapping
        }
    }
    if (isEphemeraFeatureId(EphemeraId) && isNormalFeature(item)) {
        const name = normalizer.select({ key: item.key, selector: selectName })
        const render = normalizer.select({ key: item.key, selector: selectRender })
        return {
            key: item.key,
            EphemeraId,
            name,
            render,
            stateMapping,
            keyMapping
        }
    }
    if (isEphemeraKnowledgeId(EphemeraId) && isNormalKnowledge(item)) {
        const name = normalizer.select({ key: item.key, selector: selectName })
        const render = normalizer.select({ key: item.key, selector: selectRender })
        return {
            key: item.key,
            EphemeraId,
            name,
            render,
            stateMapping,
            keyMapping
        }
    }
    if (isEphemeraBookmarkId(EphemeraId) && isNormalBookmark(item)) {
        const render = normalizer.select({ key: item.key, selector: selectRender })
        return {
            key: item.key,
            EphemeraId,
            render,
            stateMapping,
            keyMapping
        }
    }
    if (isEphemeraMessageId(EphemeraId) && isNormalMessage(item)) {
        const rooms = normalizer.select({ key: item.key, selector: selectRooms })
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
        const render = normalizer.select({ key: item.key, selector: selectRender })
        return {
            key: item.key,
            EphemeraId,
            rooms,
            render,
            stateMapping,
            keyMapping
        }
    }
    if (isEphemeraMomentId(EphemeraId) && isNormalMoment(item)) {
        return {
            key: item.key,
            EphemeraId,
            messages: [],
            stateMapping
            // appearances: item.appearances
            //     .map((appearance) => ({
            //         conditions: conditionsTransform(appearance.contextStack),
            //         messages: (appearance.messages || []).map((key) => (assetWorkspace.universalKey(key))).filter((value): value is string => (Boolean(value))).filter(isEphemeraMessageId)
            //     }))
        }
    }
    if (isEphemeraMapId(EphemeraId) && isNormalMap(item)) {
        const name = normalizer.select({ key: item.key, selector: selectName })
        const images = normalizer.select({ key: item.key, selector: selectImages })
        const rooms = normalizer.select({ key: item.key, selector: selectMapRooms })
        return {
            key: item.key,
            EphemeraId,
            name,
            images: map(images, (node) => {
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
            rooms,
            stateMapping,
            keyMapping
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
            dependencies: (item.dependencies ?? [])
                .map((key) => ({
                    key,
                    EphemeraId: (assetWorkspace.universalKey(key) ?? '')
                }))
        }
    }
    if (isEphemeraAssetId(EphemeraId)) {
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
    const assetItem = Object.values(assetWorkspace.normal || {}).find(isNormalAsset)
    if (assetItem) {
        if (check || updateOnly) {
            const assetEphemeraId = assetWorkspace.universalKey(assetItem.key) ?? `ASSET#${assetItem.key}`
            if (!(assetEphemeraId && isEphemeraAssetId(assetEphemeraId))) {
                return
            }
            const { EphemeraId = null } = await internalCache.AssetMeta.get(assetEphemeraId) || {}
            if ((check && Boolean(EphemeraId)) || (updateOnly && !Boolean(EphemeraId))) {
                return
            }
        }
    
        //
        // Instanced stories are not directly cached, they are instantiated ... so
        // this would be a miscall, and should be ignored.
        //
        if (assetItem.instance) {
            return
        }
        const assetId = assetItem.key
    
        const ephemeraExtractor = ephemeraItemFromNormal(assetWorkspace)
        const ephemeraItems: EphemeraItem[] = Object.values(assetWorkspace.normal || {})
            .map(ephemeraExtractor)
            .filter((value: EphemeraItem | undefined): value is EphemeraItem => (Boolean(value)))
    
        const graphUpdate = new GraphUpdate({ internalCache: internalCache._graphCache as any, dbHandler: graphStorageDB })

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
        Object.values(assetWorkspace.normal || {})
            .filter(isNormalRoom)
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
    const characterItem = Object.values(assetWorkspace.normal || {}).find(isNormalCharacter)
    if (characterItem) {
        const ephemeraItem = ephemeraItemFromNormal(assetWorkspace)(characterItem)
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
                internalCache.CharacterConnections.get(characterEphemeraId),
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
