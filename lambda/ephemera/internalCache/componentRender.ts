import { ComponentMeta, ComponentMetaData, ComponentMetaFromId } from './componentMeta'
import { DeferredCache } from './deferredCache'
import { EphemeraRoomAppearance, EphemeraFeatureAppearance, EphemeraMapAppearance, EphemeraCondition, EphemeraExit, EphemeraItemDependency, EphemeraMapRoom } from '../cacheAsset/baseClasses'
import { RoomDescribeData, FeatureDescribeData, MapDescribeData, TaggedMessageContentFlat, flattenTaggedMessageContent } from '@tonylb/mtw-interfaces/dist/messages'
import { CacheGlobal, CacheGlobalData } from '.';
import { componentAppearanceReduce } from '../perception/components';
import { unique } from '@tonylb/mtw-utilities/dist/lists';
import AssetState, { EvaluateCodeAddress, EvaluateCodeData, StateItemId } from './assetState';
import {
    EphemeraCharacterId,
    EphemeraComputedId,
    EphemeraFeatureId,
    EphemeraMapId,
    EphemeraRoomId,
    EphemeraVariableId,
    isEphemeraComputedId,
    isEphemeraFeatureId,
    isEphemeraMapId,
    isEphemeraRoomId,
    isEphemeraVariableId
} from '@tonylb/mtw-interfaces/dist/baseClasses';
import CacheRoomCharacterLists, { CacheRoomCharacterListsData } from './roomCharacterLists';
import { RoomCharacterListItem } from './baseClasses';
import CacheCharacterMeta, { CacheCharacterMetaData, CharacterMetaItem } from './characterMeta';
import { filterAppearances } from '../perception/utils';

export type ComponentMetaRoomItem = {
    EphemeraId: EphemeraRoomId;
    assetId: string;
    appearances: EphemeraRoomAppearance[];
}
export type ComponentMetaFeatureItem = {
    EphemeraId: EphemeraFeatureId;
    assetId: string;
    appearances: EphemeraFeatureAppearance[];
}
export type ComponentMetaMapItem = {
    EphemeraId: EphemeraMapId;
    assetId: string;
    appearances: EphemeraMapAppearance[];
}
export type ComponentDescriptionItem = RoomDescribeData | FeatureDescribeData | MapDescribeData

type ComponentDescriptionCache = {
    dependencies: StateItemId[];
    description: ComponentDescriptionItem;
}

const generateCacheKey = (CharacterId: EphemeraCharacterId, EphemeraId: EphemeraRoomId | EphemeraFeatureId | EphemeraMapId) => (`${CharacterId}::${EphemeraId}`)

export class ComponentRenderData {
    _evaluateCode: (address: EvaluateCodeAddress) => Promise<any>;
    _componentMeta: <T extends EphemeraFeatureId | EphemeraRoomId | EphemeraMapId>(EphemeraId: T, assetList: string[]) => Promise<Record<string, ComponentMetaFromId<T>>>;
    _roomCharacterList: (roomId: EphemeraRoomId) => Promise<RoomCharacterListItem[]>;
    _getAssets: () => Promise<string[]>;
    _characterMeta: (characterId: EphemeraCharacterId) => Promise<CharacterMetaItem>;
    _Cache: DeferredCache<ComponentDescriptionCache>;
    _Store: Record<string, ComponentDescriptionItem> = {}
    _Dependencies: Record<string, StateItemId[]> = {}
    
    constructor(
        evaluateCode: EvaluateCodeData,
        componentMeta: ComponentMetaData,
        roomCharacterList: CacheRoomCharacterListsData,
        globalCache: CacheGlobalData,
        characterMeta: CacheCharacterMetaData
    ) {
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
                            Name: []
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
                            Exits: [],
                            Characters: []
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

    async _getPromiseFactory(CharacterId: EphemeraCharacterId, EphemeraId: EphemeraRoomId): Promise<{ dependencies: StateItemId[]; description: RoomDescribeData }>
    async _getPromiseFactory(CharacterId: EphemeraCharacterId, EphemeraId: EphemeraFeatureId): Promise<{ dependencies: StateItemId[]; description: FeatureDescribeData }>
    async _getPromiseFactory(CharacterId: EphemeraCharacterId, EphemeraId: EphemeraMapId): Promise<{ dependencies: StateItemId[]; description: MapDescribeData }>
    async _getPromiseFactory(CharacterId: EphemeraCharacterId, EphemeraId: EphemeraRoomId | EphemeraFeatureId | EphemeraMapId): Promise<{ dependencies: StateItemId[]; description: RoomDescribeData | FeatureDescribeData | MapDescribeData }> {
        const [globalAssets, { assets: characterAssets }] = await Promise.all([
            this._getAssets(),
            this._characterMeta(CharacterId)
        ])
        const appearancesByAsset = await this._componentMeta(EphemeraId, unique(globalAssets || [], characterAssets) as string[])
        const aggregateDependencies = unique(...(Object.values(appearancesByAsset) as (ComponentMetaMapItem | ComponentMetaRoomItem | ComponentMetaFeatureItem)[])
            .map(({ appearances }) => (
                unique(...appearances.map(({ conditions }: { conditions: EphemeraCondition[] }) => (
                    unique(...conditions.map(({ dependencies }) => (
                        (Object.values(dependencies) as EphemeraItemDependency[])
                            .map(({ EphemeraId }) => (EphemeraId))
                            .filter((dependentId) => (isEphemeraComputedId(dependentId) || isEphemeraVariableId(dependentId)))
                    ))) as StateItemId[]
                ))) as StateItemId[]
            ))) as StateItemId[]

        if (isEphemeraRoomId(EphemeraId)) {
            const possibleRoomAppearances = [...(globalAssets || []), ...characterAssets]
                .map((assetId) => ((appearancesByAsset[assetId]?.appearances || []) as EphemeraRoomAppearance[]))
                .reduce<EphemeraRoomAppearance[]>((previous, appearances) => ([ ...previous, ...appearances ]), [])
            const [roomCharacterList, renderRoomAppearances] = (await Promise.all([
                this._roomCharacterList(EphemeraId),
                filterAppearances(this._evaluateCode)(possibleRoomAppearances)
            ]))
            const renderRoom = await componentAppearanceReduce(...renderRoomAppearances) as Omit<RoomDescribeData, 'RoomId' | 'Characters'>
            return {
                dependencies: aggregateDependencies,
                description: {
                    RoomId: EphemeraId,
                    Characters: roomCharacterList.map(({ EphemeraId, ConnectionIds, ...rest }) => ({ CharacterId: EphemeraId, ...rest })),
                    ...renderRoom
                }
            }
        }
        if (isEphemeraFeatureId(EphemeraId)) {
            const possibleFeatureAppearances = [...(globalAssets || []), ...characterAssets]
                .map((assetId) => ((appearancesByAsset[assetId]?.appearances || []) as EphemeraFeatureAppearance[]))
                .reduce<EphemeraFeatureAppearance[]>((previous, appearances) => ([ ...previous, ...appearances ]), [])
            const renderFeatureAppearances = await filterAppearances(this._evaluateCode)(possibleFeatureAppearances)
            const renderFeature = await componentAppearanceReduce(...renderFeatureAppearances)
            return {
                dependencies: aggregateDependencies,
                description: {
                    FeatureId: EphemeraId,
                    ...renderFeature
                }
            }
        }
        if (isEphemeraMapId(EphemeraId)) {
            const possibleMapAppearances = [...(globalAssets || []), ...characterAssets]
                .map((assetId) => ((appearancesByAsset[assetId]?.appearances || []) as EphemeraMapAppearance[]))
                .reduce<EphemeraMapAppearance[]>((previous, appearances) => ([ ...previous, ...appearances ]), [])
            const renderMapAppearances = await filterAppearances(this._evaluateCode)(possibleMapAppearances)
            const flattenedRooms = await filterAppearances(this._evaluateCode)(renderMapAppearances.reduce<EphemeraMapRoom[]>((previous, { rooms }) => ([ ...previous, ...rooms ]), []))
            const allRooms = (unique(flattenedRooms.map(({ EphemeraId }) => (EphemeraId))) as string[])
                .filter(isEphemeraRoomId)
            const roomPositions = flattenedRooms
                .reduce<Record<EphemeraRoomId, { x: number; y: number }>>((previous, room) => (
                    { ...previous, [room.EphemeraId]: { x: room.x, y: room.y } }
                ), {})
            const roomMetas = await Promise.all(allRooms.map(async (ephemeraId) => {
                const metaByAsset = await this._componentMeta(ephemeraId, unique(globalAssets || [], characterAssets) as string[])
                const possibleRoomAppearances = [...(globalAssets || []), ...characterAssets]
                    .map((assetId) => (((metaByAsset[assetId]?.appearances || []) as EphemeraRoomAppearance[])
                        .filter(({ name, exits }) => (name.length || exits.find(({ to }) => (isEphemeraRoomId(to) &&  allRooms.includes(to)))))
                    ))
                    .reduce<EphemeraRoomAppearance[]>((previous, appearances) => ([ ...previous, ...appearances ]), [])
                const renderRoomMapAppearances = await filterAppearances(this._evaluateCode)(possibleRoomAppearances)
                const flattenedNames = await Promise.all(
                    renderRoomMapAppearances.map(({ name }) => (
                        flattenTaggedMessageContent(name)
                    ))
                )
        
                const aggregateRoomDescription = {
                    roomId: ephemeraId,
                    name: flattenedNames.reduce<TaggedMessageContentFlat[]>((previous, name) => ([ ...previous, ...name ]), []),
                    x: roomPositions[ephemeraId].x,
                    y: roomPositions[ephemeraId].y,
                    exits: Object.values(renderRoomMapAppearances
                        .map(({ exits }) => (exits.filter(({ to }) => (isEphemeraRoomId(to) && allRooms.includes(to)))))
                        .reduce<Record<string, EphemeraExit>>((previous, exits) => (
                            exits.reduce<Record<string, EphemeraExit>>((accumulator, exit) => ({
                                ...accumulator,
                                [exit.to]: exit
                            }), previous)
                        ), {}))
                }
                return aggregateRoomDescription
            }))

            const flattenedNames = await Promise.all(
                renderMapAppearances.map(({ name }) => (
                    flattenTaggedMessageContent(name)
                ))
            )
            return {
                dependencies: aggregateDependencies,
                description: {
                    MapId: EphemeraId,
                    Name: flattenedNames.reduce<TaggedMessageContentFlat[]>((previous, name) => ([ ...previous, ...name ]), []),
                    fileURL: renderMapAppearances
                        .map(({ fileURL }) => (fileURL))
                        .filter((value) => (value))
                        .reduce((previous, value) => (value || previous), ''),
                    rooms: roomMetas
                }
            }

        }
        throw new Error('Illegal tag in ComponentDescription internalCache')
    }

    async get(CharacterId: EphemeraCharacterId, EphemeraId: EphemeraRoomId): Promise<RoomDescribeData>
    async get(CharacterId: EphemeraCharacterId, EphemeraId: EphemeraFeatureId): Promise<FeatureDescribeData>
    async get(CharacterId: EphemeraCharacterId, EphemeraId: EphemeraMapId): Promise<MapDescribeData>
    async get(CharacterId: EphemeraCharacterId, EphemeraId: EphemeraFeatureId | EphemeraRoomId | EphemeraMapId): Promise<ComponentDescriptionItem>
    async get(CharacterId: EphemeraCharacterId, EphemeraId: EphemeraFeatureId | EphemeraRoomId | EphemeraMapId): Promise<ComponentDescriptionItem> {
        const cacheKey = generateCacheKey(CharacterId, EphemeraId)
        if (!this._Cache.isCached(cacheKey)) {
            //
            // TODO: Figure out how to convince Typescript to evaluate each branch independently, *without* having
            // to copy each branch explicitly
            //
            if (isEphemeraRoomId(EphemeraId)) {
                this._Cache.add({
                    promiseFactory: () => (this._getPromiseFactory(CharacterId, EphemeraId)),
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
                    promiseFactory: () => (this._getPromiseFactory(CharacterId, EphemeraId)),
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
                    promiseFactory: () => (this._getPromiseFactory(CharacterId, EphemeraId)),
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

    invalidate(CharacterId: EphemeraCharacterId, EphemeraId: EphemeraRoomId | EphemeraFeatureId) {
        const cacheKey = generateCacheKey(CharacterId, EphemeraId)
        if (cacheKey in this._Store) {
            delete this._Store[cacheKey]
        }
        if (cacheKey in this._Cache) {
            this._Cache[cacheKey].invalidate()
        }
    }

    set(CharacterId: EphemeraCharacterId, EphemeraId: EphemeraRoomId | EphemeraFeatureId, value: ComponentDescriptionCache) {
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

export const ComponentRender = <GBase extends (
        ReturnType<typeof ComponentMeta> &
        ReturnType<typeof AssetState> &
        ReturnType<typeof CacheRoomCharacterLists> &
        ReturnType<typeof CacheGlobal> &
        ReturnType<typeof CacheCharacterMeta>
    )>(Base: GBase) => {
    return class ComponentMeta extends Base {
        ComponentRender: ComponentRenderData;

        constructor(...rest: any) {
            super(...rest)
            this.ComponentRender = new ComponentRenderData(
                this.EvaluateCode,
                this.ComponentMeta,
                this.RoomCharacterList,
                this.Global,
                this.CharacterMeta
            )
        }
        override clear() {
            this.ComponentRender.clear()
            super.clear()
        }
        override async flush() {
            await Promise.all([
                this.ComponentRender.flush(),
                super.flush()
            ])
        }
        override _invalidateAssetCallback(EphemeraId: StateItemId): void {
            super._invalidateAssetCallback(EphemeraId)
            this.ComponentRender.invalidateByEphemeraId(EphemeraId)
        }
    }
}

export default ComponentRender
