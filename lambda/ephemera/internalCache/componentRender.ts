import { ComponentMetaData } from './componentMeta'
import { DeferredCache } from './deferredCache'
import { EphemeraCondition } from '../cacheAsset/baseClasses'
import { RoomDescribeData, FeatureDescribeData, MapDescribeData, KnowledgeDescribeData, RoomExit } from '@tonylb/mtw-interfaces/ts/messages'
import CacheGlobalData from './global';
import { excludeUndefined, unique } from '@tonylb/mtw-utilities/ts/lists';
import { AssetStateMapping, EvaluateCodeAddress, EvaluateCodeData } from './assetState';
import {
    EphemeraCharacterId,
    EphemeraComputedId,
    EphemeraFeatureId,
    EphemeraKnowledgeId,
    EphemeraMapId,
    EphemeraMessageId,
    EphemeraRoomId,
    EphemeraVariableId,
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
import { AssetKey, splitType } from '@tonylb/mtw-utilities/ts/types';
import { GenericTree } from '@tonylb/mtw-base/ts/genericTree';
import { treeTypeGuard } from '@tonylb/mtw-wml/ts/tree/filter';
import { ExampleComponentId, ExamplesData, ExamplesReturn } from './examples';
import { CacheRoomCharacterListsData } from './roomCharacterLists';
import { AssetUUID, ComponentUUID, SchemaTag } from '@tonylb/mtw-base/ts/schema';
import { isSchemaCondition, isSchemaConditionFallthrough, isSchemaConditionStatement } from '@tonylb/mtw-base/ts/schema/condition';
import { RenderTree } from '@tonylb/mtw-base/ts/renderTree';
import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses';
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference';
import { mergeStandardExitList } from '@tonylb/mtw-wml/ts/standardize/components/exit';
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room';
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal';
import { StandardRender } from '@tonylb/mtw-wml/ts/standardize/render';
import StandardMessage from '@tonylb/mtw-wml/ts/standardize/components/message';
import StandardMap from '@tonylb/mtw-wml/ts/standardize/components/map';

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

export const isComponentTag = (tag) => (['Room', 'Feature'].includes(tag))

export const isComponentKey = (key) => (['ROOM', 'FEATURE'].includes(splitType(key)[0]))

export class ComponentRenderData {
    _examples: (keys: ExampleComponentId[]) => Promise<Record<ExampleComponentId, ExamplesReturn[]>>;
    _evaluateCode: (address: EvaluateCodeAddress) => Promise<any>;
    _componentMeta: (EphemeraId: ComponentUUID, assetList: AssetUUID[]) => Promise<Record<AssetUUID, StandardComponent>>;
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
                            assets: []
                        }
                    }
                }
                if (isEphemeraRoomId(cacheKey)) {
                    return {
                        dependencies: [],
                        description: {
                            RoomId: cacheKey,
                            Description: [],
                            Name: [],
                            Summary: [],
                            Exits: [],
                            Characters: [],
                            assets: []
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
        const allAssets: AssetUUID[] = unique(globalAssets || [], characterAssets).map((key) => (AssetKey(key)))
        const appearancesByAsset = await this._componentMeta(EphemeraId, allAssets.map((key) => (AssetKey(key)))) as Record<AssetUUID, StandardComponent>
        
        if (isEphemeraRoomId(EphemeraId)) {
            const assets = allAssets
                .filter((assetId) => (Boolean(appearancesByAsset[assetId])))
            const assetData = allAssets.map((assetId) => (appearancesByAsset[assetId] ? [appearancesByAsset[assetId]] : [])).flat(1) as StandardRoom[]
            const exampleMap = await this._examples([EphemeraId])
            const naiveFirstExample = exampleMap[EphemeraId]?.[0]?.examples?.[0]
            const [roomCharacterList, exits, shortName] = (await Promise.all([
                this._roomCharacterList(EphemeraId),
                mergeStandardExitList(assetData.map((asset) => (asset.exits || [])).flat(1)).map((exit) => (exit._payload.plain.toJSON())),
                assetData
                    .map((component) => (component.shortName))
                    .filter(excludeUndefined)
                    .reduce<StandardLiteral | undefined>((previous, current: StandardLiteral) => (previous ? previous.merge(current) : current), undefined)
            ]))
            return {
                dependencies: [],
                description: {
                    RoomId: EphemeraId,
                    Characters: roomCharacterList.map(({ EphemeraId, SessionIds, ...rest }) => ({ CharacterId: EphemeraId, ...rest })),
                    assets,
                    Exits: exits.map((exit): RoomExit => ({ Name: new StandardRender(exit.description)._payload.plain.toJSON()[0] as string, RoomId: exit.to as EphemeraRoomId, Visibility: 'Public' as const })),
                    ShortName: shortName?._payload?.plain?.toJSON?.() as string,
                    Name: naiveFirstExample.name ?? [],
                    ...((getOptions && ('header' in getOptions) && getOptions.header)
                        ? { Summary: naiveFirstExample.summary ?? [], Description: [] }
                        : { Description: naiveFirstExample.description ?? [], Summary: [] }
                    )
                }
            }
        }
        if (isEphemeraFeatureId(EphemeraId)) {
            const assets = allAssets
                .filter((assetId) => (Boolean(appearancesByAsset[assetId])))
            const exampleMap = await this._examples([EphemeraId])
            const naiveFirstExample = exampleMap[EphemeraId]?.[0]?.examples?.[0]
            return {
                dependencies: [],
                description: {
                    FeatureId: EphemeraId,
                    assets,
                    Name: naiveFirstExample.name ?? [],
                    Description: naiveFirstExample.description ?? []
                }
            }
        }
        if (isEphemeraKnowledgeId(EphemeraId)) {
            const assets = allAssets
                .filter((assetId) => (Boolean(appearancesByAsset[assetId])))
            const exampleMap = await this._examples([EphemeraId])
            const naiveFirstExample = exampleMap[EphemeraId]?.[0]?.examples?.[0]
            return {
                dependencies: [],
                description: {
                    KnowledgeId: EphemeraId,
                    assets,
                    Name: naiveFirstExample.name ?? [],
                    Description: naiveFirstExample.description ?? []
                }
            }
        }
        if (isEphemeraMessageId(EphemeraId)) {
            const assets = allAssets
                .filter((assetId) => (Boolean(appearancesByAsset[assetId])))
            const assetData = allAssets.map((assetId) => (appearancesByAsset[assetId] ? [appearancesByAsset[assetId]] : [])).flat(1) as StandardMessage[]
            const merged = assetData.reduce<StandardMessage | undefined>((previous, current) => (previous ? previous.merge(current) as StandardMessage | undefined : current), undefined)
            const { description = new StandardRender([]) } = merged ?? {}
            return {
                dependencies: [],
                description: {
                    MessageId: EphemeraId,
                    assets,
                    rooms: assetData.map(({ rooms }) => (rooms.map((data) => (new StandardReference(data)._payload.plain.universalKey as EphemeraRoomId | undefined)))).flat(1).filter(excludeUndefined),
                    Description: description.toJSON()
                }
            }
        }
        if (isEphemeraMapId(EphemeraId)) {
            const assets = allAssets
                .filter((assetId) => (Boolean(appearancesByAsset[assetId])))
            const assetData = allAssets.map((assetId) => (appearancesByAsset[assetId] ? [appearancesByAsset[assetId]] : [])).flat(1) as StandardMap[]
            const merged = assetData.reduce<StandardMap | undefined>((previous, current) => (previous ? previous.merge(current) as StandardMap | undefined : current), undefined)
            //
            // Figure out how to properly map room keys to EphemeraId during extraction phases above
            //
            const roomMetaPromise = Promise.all((merged?.positions ?? []).map(async (position) => {
                const ephemeraId = position.room._payload.plain.universalKey as EphemeraRoomId
                const metaByAsset = await this._componentMeta(ephemeraId, unique(globalAssets || [], characterAssets) as AssetUUID[])
                const roomMeta = allAssets
                    .map((assetId) => (metaByAsset[assetId] ? [metaByAsset[assetId]] : []))
                    .flat(1) as StandardRoom[]
                const mergedRoom = roomMeta.reduce<StandardRoom | undefined>((previous, current) => (previous ? previous.merge(current) as StandardRoom | undefined : current), undefined)
                return {
                    roomId: ephemeraId,
                    name: mergedRoom?.shortName?._payload?.plain?.toJSON?.() as string,
                    exits: (mergedRoom?.exits ?? [])
                        .filter((exit) => (Boolean(merged && merged.positions.find((position) => (position.room._payload.plain.equals(exit._payload.plain.to))))))
                        .map((exit) => ({ name: exit._payload.plain.description?._payload?.plain?.toJSON?.() ?? '' as string, to: exit._payload.plain.to.toJSON() as EphemeraRoomId })),
                    x: position.x,
                    y: position.y
                }
            }))
            const [rooms, fileURLs, rest] = await Promise.all([
                roomMetaPromise,
                [],
                { name: merged?.name?._payload?.plain?.toJSON?.() },
            ])
            return {
                dependencies: [],
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