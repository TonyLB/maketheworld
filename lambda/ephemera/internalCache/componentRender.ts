import { splitType } from '@tonylb/mtw-utilities/dist/types';
import { ComponentMeta } from './componentMeta'
import { DeferredCache } from './deferredCache'
import { EphemeraRoomAppearance, EphemeraFeatureAppearance, EphemeraMapAppearance, EphemeraCondition, EphemeraExit, EphemeraItemDependency } from '../cacheAsset/baseClasses'
import { RoomDescribeData, FeatureDescribeData, MapDescribeData } from '@tonylb/mtw-interfaces/dist/messages'
import internalCache from '.';
import { componentAppearanceReduce } from '../perception/components';
import { unique } from '@tonylb/mtw-utilities/dist/lists';
import AssetState, { StateItemId } from './assetState';
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
} from '@tonylb/mtw-interfaces/dist/ephemera';

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

const filterAppearances = async <T extends { conditions: EphemeraCondition[] }>(possibleAppearances: T[]): Promise<T[]> => {
    //
    // TODO: Aggregate and also return a dependencies map of source and mappings, so that the cache can search
    // for dependencies upon a certain evaluation code and invalidate the render when that evaluation has been
    // invalidated
    //
    const allPromises = possibleAppearances
        .map(async (appearance): Promise<T | undefined> => {
            const conditionsPassList = await Promise.all(appearance.conditions.map(({ if: source, dependencies }) => (
                internalCache.EvaluateCode.get({
                    source,
                    mapping: dependencies
                        .reduce<Record<string, EphemeraComputedId | EphemeraVariableId>>((previous, { EphemeraId, key }) => (
                            (key && (isEphemeraComputedId(EphemeraId) || isEphemeraVariableId(EphemeraId)))
                                ? { ...previous, [key]: EphemeraId }
                                : previous
                            ), {})
                })
            )))
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

export class ComponentRenderData {
    _Cache: DeferredCache<ComponentDescriptionCache>;
    _Store: Record<string, ComponentDescriptionItem> = {}
    _Dependencies: Record<string, StateItemId[]> = {}
    
    constructor() {
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
                            Name: ''
                        }
                    }
                }
                if (isEphemeraRoomId(cacheKey)) {
                    return {
                        dependencies: [],
                        description: {
                            RoomId: cacheKey,
                            Description: [],
                            Name: '',
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
            internalCache.Global.get('assets'),
            internalCache.CharacterMeta.get(splitType(CharacterId)[1])
        ])
        const appearancesByAsset = await internalCache.ComponentMeta.getAcrossAssets(EphemeraId, unique(globalAssets || [], characterAssets) as string[])
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
            const RoomId = splitType(EphemeraId)[1]
            const possibleRoomAppearances = [...(globalAssets || []), ...characterAssets]
                .map((assetId) => ((appearancesByAsset[assetId]?.appearances || []) as EphemeraRoomAppearance[]))
                .reduce<EphemeraRoomAppearance[]>((previous, appearances) => ([ ...previous, ...appearances ]), [])
            const [roomCharacterList, renderRoomAppearances] = (await Promise.all([
                internalCache.RoomCharacterList.get(RoomId),
                filterAppearances(possibleRoomAppearances)
            ]))
            const renderRoom = componentAppearanceReduce(...renderRoomAppearances) as Omit<RoomDescribeData, 'RoomId' | 'Characters'>
            return {
                dependencies: aggregateDependencies,
                description: {
                    RoomId: EphemeraId,
                    Characters: roomCharacterList.map(({ EphemeraId, ConnectionIds, ...rest }) => ({ CharacterId: splitType(EphemeraId)[1], ...rest })),
                    ...renderRoom
                }
            }
        }
        if (isEphemeraFeatureId(EphemeraId)) {
            const possibleFeatureAppearances = [...(globalAssets || []), ...characterAssets]
                .map((assetId) => ((appearancesByAsset[assetId]?.appearances || []) as EphemeraFeatureAppearance[]))
                .reduce<EphemeraFeatureAppearance[]>((previous, appearances) => ([ ...previous, ...appearances ]), [])
            const renderFeatureAppearances = await filterAppearances(possibleFeatureAppearances)
            const renderFeature = componentAppearanceReduce(...renderFeatureAppearances)
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
            const renderMapAppearances = await filterAppearances(possibleMapAppearances)
            const allRooms = (unique(...renderMapAppearances.map(({ rooms }) => (Object.values(rooms).map(({ EphemeraId }) => (EphemeraId))))) as string[])
                .filter(isEphemeraRoomId)
            const roomPositions = renderMapAppearances
                .map(({ rooms }) => (rooms))
                .reduce<Record<EphemeraRoomId, { x: number; y: number }>>((previous, rooms) => (
                    Object.values(rooms).reduce((accumulator, room) => ({ ...accumulator, [room.EphemeraId]: { x: room.x, y: room.y } }), previous)
                ), {})
            const roomMetas = await Promise.all(allRooms.map(async (ephemeraId) => {
                const metaByAsset = await internalCache.ComponentMeta.getAcrossAssets(ephemeraId, unique(globalAssets || [], characterAssets) as string[])
                const possibleRoomAppearances = [...(globalAssets || []), ...characterAssets]
                    .map((assetId) => (((metaByAsset[assetId]?.appearances || []) as EphemeraRoomAppearance[])
                        .filter(({ name, exits }) => (name || exits.find(({ to }) => (isEphemeraRoomId(to) &&  allRooms.includes(to)))))
                    ))
                    .reduce<EphemeraRoomAppearance[]>((previous, appearances) => ([ ...previous, ...appearances ]), [])
                const renderRoomMapAppearances = await filterAppearances(possibleRoomAppearances)
                const aggregateRoomDescription = {
                    roomId: splitType(ephemeraId)[1],
                    name: renderRoomMapAppearances.map(({ name }) => (name)).join(''),
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
            return {
                dependencies: aggregateDependencies,
                description: {
                    MapId: EphemeraId,
                    Name: renderMapAppearances.map(({ name }) => (name)).join(''),
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

export const ComponentRender = <GBase extends ReturnType<typeof ComponentMeta> & ReturnType<typeof AssetState>>(Base: GBase) => {
    return class ComponentMeta extends Base {
        ComponentRender: ComponentRenderData;

        constructor(...rest: any) {
            super(...rest)
            this.ComponentRender = new ComponentRenderData()
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
