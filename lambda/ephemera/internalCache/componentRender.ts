import { ComponentMetaData, ComponentMetaId, ComponentMetaItem } from './componentMeta'
import { DeferredCache } from './deferredCache'
import { EphemeraCondition } from '../cacheAsset/baseClasses'
import { RoomDescribeData, FeatureDescribeData, MapDescribeData, TaggedMessageContentFlat, KnowledgeDescribeData, TaggedLink } from '@tonylb/mtw-interfaces/ts/messages'
import CacheGlobalData from './global';
import { excludeUndefined, unique } from '@tonylb/mtw-utilities/ts/lists';
import { AssetStateMapping, EvaluateCodeAddress, EvaluateCodeData } from './assetState';
import {
    EphemeraAssetId,
    EphemeraCharacterId,
    EphemeraComputedId,
    EphemeraFeatureId,
    EphemeraId,
    EphemeraKnowledgeId,
    EphemeraMapId,
    EphemeraMessageId,
    EphemeraRoomId,
    EphemeraVariableId,
    isEphemeraActionId,
    isEphemeraCharacterId,
    isEphemeraComputedId,
    isEphemeraFeatureId,
    isEphemeraKnowledgeId,
    isEphemeraMapId,
    isEphemeraMessageId,
    isEphemeraRoomId,
    isEphemeraVariableId
} from '@tonylb/mtw-interfaces/ts/baseClasses';
import { RoomCharacterListItem, StateItemId } from './baseClasses';
import CacheCharacterMetaData, { CharacterMetaItem } from './characterMeta';
import { splitType } from '@tonylb/mtw-utilities/ts/types';
import { GenericTree, treeNodeTypeguard } from '@tonylb/mtw-base/ts/genericTree';
import { treeTypeGuard } from '@tonylb/mtw-wml/ts/tree/filter';
import { compressStrings } from '@tonylb/mtw-wml/ts/schema/utils/schemaOutput/compressStrings';
import { schemaOutputToString } from '@tonylb/mtw-wml/ts/schema/utils/schemaOutput/schemaOutputToString'
import { EditWrappedStandardNode, isStandardMap, isStandardRoom, StandardComponentData, StandardFeature, StandardKnowledge, StandardMap, StandardMessage, StandardRoom } from '@tonylb/mtw-wml/ts/standardize/baseClasses';
import { unwrapSubject } from '@tonylb/mtw-wml/ts/schema/utils';
import { ExampleComponentId, ExamplesData, ExamplesReturn } from './examples';
import { RenderTree } from '@tonylb/mtw-wml/ts/standardize/render/baseClasses';
import { CacheRoomCharacterListsData } from './roomCharacterLists';
import { isSchemaBookmark, isSchemaOutputTag, SchemaOutputTag, SchemaTag } from '@tonylb/mtw-base/ts/schema';
import { isSchemaCondition, isSchemaConditionFallthrough, isSchemaConditionStatement, isSchemaSelected } from '@tonylb/mtw-base/ts/schema/condition';
import { isSchemaLineBreak, isSchemaLink, isSchemaSpacer } from '@tonylb/mtw-base/ts/schema/renderTree';
import { isSchemaReplace } from '@tonylb/mtw-base/ts/schema/edit';
import { isSchemaExit, isSchemaPosition, isSchemaRoom } from '@tonylb/mtw-base/ts/schema/components';
import { isSchemaImage } from '@tonylb/mtw-base/ts/schema/image';

type MessageDescribeData = {
    MessageId: EphemeraMessageId;
    Description: RenderTree;
    rooms: EphemeraRoomId[];
}

export type ComponentDescriptionItem = RoomDescribeData | FeatureDescribeData | KnowledgeDescribeData | MapDescribeData | MessageDescribeData

type ComponentDescriptionCache = {
    dependencies: StateItemId[];
    description: ComponentDescriptionItem;
}

type ComponentRenderGetOptions = {
    priorRenderChain?: string[];
    header?: boolean;
}

export const evaluateSchemaConditionals = <T extends SchemaTag>(evaluateCode: (address: EvaluateCodeAddress) => Promise<boolean>, typeGuard?: (tag: SchemaTag) => tag is T) => async (tree: GenericTree<T>, mapping: AssetStateMapping): Promise<GenericTree<T>> => {
    const finalTree = (await Promise.all(tree.map(async (node) => {
        const { data, children } = node
        if (isSchemaCondition(data)) {
            const recursiveEvaluate = async (statements: GenericTree<SchemaTag>): Promise<GenericTree<SchemaTag>> => {
                if (!statements.length) {
                    return []
                }
                const { data, children } = statements[0]
                if (isSchemaConditionFallthrough(data)) {
                    return children
                }
                if (isSchemaConditionStatement(data)) {
                    const passed = await evaluateCode({ source: data.if, mapping })
                    if (passed) {
                        return children
                    }
                }
                return await recursiveEvaluate(statements.slice(1))
            }
            return await recursiveEvaluate(children)
        }
        else {
            return [node]
        }
    }))).flat(1)
    if (typeGuard) {
        return treeTypeGuard({ tree: finalTree, typeGuard })
    }
    else {
        return finalTree as GenericTree<T>
    }
}

const generateCacheKey = (CharacterId: EphemeraCharacterId | 'ANONYMOUS', EphemeraId: EphemeraRoomId | EphemeraFeatureId | EphemeraKnowledgeId | EphemeraMapId | EphemeraMessageId, options?: ComponentRenderGetOptions) => (`${CharacterId}::${EphemeraId}::${(options && 'header' in options && options.header) ? 'true' : 'false'}`)

export const filterAppearances = (evaluateCode: (address: EvaluateCodeAddress) => Promise<any>) => async <T extends { conditions: EphemeraCondition[] }>(possibleAppearances: T[]): Promise<T[]> => {
    //
    // TODO: Aggregate and also return a dependencies map of source and mappings, so that the cache can search
    // for dependencies upon a certain evaluation code and invalidate the render when that evaluation has been
    // invalidated
    //
    const allPromises = possibleAppearances
        .map(async (appearance): Promise<T | undefined> => {
            const conditionsPassList = await Promise.all(appearance.conditions.map(async ({ if: source, not, dependencies }) => {
                const evaluated = await evaluateCode({
                    source,
                    mapping: dependencies
                        .reduce<Record<string, EphemeraComputedId | EphemeraVariableId>>((previous, { EphemeraId, key }) => (
                            (key && (isEphemeraComputedId(EphemeraId) || isEphemeraVariableId(EphemeraId)))
                                ? { ...previous, [key]: EphemeraId }
                                : previous
                            ), {})
                })
                if (not) {
                    return !Boolean(evaluated)
                }
                else {
                    return Boolean(evaluated)
                }
            }))
            const allConditionsPass = conditionsPassList.reduce<boolean>((previous, value) => (previous && Boolean(value)), true)
            if (allConditionsPass) {
                return appearance
            }
            else {
                return undefined
            }
        })
    const allMappedAppearances = await Promise.all(allPromises) as (T | undefined)[]
    return allMappedAppearances.filter((value: T | undefined): value is T => (Boolean(value)))
}

export const isComponentTag = (tag) => (['Room', 'Feature', 'Bookmark'].includes(tag))

export const isComponentKey = (key) => (['ROOM', 'FEATURE', 'BOOKMARK'].includes(splitType(key)[0]))

//
// flattenSchemaOutputTags is a temporary conversion between unconditional SchemaOutputTag trees and
// legacy TaggedMessageContentFlat format
//
const flattenSchemaOutputTags = (tree: GenericTree<SchemaOutputTag>): TaggedMessageContentFlat[] => {
    return tree.map(({ data }) => {
        if (isSchemaLink(data)) {
            const lookupTarget = data.to
            if (!(isEphemeraFeatureId(lookupTarget) || isEphemeraActionId(lookupTarget) || isEphemeraCharacterId(lookupTarget) || isEphemeraKnowledgeId(lookupTarget))) {
                return { tag: 'String', value: '' }
            }
            return {
                ...data,
                to: lookupTarget
            }
        }
        if (isSchemaCondition(data) || isSchemaConditionFallthrough(data) || isSchemaConditionStatement(data) ||isSchemaBookmark(data) ||  isSchemaReplace(data)) {
            return { tag: 'String', value: '' }
        }
        if (isSchemaLineBreak(data)) {
            return { tag: 'LineBreak' }
        }
        if (isSchemaSpacer(data)) {
            return { tag: 'String', value: ' ' }
        }
        if (isSchemaSelected(data)) {
            return { tag: 'String', value: ' ' }
        }
        return data
    }) as any
}

// const renderTreeToTaggedMessage = (tree: RenderTree): TaggedMessageContentFlat[] => {
//     return tree.map((node) => {
//         if (typeof node === 'string') {
//             return { tag: 'String' as const, value: node }
//         }
//         const { data } = node
//         if (isSchemaString(data)) {
//             return data
//         }
//         if (isSchemaLink(data)) {
//             const lookupTarget = data.to
//             if (!(isEphemeraFeatureId(lookupTarget) || isEphemeraActionId(lookupTarget) || isEphemeraCharacterId(lookupTarget) || isEphemeraKnowledgeId(lookupTarget))) {
//                 return { tag: 'String' as const, value: '' }
//             }
//             return {
//                 ...data,
//                 to: lookupTarget
//             } as TaggedLink
//         }
//         if (isSchemaLineBreak(data)) {
//             return { tag: 'LineBreak' as const }
//         }
//         if (isSchemaSpacer(data)) {
//             return { tag: 'String' as const, value: ' ' }
//         }
//         if (isSchemaSelected(data)) {
//             return { tag: 'String' as const, value: ' ' }
//         }
//         return undefined
//     }).filter(excludeUndefined)
// }

// //
// // deflattenSchemaOutputTags is a temporary conversion between legacy TaggedMessageContentFlat format and
// // unconditional SchemaOutputTag trees
// //
// const deflattenSchemaOutputTags = (tags: TaggedMessageContentFlat[]) : GenericTree<SchemaOutputTag> => {
//     return tags.map((tag) => {
//         switch(tag.tag) {
//             case 'Link':
//                 return { data: { tag: 'Link', to: tag.to, text: tag.text }, children: [] }
//             case 'LineBreak':
//                 return { data: { tag: 'br' }, children: [] }
//             case 'String':
//                 return { data: { tag: 'String', value: tag.value }, children: [] }
//         }
//     })
// }

export class ComponentRenderData {
    _examples: (keys: ExampleComponentId[]) => Promise<Record<ExampleComponentId, ExamplesReturn[]>>;
    _evaluateCode: (address: EvaluateCodeAddress) => Promise<any>;
    _componentMeta: (EphemeraId: ComponentMetaId, assetList: string[]) => Promise<Record<string, ComponentMetaItem & { EphemeraId: EphemeraId }>>;
    _roomCharacterList: (roomId: EphemeraRoomId) => Promise<RoomCharacterListItem[]>;
    _getAssets: () => Promise<string[]>;
    _characterMeta: (characterId: EphemeraCharacterId) => Promise<CharacterMetaItem>;
    _Cache: DeferredCache<ComponentDescriptionCache>;
    _Store: Record<string, ComponentDescriptionItem> = {}
    _Dependencies: Record<string, StateItemId[]> = {}
    
    constructor(
        examples: ExamplesData,
        evaluateCode: EvaluateCodeData,
        componentMeta: ComponentMetaData,
        roomCharacterList: CacheRoomCharacterListsData,
        globalCache: CacheGlobalData,
        characterMeta: CacheCharacterMetaData
    ) {
        this._examples = (keys) => (examples.get(keys))
        this._evaluateCode = (address) => (evaluateCode.get(address))
        this._componentMeta = (EphemeraId, assetList) => (componentMeta.getAcrossAssets(EphemeraId, assetList))
        this._roomCharacterList = (RoomId) => (roomCharacterList.get(RoomId))
        this._getAssets = async () => (await globalCache.get('assets') || [])
        this._characterMeta = (characterId) => (characterMeta.get(characterId))
        this._Cache = new DeferredCache<ComponentDescriptionCache>({
            callback: (key, { dependencies, description }) => {
                this._setStore(key, description)
                this._setDependencies(key, dependencies)
            },
            defaultValue: (cacheKey) => {
                if (isEphemeraFeatureId(cacheKey)) {
                    return {
                        dependencies: [],
                        description: {
                            FeatureId: cacheKey,
                            Description: [],
                            Name: [],
                            assets: {}
                        }
                    }
                }
                if (isEphemeraRoomId(cacheKey)) {
                    return {
                        dependencies: [],
                        description: {
                            RoomId: cacheKey,
                            Description: [],
                            ShortName: [],
                            Name: [],
                            Summary: [],
                            Exits: [],
                            Characters: [],
                            assets: {}
                        }
                    }
                }
                if (isEphemeraMessageId(cacheKey)) {
                    return {
                        dependencies: [],
                        description: {
                            MessageId: cacheKey,
                            Description: [],
                            rooms: []
                        }
                    }
                }
                throw new Error('Illegal tag in ComponentDescription internalCache')
            }
        })
    }

    async flush() {
        this._Cache.flush()
    }

    clear() {
        this._Cache.clear()
        this._Store = {}
        this._Dependencies = {}
    }

    _setStore(key: string, value: ComponentDescriptionItem): void {
        this._Store[key] = value
    }

    _setDependencies(key: string, value: StateItemId[]): void {
        this._Dependencies[key] = value
    }

    async _getPromiseFactory(CharacterId: EphemeraCharacterId | 'ANONYMOUS', EphemeraId: EphemeraRoomId, options?: ComponentRenderGetOptions): Promise<{ dependencies: StateItemId[]; description: RoomDescribeData }>
    async _getPromiseFactory(CharacterId: EphemeraCharacterId | 'ANONYMOUS', EphemeraId: EphemeraFeatureId, options?: ComponentRenderGetOptions): Promise<{ dependencies: StateItemId[]; description: FeatureDescribeData }>
    async _getPromiseFactory(CharacterId: EphemeraCharacterId | 'ANONYMOUS', EphemeraId: EphemeraKnowledgeId, options?: ComponentRenderGetOptions): Promise<{ dependencies: StateItemId[]; description: KnowledgeDescribeData }>
    async _getPromiseFactory(CharacterId: EphemeraCharacterId | 'ANONYMOUS', EphemeraId: EphemeraMessageId, options?: ComponentRenderGetOptions): Promise<{ dependencies: StateItemId[]; description: MessageDescribeData }>
    async _getPromiseFactory(CharacterId: EphemeraCharacterId | 'ANONYMOUS', EphemeraId: EphemeraMapId, options?: ComponentRenderGetOptions): Promise<{ dependencies: StateItemId[]; description: MapDescribeData }>
    async _getPromiseFactory(
            CharacterId: EphemeraCharacterId | 'ANONYMOUS',
            EphemeraId: EphemeraRoomId | EphemeraFeatureId | EphemeraKnowledgeId | EphemeraMessageId | EphemeraMapId,
            getOptions?: ComponentRenderGetOptions
        ): Promise<{ dependencies: StateItemId[]; description: RoomDescribeData | FeatureDescribeData | KnowledgeDescribeData | MessageDescribeData | MapDescribeData }> {
        const [globalAssets, { assets: characterAssets }] = await Promise.all([
            this._getAssets(),
            isEphemeraCharacterId(CharacterId) ? this._characterMeta(CharacterId) : Promise.resolve({ assets: [] })
        ])
        const allAssets = unique(globalAssets || [], characterAssets) as string[]
        const appearancesByAsset = await this._componentMeta(EphemeraId, allAssets)

        const remapSchemaTagKeys = <T extends SchemaTag>(tag: T, keyMapping: Record<string, EphemeraId>): T | undefined => {
            if (isSchemaLink(tag)) {
                const remappedTarget = keyMapping[tag.to]
                if (remappedTarget) {
                    return {
                        ...tag,
                        to: remappedTarget
                    }
                }
                else {
                    return undefined
                }
            }
            if (isSchemaRoom(tag)) {
                const remappedKey = keyMapping[tag.key]
                if (remappedKey) {
                    return {
                        ...tag,
                        key: remappedKey
                    }
                }
                else {
                    return undefined
                }
            }
            if (isSchemaExit(tag)) {
                const remappedTarget = keyMapping[tag.to]
                if (remappedTarget) {
                    return {
                        ...tag,
                        to: remappedTarget
                    }
                }
                else {
                    return undefined
                }
            }
            return tag
        }
        const remapKeys = <T extends SchemaTag>(tree: GenericTree<T>, keyMapping: Record<string, EphemeraId>): GenericTree<T> => {
            return tree.map((node) => {
                const remappedNode = remapSchemaTagKeys(node.data, keyMapping)
                if (remappedNode) {
                    return [{
                        data: remappedNode,
                        children: remapKeys(node.children, keyMapping)
                    }]
                }
                else {
                    return []
                }
            }).flat(1)
        }
        const evaluateSchemaOutputPromise = async <T extends ComponentMetaItem>(assetData: T[], key: { [P in keyof T]: T[P] extends EditWrappedStandardNode<SchemaTag, SchemaOutputTag> ? P : never }[keyof T]): Promise<GenericTree<SchemaOutputTag>> => (
            compressStrings((await Promise.all(assetData.map(async (data) => {
                const evaluatedConditionals = await evaluateSchemaConditionals(this._evaluateCode.bind(this), isSchemaOutputTag)(data[key] ? (unwrapSubject(data[key] as any)?.children ?? []) as GenericTree<SchemaOutputTag> : [], data.stateMapping)
                const remappedValue = remapKeys<SchemaOutputTag>(evaluatedConditionals, data.keyMapping)
                return remappedValue
            }))).flat(1))
        )
        const evaluateSchemaPromise = <T extends ComponentMetaItem>(
            assetData: T[],
            key: { [P in keyof T]: T[P] extends EditWrappedStandardNode<SchemaTag, SchemaOutputTag> ? P : never }[keyof T]
        ): Promise<GenericTree<SchemaTag>> => (
            Promise.all(assetData.map(async (data) => {
                const evaluatedSchema = await evaluateSchemaConditionals(this._evaluateCode.bind(this))(data[key] as GenericTree<SchemaTag>, data.stateMapping)
                if ('keyMapping' in data) {
                    return remapKeys(evaluatedSchema, data.keyMapping)
                }
                else {
                    return evaluatedSchema
                }
            })).then((tagLists) => (tagLists.flat(1)))
        )
        const mapEvaluatedSchemaOutputPromise = async <
            T extends StandardComponentData,
            O extends RoomDescribeData | FeatureDescribeData | KnowledgeDescribeData | MessageDescribeData | MapDescribeData
        >(
            nameMapping: {
                [P in { [P in keyof T]: T[P] extends EditWrappedStandardNode<SchemaTag, SchemaOutputTag> ? P : never }[keyof T]]: { [P in keyof O]: O[P] extends RenderTree ? P : never }[keyof O]
            },
            excluded: ({ [P in keyof T]: T[P] extends EditWrappedStandardNode<SchemaTag, SchemaOutputTag> ? P : never }[keyof T])[] = []
        ): Promise<Pick<O, { [P in keyof O]: O[P] extends RenderTree ? P : never }[keyof O]>> => {
            const assetData = allAssets.map((assetId) => (appearancesByAsset[assetId] ? [appearancesByAsset[assetId]] : [])).flat(1) as unknown as ComponentMetaItem<T>[]
            //
            // Extract selectors from storage, and evaluate with local mappings
            //
            const remapped = Object.entries(nameMapping).map(([from, to]) => ({
                from: from as { [P in keyof T]: T[P] extends EditWrappedStandardNode<SchemaTag, SchemaOutputTag> ? P : never }[keyof T],
                to: to as { [P in keyof O]: O[P] extends RenderTree ? P : never }[keyof O]
            }))
            const evaluatePromise = await Promise.all(remapped.map(({ from }) => (excluded.includes(from) ? Promise.resolve([]) : evaluateSchemaOutputPromise(assetData as any, from as any))))
            return Object.assign({}, ...evaluatePromise.map((output, index) => ({ [remapped[index].to]: output }))) as unknown as
                Pick<O, { [P in keyof O]: O[P] extends RenderTree ? P : never }[keyof O]>
        }
        
        if (isEphemeraRoomId(EphemeraId)) {
            const assets = Object.assign({}, ...allAssets
                .filter((assetId) => (Boolean(appearancesByAsset[assetId])))
                .map((assetId): Record<EphemeraAssetId, string> => ({ [`ASSET#${assetId}`]: appearancesByAsset[assetId].key })))
            const assetData = allAssets.map((assetId) => (appearancesByAsset[assetId] ? [appearancesByAsset[assetId]] : [])).flat(1)
            const exampleMap = await this._examples([EphemeraId])
            const naiveFirstExample = exampleMap[EphemeraId]?.[0]?.examples?.[0]
            const [roomCharacterList, exits, rest] = (await Promise.all([
                this._roomCharacterList(EphemeraId),
                evaluateSchemaPromise(assetData, 'exits' as any),
                mapEvaluatedSchemaOutputPromise<StandardRoom, RoomDescribeData>({ shortName: 'ShortName' }, [])
            ]))
            return {
                dependencies: assetData.reduce<StateItemId[]>((previous, { stateMapping }) => (unique(previous, Object.values(stateMapping))), []),
                description: {
                    RoomId: EphemeraId,
                    Characters: roomCharacterList.map(({ EphemeraId, SessionIds, ...rest }) => ({ CharacterId: EphemeraId, ...rest })),
                    assets,
                    Exits: exits.map(({ data, children }) => (isSchemaExit(data) ? [{ Name: schemaOutputToString(treeTypeGuard({ tree: children, typeGuard: isSchemaOutputTag })), RoomId: data.to as EphemeraRoomId, Visibility: 'Public' as const }] : [])).flat(1),
                    ...rest,
                    Name: naiveFirstExample.toNDJSON().name ?? [],
                    ...((getOptions && ('header' in getOptions) && getOptions.header)
                        ? { Summary: naiveFirstExample.toNDJSON().summary ?? [], Description: [] }
                        : { Description: naiveFirstExample.toNDJSON().description ?? [], Summary: [] }
                    )
                }
            }
        }
        if (isEphemeraFeatureId(EphemeraId) || isEphemeraKnowledgeId(EphemeraId)) {
            const assets = Object.assign({}, ...allAssets
                .filter((assetId) => (Boolean(appearancesByAsset[assetId])))
                .map((assetId): Record<EphemeraAssetId, string> => ({ [`ASSET#${assetId}`]: appearancesByAsset[assetId].key })))
            const assetData = allAssets.map((assetId) => (appearancesByAsset[assetId] ? [appearancesByAsset[assetId]] : [])).flat(1) as ComponentMetaItem<StandardFeature>[]
            const exampleMap = await this._examples([EphemeraId])
            const naiveFirstExample = exampleMap[EphemeraId]?.[0]?.examples?.[0]
            return {
                dependencies: assetData.reduce<StateItemId[]>((previous, { stateMapping }) => (unique(previous, Object.values(stateMapping))), []),
                description: {
                    ...(isEphemeraFeatureId(EphemeraId) ? { FeatureId: EphemeraId } : { KnowledgeId: EphemeraId }),
                    assets,
                    Name: naiveFirstExample.toNDJSON().name ?? [],
                    Description: naiveFirstExample.toNDJSON().description ?? []
                }
            }
        }
        if (isEphemeraMessageId(EphemeraId)) {
            const assets = Object.assign({}, ...allAssets
                .filter((assetId) => (Boolean(appearancesByAsset[assetId])))
                .map((assetId): Record<EphemeraAssetId, string> => ({ [`ASSET#${assetId}`]: appearancesByAsset[assetId].key })))
            const assetData = allAssets.map((assetId) => (appearancesByAsset[assetId] ? [appearancesByAsset[assetId]] : [])).flat(1) as ComponentMetaItem<StandardMessage>[]
            const { Description } = await mapEvaluatedSchemaOutputPromise<StandardMessage, MessageDescribeData>({ render: 'Description' })
            return {
                dependencies: assetData.reduce<StateItemId[]>((previous, { stateMapping }) => (unique(previous, Object.values(stateMapping))), []),
                description: {
                    MessageId: EphemeraId,
                    assets,
                    rooms: unique(...assetData.map(({ rooms }) => (rooms.filter(treeNodeTypeguard(isSchemaRoom)).map(({ data }) => (data.key)).filter(isEphemeraRoomId)))),
                    Description
                }
            }
        }
        if (isEphemeraMapId(EphemeraId)) {
            const assets = Object.assign({}, ...allAssets
                .filter((assetId) => (Boolean(appearancesByAsset[assetId].key)))
                .map((assetId): Record<EphemeraAssetId, string> => ({ [`ASSET#${assetId}`]: appearancesByAsset[assetId].key })))
            const assetData = allAssets.map((assetId) => (appearancesByAsset[assetId]?.key ? [appearancesByAsset[assetId]] : [])).flat(1) as ComponentMetaItem<StandardMap>[]
            //
            // TODO: Refactor mapRoom handling to use GenericTree<SchemaTag> instead of bespoke MapRoom structures
            //
            const roomPositions = Object.assign({}, ...(await Promise.all(
                allAssets.map(async (assetId) => {
                    const localAssetData = appearancesByAsset[assetId]
                    if (!(localAssetData && isStandardMap(localAssetData))) {
                        return {}
                    }
                    const evaluatedSchema = await evaluateSchemaConditionals(this._evaluateCode.bind(this))(localAssetData.positions as GenericTree<SchemaTag>, localAssetData.stateMapping)
                    return Object.assign(
                        {},
                        ...evaluatedSchema.map(({ data, children }) => {
                            const position = children.map(({ data }) => (data)).find(isSchemaPosition)
                            if (!(isSchemaRoom(data) && position)) {
                                return {}
                            }
                            const universalKey = localAssetData.keyMapping[data.key]
                            if (!universalKey) {
                                return {}
                            }
                            return { [universalKey]: { x: position.x, y: position.y } }
                        })
                    )
                })
            ))) as Record<EphemeraRoomId, { x: number, y: number }>
            //
            // Figure out how to properly map room keys to EphemeraId during extraction phases above
            //
            const allRooms = Object.keys(roomPositions) as EphemeraRoomId[]
            const roomMetaPromise = Promise.all(allRooms.map(async (ephemeraId) => {
                const metaByAsset = await this._componentMeta(ephemeraId, unique(globalAssets || [], characterAssets) as string[])
                const roomAssetAppearances = allAssets.map((assetId) => {
                    const room = metaByAsset[assetId]
                    return isStandardRoom(room) ? [room as ComponentMetaItem<StandardRoom>] : []
                }).flat(1)
                const [name, exits] = await Promise.all([
                    evaluateSchemaOutputPromise(roomAssetAppearances, 'shortName' as any),
                    evaluateSchemaPromise(roomAssetAppearances, 'exits' as any)
                ])
                return {
                    roomId: ephemeraId,
                    name: schemaOutputToString(name),
                    exits: exits
                        .filter(treeNodeTypeguard(isSchemaExit))
                        .filter(({ data: { to } }) => (isEphemeraRoomId(to) && allRooms.includes(to)))
                        .map(({ data, children }) => ({
                            name: schemaOutputToString(treeTypeGuard({ tree: children, typeGuard: isSchemaOutputTag })),
                            to: data.to as EphemeraRoomId
                        })),
                    x: roomPositions[ephemeraId].x,
                    y: roomPositions[ephemeraId].y
                }
            }))
            const [rooms, fileURLs, rest] = await Promise.all([
                roomMetaPromise,
                Promise.all(
                    (allAssets.map((assetId) => (appearancesByAsset[assetId] ? [{ data: appearancesByAsset[assetId], assetId }] : [])).flat(1) as { data: ComponentMetaItem<StandardMap>, assetId }[])
                        .map(async ({ data }) => (evaluateSchemaConditionals(this._evaluateCode.bind(this))(data.images as GenericTree<SchemaTag>, data.stateMapping)))
                        .map((promise) => (promise.then((tagList) => (tagList.map(({ data }) => (isSchemaImage(data) && data.fileURL ? [data.fileURL] : [])).flat(1)))))
                    ).then((tagLists) => (tagLists.flat(1))
                ),
                mapEvaluatedSchemaOutputPromise<StandardMap, MapDescribeData>({ name: 'name' }),
            ])
            return {
                dependencies: assetData.reduce<StateItemId[]>((previous, { stateMapping }) => (unique(previous, Object.values(stateMapping))), []),
                description: {
                    MapId: EphemeraId,
                    assets,
                    fileURL: fileURLs.reduce<string>((previous, fileURL) => (previous || fileURL), ''),
                    rooms,
                    ...rest
                }
            }

        }
        throw new Error('Illegal tag in ComponentDescription internalCache')
    }

    async get(CharacterId: EphemeraCharacterId | 'ANONYMOUS', EphemeraId: EphemeraRoomId, options?: ComponentRenderGetOptions): Promise<RoomDescribeData>
    async get(CharacterId: EphemeraCharacterId | 'ANONYMOUS', EphemeraId: EphemeraFeatureId, options?: ComponentRenderGetOptions): Promise<FeatureDescribeData>
    async get(CharacterId: EphemeraCharacterId | 'ANONYMOUS', EphemeraId: EphemeraKnowledgeId, options?: ComponentRenderGetOptions): Promise<KnowledgeDescribeData>
    async get(CharacterId: EphemeraCharacterId | 'ANONYMOUS', EphemeraId: EphemeraMapId, options?: ComponentRenderGetOptions): Promise<MapDescribeData>
    async get(CharacterId: EphemeraCharacterId | 'ANONYMOUS', EphemeraId: EphemeraMessageId, options?: ComponentRenderGetOptions): Promise<MessageDescribeData>
    async get(CharacterId: EphemeraCharacterId | 'ANONYMOUS', EphemeraId: EphemeraFeatureId | EphemeraKnowledgeId | EphemeraRoomId | EphemeraMapId | EphemeraMessageId, options?: ComponentRenderGetOptions): Promise<ComponentDescriptionItem>
    async get(CharacterId: EphemeraCharacterId | 'ANONYMOUS', EphemeraId: EphemeraFeatureId | EphemeraKnowledgeId | EphemeraRoomId | EphemeraMapId | EphemeraMessageId, options?: ComponentRenderGetOptions): Promise<ComponentDescriptionItem> {
        const cacheKey = generateCacheKey(CharacterId, EphemeraId, options)
        if (!this._Cache.isCached(cacheKey)) {
            //
            // TODO: Figure out how to convince Typescript to evaluate each branch independently, *without* having
            // to copy each branch explicitly
            //
            if (isEphemeraRoomId(EphemeraId)) {
                this._Cache.add({
                    promiseFactory: () => (
                        (options && 'header' in options && options.header) ? this._getPromiseFactory(CharacterId, EphemeraId, options): this._getPromiseFactory(CharacterId, EphemeraId, { priorRenderChain: options?.priorRenderChain })),
                    requiredKeys: [cacheKey],
                    transform: (fetch) => {
                        if (typeof fetch === 'undefined') {
                            return {}
                        }
                        else {
                            return {
                                [cacheKey]: fetch
                            }
                        }
                    }
                })
            }
            if (isEphemeraFeatureId(EphemeraId)) {
                this._Cache.add({
                    promiseFactory: () => (this._getPromiseFactory(CharacterId, EphemeraId, options)),
                    requiredKeys: [cacheKey],
                    transform: (fetch) => {
                        if (typeof fetch === 'undefined') {
                            return {}
                        }
                        else {
                            return {
                                [cacheKey]: fetch
                            }
                        }
                    }
                })
            }
            if (isEphemeraKnowledgeId(EphemeraId)) {
                this._Cache.add({
                    promiseFactory: () => (this._getPromiseFactory(CharacterId, EphemeraId, options)),
                    requiredKeys: [cacheKey],
                    transform: (fetch) => {
                        if (typeof fetch === 'undefined') {
                            return {}
                        }
                        else {
                            return {
                                [cacheKey]: fetch
                            }
                        }
                    }
                })
            }
            if (isEphemeraMessageId(EphemeraId)) {
                this._Cache.add({
                    promiseFactory: () => (this._getPromiseFactory(CharacterId, EphemeraId, options)),
                    requiredKeys: [cacheKey],
                    transform: (fetch) => {
                        if (typeof fetch === 'undefined') {
                            return {}
                        }
                        else {
                            return {
                                [cacheKey]: fetch
                            }
                        }
                    }
                })
            }
            if (isEphemeraMapId(EphemeraId)) {
                this._Cache.add({
                    promiseFactory: () => (this._getPromiseFactory(CharacterId, EphemeraId, options)),
                    requiredKeys: [cacheKey],
                    transform: (fetch) => {
                        if (typeof fetch === 'undefined') {
                            return {}
                        }
                        else {
                            return {
                                [cacheKey]: fetch
                            }
                        }
                    }
                })
            }
        }
        await this._Cache.get(cacheKey)
        return this._Store[cacheKey]
    }

    invalidate(CharacterId: EphemeraCharacterId | 'ANONYMOUS', EphemeraId: EphemeraRoomId | EphemeraFeatureId | EphemeraKnowledgeId) {
        const cacheKey = generateCacheKey(CharacterId, EphemeraId)
        if (cacheKey in this._Store) {
            delete this._Store[cacheKey]
        }
        if (cacheKey in this._Cache) {
            this._Cache[cacheKey].invalidate()
        }
    }

    set(CharacterId: EphemeraCharacterId | 'ANONYMOUS', EphemeraId: EphemeraRoomId | EphemeraFeatureId | EphemeraKnowledgeId, value: ComponentDescriptionCache) {
        const cacheKey = generateCacheKey(CharacterId, EphemeraId)
        this._Cache.set(Infinity, cacheKey, value)
        this._Store[cacheKey] = value.description
        this._Dependencies[cacheKey] = value.dependencies
    }

    invalidateByEphemeraId(EphemeraId: StateItemId) {
        const cacheKeysToInvalidate = Object.entries(this._Dependencies)
            .filter(([key, dependencies]) => (dependencies.includes(EphemeraId)))
            .map(([key]) => (key))
        cacheKeysToInvalidate.forEach((key) => {
            this._Cache.invalidate(key)
            delete this._Store[key]
            delete this._Dependencies[key]
        })
    }
}

export default ComponentRenderData