import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB/index'
import {
    EphemeraCharacter,
    EphemeraItem,
    EphemeraKeyMappingMixin,
    EphemeraPushArgs,
    EphemeraStateMappingMixin
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
import { isSchemaComputed, isSchemaConditionFallthrough, isSchemaConditionStatement, isSchemaImage, isSchemaImport, isSchemaMessage, isSchemaRoom, SchemaFirstImpressionTag, SchemaOneCoolThingTag, SchemaOutfitTag, SchemaOutputTag, SchemaPronounsTag, SchemaRemoveTag, SchemaReplaceMatchTag, SchemaReplacePayloadTag, SchemaReplaceTag, SchemaTag } from '@tonylb/mtw-wml/ts/schema/baseClasses'
import { selectDependencies } from '@tonylb/mtw-wml/ts/schema/selectors/dependencies'
import { selectKeysReferenced } from '@tonylb/mtw-wml/ts/schema/selectors/keysReferenced'
import { StateItemId, isStateItemId } from '../internalCache/baseClasses'
import { map } from '@tonylb/mtw-wml/ts/tree/map'
import { schemaOutputToString } from '@tonylb/mtw-wml/ts/schema/utils/schemaOutput/schemaOutputToString'
import { EditWrappedStandardNode, StandardComponentData, unwrapStandardComponent, isStandardMap } from '@tonylb/mtw-wml/ts/standardize/baseClasses'
import { StandardForm, standardItemToSchemaItem } from '@tonylb/mtw-wml/ts/standardize'
import { GenericTree, treeNodeTypeguard } from '@tonylb/mtw-wml/ts/tree/baseClasses'
import SchemaTagTree from '@tonylb/mtw-wml/ts/tagTree/schema'
import { unwrapSubject } from '@tonylb/mtw-wml/ts/schema/utils'
import { excludeUndefined } from '@tonylb/mtw-utilities/ts/lists'
import StandardCharacter from '@tonylb/mtw-wml/ts/standardize/components/character'
import StandardVariable from '@tonylb/mtw-wml/ts/standardize/components/variable'
import StandardMap from '@tonylb/mtw-wml/ts/standardize/components/map'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'

// const ephemeraItemFromStandard = (assetWorkspace: ReadOnlyAssetWorkspace) => (item: StandardComponentData): EphemeraItem | undefined => {
//     const EphemeraId = assetWorkspace.standard?.byId?.[item.key]?.universalKey
//     if (!EphemeraId) {
//         return undefined
//     }
//     //
//     // Generate stateMapping from dependencies and assetWorkspace.universalKey (in case it is needed)
//     //
//     const dependencies = selectDependencies([standardItemToSchemaItem(item)])
//     const stateMapping = dependencies.reduce<Record<string, StateItemId>>((previous, key) => {
//         const universalKey = assetWorkspace.standard?.byId?.[key]?.universalKey
//         if (universalKey && isStateItemId(universalKey)) {
//             return { ...previous, [key]: universalKey }
//         }
//         return previous
//     }, {})
//     //
//     // Generate keyMapping from references and assetWorkspace.universalKey (in case it is needed)
//     //
//     const keysReferenced = selectKeysReferenced([standardItemToSchemaItem(item)])
//     const keyMapping = keysReferenced.reduce<Record<string, EphemeraId>>((previous, key) => {
//         const universalKey = assetWorkspace.standard?.byId?.[key]?.universalKey
//         if (universalKey && isEphemeraId(universalKey)) {
//             return { ...previous, [key]: universalKey }
//         }
//         return previous
//     }, {})
//     const unwrapSchemaOutputField = <T extends SchemaTag>(node: EditWrappedStandardNode<T, SchemaRemoveTag | SchemaReplaceTag | SchemaReplaceMatchTag | SchemaReplacePayloadTag | SchemaOutputTag> | undefined, tagToRemove: SchemaTag["tag"]): GenericTree<SchemaRemoveTag | SchemaReplaceTag | SchemaReplaceMatchTag | SchemaReplacePayloadTag | SchemaOutputTag> => {
//         if (!node) {
//             return []
//         }
//         const tagTree = new SchemaTagTree([node])
//         tagTree.prune({ match: tagToRemove })
//         return tagTree.tree as GenericTree<SchemaRemoveTag | SchemaReplaceTag | SchemaReplaceMatchTag | SchemaReplacePayloadTag | SchemaOutputTag>
//     }
//     if (isEphemeraRoomId(EphemeraId) && item.tag === 'Room') {
//         return {
//             key: item.key,
//             EphemeraId: EphemeraId,
//             shortName: unwrapSchemaOutputField(item.shortName, 'ShortName'),
//             name: unwrapSchemaOutputField(item.name, 'Name'),
//             summary: unwrapSchemaOutputField(item.summary, 'Summary'),
//             render: unwrapSchemaOutputField(item.description, 'Description'),
//             exits: item.exits,
//             stateMapping,
//             keyMapping
//         }
//     }
//     if (isEphemeraFeatureId(EphemeraId) && item.tag === 'Feature') {
//         return {
//             key: item.key,
//             EphemeraId,
//             name: unwrapSchemaOutputField(item.name, 'Name'),
//             render: unwrapSchemaOutputField(item.description, 'Description'),
//             stateMapping,
//             keyMapping
//         }
//     }
//     if (isEphemeraKnowledgeId(EphemeraId) && item.tag === 'Knowledge') {
//         return {
//             key: item.key,
//             EphemeraId,
//             name: unwrapSchemaOutputField(item.name, 'Name'),
//             render: unwrapSchemaOutputField(item.description, 'Description'),
//             stateMapping,
//             keyMapping
//         }
//     }
//     if (isEphemeraBookmarkId(EphemeraId) && item.tag === 'Bookmark') {
//         return {
//             key: item.key,
//             EphemeraId,
//             render: unwrapSchemaOutputField(item.description, 'Description'),
//             stateMapping,
//             keyMapping
//         }
//     }
//     if (isEphemeraMessageId(EphemeraId) && item.tag === 'Message') {
//         const rooms = item.rooms
//             .map(({ data: tag }) => {
//                 if (isSchemaRoom(tag)) {
//                     const roomId = assetWorkspace.standard?.byId?.[tag.key]?.universalKey
//                     if (roomId && isEphemeraRoomId(roomId)) {
//                         return [roomId]
//                     }
//                 }
//                 return []
//             })
//             .flat(1)
//         return {
//             key: item.key,
//             EphemeraId,
//             rooms,
//             render: unwrapSchemaOutputField(item.description, 'Description'),
//             stateMapping,
//             keyMapping
//         }
//     }
//     if (isEphemeraMomentId(EphemeraId) && item.tag === 'Moment') {
//         const messages = item.messages.map(({ data }) => {
//             if (!isSchemaMessage(data)) {
//                 return []
//             }
//             const universalKey = assetWorkspace.standard?.byId?.[data.key]?.universalKey
//             if (universalKey && isEphemeraMessageId(universalKey)) {
//                 return [universalKey]
//             }
//             return []
//         }).flat(1)
//         return {
//             key: item.key,
//             EphemeraId,
//             messages,
//             stateMapping
//         }
//     }
//     if (isEphemeraMapId(EphemeraId) && item.tag === 'Map') {
//         return {
//             key: item.key,
//             EphemeraId,
//             name: unwrapSchemaOutputField(item.name, 'Name'),
//             images: map(item.images, (node) => {
//                 const { data, children } = node
//                 if (isSchemaImage(data)) {
//                     const fileLookup = assetWorkspace.standard?.byId?.[item.key]?.fileName
//                     if (fileLookup) {
//                         return [{
//                             data: {
//                                 ...data,
//                                 fileURL: data.fileURL ?? fileLookup
//                             },
//                             children
//                         }]
//                     }
//                 }
//                 return [{ data, children }]
//             }),
//             rooms: item.positions,
//             stateMapping,
//             keyMapping
//         }
//     }
//     const unwrappedItem = unwrapStandardComponent(item)
//     if (isEphemeraCharacterId(EphemeraId) && unwrappedItem.tag === 'Character') {
//         // const image = item.images.length > 0 && normal[item.images.slice(-1)[0]]
//         // const fileURL = (image && isNormalImage(image) && assetWorkspace.properties[image.key] && assetWorkspace.properties[image.key].fileName) || ''
//         const { tag, ...pronouns } = unwrappedItem.pronouns?.data ?? { subject: 'they', object: 'them', possessive: 'their', adjective: 'theirs', reflexive: 'themself' }
//         const assets = (assetWorkspace.standard?.metaData ?? [])
//             .filter(treeNodeTypeguard(isSchemaImport))
//             .map(({ data }) => (data.from))
//         const address = assetWorkspace.address
//         const player = address.zone === 'Personal' ? address.player : undefined
//         return {
//             key: item.key,
//             EphemeraId,
//             address: assetWorkspace.address,
//             Name: schemaOutputToString(unwrapSubject(unwrappedItem.name ?? { data: { tag: 'String', value: '' }, children: [] })?.children as GenericTree<SchemaOutputTag> ?? []),
//             Pronouns: pronouns as Omit<SchemaPronounsTag, 'tag'>,
//             FirstImpression: (unwrappedItem.firstImpression?.data as SchemaFirstImpressionTag)?.value ?? '',
//             OneCoolThing: (unwrappedItem.oneCoolThing?.data as SchemaOneCoolThingTag)?.value ?? '',
//             Outfit: (unwrappedItem.outfit?.data as SchemaOutfitTag)?.value ?? '',
//             // image,
//             assets,
//             Color: defaultColorFromCharacterId(splitType(EphemeraId)[1]) as any,
//             // fileURL,
//             Connected: false,
//             ConnectionIds: [],
//             RoomId: 'VORTEX',
//             player
//         }

//     }
//     if (isEphemeraActionId(EphemeraId) && item.tag === 'Action') {
//         return {
//             key: item.key,
//             EphemeraId,
//             src: item.src
//         }    
//     }
//     if (isEphemeraVariableId(EphemeraId) && item.tag === 'Variable') {
//         return {
//             key: item.key,
//             EphemeraId,
//             default: item.default
//         }
//     }
//     if (isEphemeraComputedId(EphemeraId) && item.tag === 'Computed') {
//         return {
//             key: item.key,
//             EphemeraId,
//             src: item.src,
//             dependencies: (item.dependencies ?? [])
//                 .map((key) => ({
//                     key,
//                     EphemeraId: (assetWorkspace.standard?.byId?.[key]?.universalKey ?? '')
//                 }))
//         }
//     }
//     if (isEphemeraAssetId(EphemeraId) || isEphemeraImageId(EphemeraId)) {
//         return undefined
//     }
//     console.log(`WARNING: Unknown combination of types in cacheAsset:  NormalItem with tag '${item.tag}' and Ephemera wrapper: '${splitType(EphemeraId)[0]}'`)
//     return undefined
// }

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

const stripUIFieldsFromStandardForm = (standard: StandardForm): StandardForm => {
    const stripUIFields = (tree: GenericTree<SchemaTag>): GenericTree<SchemaTag> => (
        tree.map((node) => {
            if (treeNodeTypeguard(isSchemaConditionStatement)(node) || treeNodeTypeguard(isSchemaConditionFallthrough)(node)) {
                return {
                    data: { ...node.data, selected: undefined },
                    children: stripUIFields(node.children)
                }
            }
            return {
                ...node,
                children: stripUIFields(node.children)
            }
        })
    )
    return standard.mapContents(stripUIFields)
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
    if (assetWorkspace.standard) {
        const assetId = assetWorkspace.address.zone === 'Draft' ? `draft[${assetWorkspace.address.player}]` : assetWorkspace.standard.key
        if (check || updateOnly) {
            const assetEphemeraId = AssetKey(assetWorkspace.standard?.key ?? assetId)
            if (!(assetEphemeraId && isEphemeraAssetId(assetEphemeraId))) {
                return
            }
            const { EphemeraId = null } = await internalCache.AssetMeta.get(assetEphemeraId) || {}
            if ((check && Boolean(EphemeraId)) || (updateOnly && !Boolean(EphemeraId))) {
                return
            }
        }
    
        // const ephemeraExtractor = ephemeraItemFromStandard(assetWorkspace)
        const ephemeraItems: (StandardComponentData & { EphemeraId: EphemeraId })[] = Object.values(stripUIFieldsFromStandardForm(assetWorkspace.standard).byId || {})
            .filter(excludeUndefined)
            .map((item) => {
                if (item instanceof StandardCharacter || item instanceof StandardVariable) {
                    return item.toJSON({ stripUniversalKey: true })
                }
                //
                // Generate stateMapping from dependencies and assetWorkspace.universalKey (in case it is needed)
                //
                const dependencies = item.referencedKeys()
                    .filter(({ referenceType }) => (referenceType === 'Dependency'))
                    .map(({ key }) => (key))
                const stateMapping = dependencies.reduce<Record<string, StateItemId>>((previous, key) => {
                    const universalKey = assetWorkspace.standard?.byId?.[key]?.universalKey
                    if (universalKey && isStateItemId(universalKey)) {
                        return { ...previous, [key]: universalKey }
                    }
                    return previous
                }, {})
                //
                // Generate keyMapping from references and assetWorkspace.universalKey (in case it is needed)
                //
                const keysReferenced = item.referencedKeys()
                    .filter(({ referenceType }) => (referenceType !== 'Dependency'))
                    .map(({ key }) => (key))
                const keyMapping = keysReferenced.reduce<Record<string, EphemeraId>>((previous, key) => {
                    const universalKey = assetWorkspace.standard?.byId?.[key]?.universalKey
                    if (universalKey && isEphemeraId(universalKey)) {
                        return { ...previous, [key]: universalKey }
                    }
                    return previous
                }, {})
                return {
                    ...item.toJSON({ stripUniversalKey: true }),
                    keyMapping,
                    stateMapping,
                    ...(item instanceof StandardMap
                        ? {
                            images: map(item.images, (node) => {
                                const { data, children } = node
                                if (isSchemaImage(data)) {
                                    const fileLookup = assetWorkspace.standard?.byId[data.key]?.fileName
                                    if (fileLookup) {
                                        return [{
                                            data: {
                                                ...data,
                                                fileURL: data.fileURL ?? fileLookup
                                            },
                                            children
                                        }]
                                    }
                                }
                                return [{ data, children }]
                            })
                        }
                        : {}
                    )
                }
            })
            .map((component) => ({ ...component, EphemeraId: assetWorkspace.standard?.byId?.[component.key]?.universalKey }))
            .filter((component): component is (StandardComponentData & EphemeraKeyMappingMixin & EphemeraStateMappingMixin & { EphemeraId: EphemeraId }) => (Boolean(component.EphemeraId && isEphemeraId(component.EphemeraId))))
    
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
                scopeMap: Object.values(assetWorkspace.standard?.byId || {})
                    .reduce<Record<string, string>>((previous, component) => ({
                        ...previous,
                        [component.key]: component.universalKey ?? component.key
                    }), {})
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
            .filter((item) => (item instanceof StandardRoom))
            .map(({ key }) => (assetWorkspace.standard?.byId?.[key]?.universalKey))
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

}
