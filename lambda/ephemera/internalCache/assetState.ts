import {
    EphemeraComputedId,
    EphemeraVariableId,
    isEphemeraComputedId,
    isEphemeraVariableId
} from '@tonylb/mtw-interfaces/dist/baseClasses';
import evaluateCode from '@tonylb/mtw-utilities/dist/computation/sandbox';
import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { deepEqual } from '@tonylb/mtw-utilities/dist/objects';
import { DeferredCache, DeferredCacheGeneral } from './deferredCache'
import { isLegalDependencyTag } from "@tonylb/mtw-utilities/dist/graphStorage/cache/baseClasses"
import { extractConstrainedTag } from "@tonylb/mtw-utilities/dist/types"
import CacheGraph, { GraphCacheType } from './graph';
import ComponentMeta, { ComponentMetaData } from './componentMeta';

export type StateItemId = EphemeraVariableId | EphemeraComputedId

export type AssetStateMapping = Record<string, StateItemId>

type AssetStateOutput<T extends AssetStateMapping> = {
    [key in keyof T]: any;
}

export class AssetStateData {
    _StateCache: DeferredCache<any> = new DeferredCache<any>();
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
    async get<T extends AssetStateMapping>(keys: T): Promise<AssetStateOutput<T>> {
        this._StateCache.add({
            promiseFactory: async (keys: string[]) => {
                return await ephemeraDB.getItems<{ EphemeraId: string; value: any; }>({
                    Keys: keys.map((EphemeraId) => ({ EphemeraId, DataCategory: `Meta::${extractConstrainedTag(isLegalDependencyTag)(EphemeraId)}` })),
                    ProjectionFields: ['EphemeraId', 'value']
                })
            },
            requiredKeys: Object.values(keys),
            transform: (outputList) => (outputList.reduce((previous, { EphemeraId, value }) => ({ ...previous, [EphemeraId]: value }), {}))
        })
        return Object.assign({}, ...(await Promise.all(
            Object.entries(keys).map(async ([key, EphemeraId]) => ({ [key]: await this._StateCache.get(EphemeraId) }))
        ))) as AssetStateOutput<T>
    }

    set(EphemeraId: StateItemId, value: any) {
        this._StateCache.set(Infinity, EphemeraId, value)
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
    _Graph: GraphCacheType;
    _ComponentMeta: ComponentMetaData;
    constructor(Graph: GraphCacheType, ComponentMeta: ComponentMetaData) {
        this._Graph = Graph
        this._ComponentMeta = ComponentMeta
    }

    //
    // TODO: ISS-2750: Refactor AssetMap get to rely on key data from Graph edges rather than lookup
    //
    async get(EphemeraId: string): Promise<AssetStateMapping> {
        if (extractConstrainedTag(isLegalDependencyTag)(EphemeraId) === 'Asset') {
            const [computedLookups, variableLookups] = await Promise.all([
                ephemeraDB.query<{ EphemeraId: string; DataCategory: string; key: string; }>({
                    IndexName: 'DataCategoryIndex',
                    Key: { DataCategory: EphemeraId },
                    KeyConditionExpression: "begins_with(EphemeraId, :ephemeraPrefix)",
                    ExpressionAttributeValues: {
                        ':ephemeraPrefix': 'COMPUTED'
                    },
                    ProjectionFields: ['key', 'EphemeraId']
                }),
                ephemeraDB.query<{ EphemeraId: string; DataCategory: string; key: string; }>({
                    IndexName: 'DataCategoryIndex',
                    Key: { DataCategory: EphemeraId },
                    KeyConditionExpression: "begins_with(EphemeraId, :ephemeraPrefix)",
                    ExpressionAttributeValues: {
                        ':ephemeraPrefix': 'VARIABLE'
                    },
                    ProjectionFields: ['key', 'EphemeraId']
                })
            ])
            return [...computedLookups, ...variableLookups].reduce<Record<string, StateItemId>>((previous, { EphemeraId, key }) => (
                (key && (isEphemeraComputedId(EphemeraId) || isEphemeraVariableId(EphemeraId)))
                    ? { ...previous, [key]: EphemeraId }
                    : previous
            ), {})
        }
        else {
            const ancestryGraph = await this._Graph.get([EphemeraId], 'back')
            const dependentItems = ancestryGraph.edges
                .filter(({ from }) => (from === EphemeraId))
                .map(({ to, context }) => ({ to, context }))
            const componentItems = await Promise.all(dependentItems.map(async (dependentItem) => (this._ComponentMeta.get(dependentItem.to as EphemeraVariableId | EphemeraComputedId, dependentItem.context || ''))))
            return componentItems.reduce<AssetStateMapping>((previous, componentMeta) => (componentMeta ? { ...previous, [componentMeta.key]: componentMeta.EphemeraId } : previous), {})
        }
    }
}

export const AssetState = <GBase extends ReturnType<typeof CacheGraph> & ReturnType<typeof ComponentMeta>>(Base: GBase) => {
    return class AssetState extends Base {
        AssetState: AssetStateData
        EvaluateCode: EvaluateCodeData
        AssetMap: AssetMap

        constructor(...rest: any) {
            super()
            this.AssetState = new AssetStateData((EphemeraId) => { this._invalidateAssetCallback(EphemeraId) })
            this.EvaluateCode = new EvaluateCodeData(this.AssetState)
            this.AssetMap = new AssetMap(this.Graph, this.ComponentMeta)
        }
        override clear() {
            this.AssetState.clear()
            this.EvaluateCode.clear()
            super.clear()
        }
        override async flush() {
            await Promise.all([
                this.AssetState.flush(),
                super.flush()
            ])
        }

        _invalidateAssetCallback(EphemeraId: StateItemId): void {
            this.EvaluateCode.invalidateByAssetStateId(EphemeraId)
        }
    }
}

export default AssetState
