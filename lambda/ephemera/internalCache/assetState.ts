import {
    EphemeraComputedId,
    EphemeraVariableId,
    isEphemeraAssetId,
    isEphemeraComputedId,
    isEphemeraId,
    isEphemeraVariableId
} from '@tonylb/mtw-interfaces/ts/baseClasses';
import evaluateCode from '@tonylb/mtw-utilities/dist/computation/sandbox';
import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { deepEqual } from '@tonylb/mtw-utilities/dist/objects';
import { DeferredCache, DeferredCacheGeneral } from './deferredCache'
import { isLegalDependencyTag } from "@tonylb/mtw-utilities/dist/graphStorage/cache/baseClasses"
import { extractConstrainedTag } from "@tonylb/mtw-utilities/dist/types"
import CacheGraph, { GraphCacheType, GraphEdgeType, GraphNodeType } from './graph';
import ComponentMeta, { ComponentMetaData } from './componentMeta';
import { objectMap } from '../lib/objects';
import internalCache from '.';
import { GraphNodeData } from '@tonylb/mtw-utilities/dist/graphStorage/cache/graphNode';
import { GraphEdgeData } from '@tonylb/mtw-utilities/dist/graphStorage/cache/graphEdge';

export type StateItemId = EphemeraVariableId | EphemeraComputedId
export const isStateItemId = (item: string): item is StateItemId => (isEphemeraVariableId(item) || isEphemeraComputedId(item))
export type StateItemReturn = {
    value: any;
    src?: string;
    dependencies?: string[];
}

export class StateData {
    _StateCache: DeferredCache<StateItemReturn> = new DeferredCache<StateItemReturn>();
    _StateOverriden: Record<string, boolean> = {}
    _invalidateCallback: (EphemeraId: StateItemId) => void;
    
    constructor(invalidateCallback: (EphemeraId: StateItemId) => void) {
        this._invalidateCallback = invalidateCallback
    }

    clear() {
        this._StateCache.clear()
        this._StateOverriden = {}
    }
    flush() {
        this._StateCache.flush()
    }
    async get(keys: StateItemId[]): Promise<Record<StateItemId, StateItemReturn>> {
        this._StateCache.add({
            promiseFactory: async (keys: string[]) => {
                return await ephemeraDB.getItems<{ EphemeraId: string; value: any; src?: string; dependencies?: string[]; }>({
                    Keys: keys.map((EphemeraId) => ({ EphemeraId, DataCategory: `Meta::${extractConstrainedTag(isLegalDependencyTag)(EphemeraId)}` })),
                    ProjectionFields: ['EphemeraId', 'value', 'src', 'dependencies']
                })
            },
            requiredKeys: keys,
            transform: (outputList) => (Object.assign({}, ...outputList.map(({ EphemeraId, value, src, dependencies }) => ({ [EphemeraId]: { value, src, dependencies } }))))
        })
        return Object.assign({}, ...(await Promise.all(
            keys.map(async (EphemeraId) => ({ [EphemeraId]: await this._StateCache.get(EphemeraId) }))
        ))) as Record<StateItemId, StateItemReturn>
    }

    set(EphemeraId: StateItemId, value: any) {
        this._StateCache.set(Infinity, EphemeraId, { value })
        this._StateOverriden[EphemeraId] = true
        this._invalidateCallback(EphemeraId)
    }

    invalidate(EphemeraId: StateItemId) {
        this._StateCache.invalidate(EphemeraId)
        delete this._StateOverriden[EphemeraId]
        this._invalidateCallback(EphemeraId)
    }

    isOverridden(EphemeraId: StateItemId) {
        return this._StateOverriden[EphemeraId]
    }
}

export type AssetStateMapping = Record<string, StateItemId>

type AssetStateOutput<T extends AssetStateMapping> = {
    [key in keyof T]: any;
}

export class AssetStateData {
    _StateCache: StateData;
    
    constructor(stateCache: StateData) {
        this._StateCache = stateCache
    }

    async get<T extends AssetStateMapping>(keys: T): Promise<AssetStateOutput<T>> {
        const rawStateValues = await this._StateCache.get(Object.values(keys))
        return objectMap(keys, (ephemeraId) => (rawStateValues[ephemeraId].value)) as AssetStateOutput<T>
    }

    set(EphemeraId: StateItemId, value: any) {
        this._StateCache.set(EphemeraId, value)
    }

    invalidate(EphemeraId: StateItemId) {
        this._StateCache.invalidate(EphemeraId)
    }

    isOverridden(EphemeraId: StateItemId) {
        return this._StateCache._StateOverriden[EphemeraId]
    }
}

export type EvaluateCodeAddress = {
    mapping: AssetStateMapping;
    source: string;
}

const compareCodeAddresses = (keyA: EvaluateCodeAddress, keyB: EvaluateCodeAddress) => (deepEqual(keyA, keyB))

//
// TODO: Refactor EvaluateCodeData using DeferredGeneralCache<EvaluateCodeAddress, any>
//
export class EvaluateCodeData {
    _AssetState: AssetStateData;
    _Cache: DeferredCacheGeneral<EvaluateCodeAddress, any> = new DeferredCacheGeneral({
        comparison: compareCodeAddresses
    })

    constructor(AssetState: AssetStateData) {
        this._AssetState = AssetState
    }
    clear() {
        this._Cache.clear()
    }

    _findPromise({ source, mapping }: EvaluateCodeAddress): Promise<any> | undefined {
        if (!(source in this._Cache)) {
            return undefined
        }
        const searchPromises = this._Cache[source].find(({ mapping: searchMapping }) => (deepEqual(mapping, searchMapping)))
        return searchPromises?.promise
    }

    _cachePromise({ source, mapping }: EvaluateCodeAddress, promise: Promise<any>): void {
        this._Cache[source] = [
            ...(this._Cache[source] || []),
            { mapping, promise }
        ]
    }
    
    async get(address: EvaluateCodeAddress): Promise<any> {
        this._Cache.generalAdd({
            promiseFactory: async (addresses: EvaluateCodeAddress[]): Promise<any> => {
                return Promise.all(addresses.map(async (address) => {
                    const { mapping, source } = address
                    if (Object.keys(address.mapping).length) {
                        const sandbox = await this._AssetState.get(mapping)
                        return { address, value: evaluateCode(`return (${source})`)({ ...sandbox }) }
                    }
                    else {
                        return { address, value: evaluateCode(`return (${source})`)({}) }
                    }    
                }))
            },
            requiredKeys: [address],
            transform: (pairs) => (pairs.map(({ address, value }) => ([ address, value ])))
        })
        return await this._Cache.get(address)
    }

    invalidateByAssetStateId (EphemeraId: StateItemId): void {
        const addressesToInvalidate = this._Cache._cache
            .map(([address]) => (address))
            .filter(({ mapping }) => (Object.values(mapping).includes(EphemeraId)))
        addressesToInvalidate.forEach((address) => (this._Cache.invalidate(address)))
    }
}

class AssetMap {
    _GraphNodes: GraphNodeType;
    _GraphEdges: GraphEdgeType;
    constructor(GraphNodes: GraphNodeType, GraphEdges: GraphEdgeType) {
        this._GraphNodes = GraphNodes
        this._GraphEdges = GraphEdges
    }

    //
    // TODO: ISS-2750: Refactor AssetMap get to rely on key data from Graph edges rather than lookup
    //
    async get(EphemeraId: string): Promise<AssetStateMapping> {
        if (isEphemeraAssetId(EphemeraId)) {
            const [assetNodeLookup] = await this._GraphNodes.get([EphemeraId])
            const edgesToLookup = assetNodeLookup.forward.edges.map(({ target, context }) => ({
                from: EphemeraId,
                to: target,
                context
            }))
            const fetchedEdges = await this._GraphEdges.get(edgesToLookup)
            return fetchedEdges.reduce<Record<string, StateItemId>>((previous, { to, data: { scopedId } = {} }) => (
                (scopedId && (isStateItemId(to)))
                    ? { ...previous, [scopedId]: to }
                    : previous
            ), {})
        }
        else {
            if (!isEphemeraId(EphemeraId)) {
                throw new Error(`EphemeraId error (${EphemeraId})`)
            }
            const [itemNodeLookup] = await this._GraphNodes.get([EphemeraId])
            const edgesToLookup = itemNodeLookup.back.edges.map(({ target, context }) => ({
                to: EphemeraId,
                from: target,
                context
            }))
            const fetchedEdges = await this._GraphEdges.get(edgesToLookup)
            return fetchedEdges.reduce<Record<string, StateItemId>>((previous, { from, data: { scopedId } = {} }) => (
                (scopedId && (isStateItemId(from)))
                    ? { ...previous, [scopedId]: from }
                    : previous
            ), {})
        }
    }
}

export const AssetState = <GBase extends ReturnType<typeof CacheGraph>>(Base: GBase) => {
    return class AssetState extends Base {
        StateCache: StateData
        AssetState: AssetStateData
        EvaluateCode: EvaluateCodeData
        AssetMap: AssetMap

        constructor(...rest: any) {
            super()
            this.StateCache = new StateData((EphemeraId) => { this._invalidateAssetCallback(EphemeraId) })
            this.AssetState = new AssetStateData(this.StateCache)
            this.EvaluateCode = new EvaluateCodeData(this.AssetState)
            this.AssetMap = new AssetMap(this.GraphNodes, this.GraphEdges)
        }
        override clear() {
            this.StateCache.clear()
            this.EvaluateCode.clear()
            super.clear()
        }
        override async flush() {
            await Promise.all([
                this.StateCache.flush(),
                super.flush()
            ])
        }

        _invalidateAssetCallback(EphemeraId: StateItemId): void {
            this.EvaluateCode.invalidateByAssetStateId(EphemeraId)
        }
    }
}

export default AssetState
