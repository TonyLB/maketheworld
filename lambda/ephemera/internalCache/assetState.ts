import evaluateCode from '@tonylb/mtw-utilities/dist/computation/sandbox';
import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { deepEqual } from '@tonylb/mtw-utilities/dist/objects';
import { EphemeraComputedId, EphemeraVariableId, isEphemeraComputedId, isEphemeraVariableId } from '../cacheAsset/baseClasses';
import { DeferredCache, DeferredCacheGeneral } from './deferredCache'
import DependencyGraph, { DependencyGraphData, tagFromEphemeraId } from './dependencyGraph';

type StateItemId = EphemeraVariableId | EphemeraComputedId

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
                return await ephemeraDB.batchGetItem<{ EphemeraId: string; value: any; }>({
                    Items: keys.map((EphemeraId) => ({ EphemeraId, DataCategory: `Meta::${tagFromEphemeraId(EphemeraId)}` })),
                    ProjectionFields: ['EphemeraId', '#value'],
                    ExpressionAttributeNames: {
                        '#value': 'value'
                    }
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

type EvaluateCodeAddress = {
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

    //
    // TODO: ISS-1570: Invalidate EvaluatedCode when relevant AssetState entries are set or invalidated
    //
    invalidateByAssetStateId (EphemeraId: StateItemId): void {
        const addressesToInvalidate = this._Cache._cache
            .map(([address]) => (address))
            .filter(({ mapping }) => (Object.values(mapping).includes(EphemeraId)))
        addressesToInvalidate.forEach((address) => (this._Cache.invalidate(address)))
    }
}

class AssetMap {
    _Ancestry: DependencyGraphData;
    constructor(Ancestry: DependencyGraphData) {
        this._Ancestry = Ancestry
    }

    async get(EphemeraId: string): Promise<AssetStateMapping> {
        if (tagFromEphemeraId(EphemeraId) === 'Asset') {
            const [computedLookups, variableLookups] = await Promise.all([
                ephemeraDB.query<{ EphemeraId: string; key: string; }[]>({
                    IndexName: 'DataCategoryIndex',
                    DataCategory: EphemeraId,
                    KeyConditionExpression: "begins_with(EphemeraId, :ephemeraPrefix)",
                    ExpressionAttributeValues: {
                        ':ephemeraPrefix': 'COMPUTED'
                    },
                    ExpressionAttributeNames: {
                        '#key': 'key'
                    },
                    ProjectionFields: ['#key', 'EphemeraId']
                }),
                ephemeraDB.query<{ EphemeraId: string; key: string; }[]>({
                    IndexName: 'DataCategoryIndex',
                    DataCategory: EphemeraId,
                    KeyConditionExpression: "begins_with(EphemeraId, :ephemeraPrefix)",
                    ExpressionAttributeValues: {
                        ':ephemeraPrefix': 'VARIABLE'
                    },
                    ExpressionAttributeNames: {
                        '#key': 'key'
                    },
                    ProjectionFields: ['#key', 'EphemeraId']
                })
            ])
            return [...computedLookups, ...variableLookups].reduce<Record<string, StateItemId>>((previous, { EphemeraId, key }) => (
                (key && (isEphemeraComputedId(EphemeraId) || isEphemeraVariableId(EphemeraId)))
                    ? { ...previous, [key]: EphemeraId }
                    : previous
            ), {})
        }
        else {
            const knownAncestry = this._Ancestry.getPartial(EphemeraId).find(({ EphemeraId: check }) => (check === EphemeraId))
            if (knownAncestry?.completeness === 'Complete') {
                return knownAncestry.connections.reduce<AssetStateMapping>((previous, { EphemeraId, key }) => (
                    (key && (isEphemeraComputedId(EphemeraId) || isEphemeraVariableId(EphemeraId)))
                        ? { ...previous, [key]: EphemeraId }
                        : previous
                ), {})
            }
            const fetchedAncestry = await this._Ancestry.get(EphemeraId)
            return (fetchedAncestry.find(({ EphemeraId: check }) => (check === EphemeraId))?.connections ?? [])
                .filter(({ EphemeraId }) => (isEphemeraComputedId(EphemeraId) || isEphemeraVariableId(EphemeraId)))
                .reduce<AssetStateMapping>((previous, { EphemeraId, key }) => (
                    (key && (isEphemeraComputedId(EphemeraId) || isEphemeraVariableId(EphemeraId)))
                        ? { ...previous, [key]: EphemeraId }
                        : previous
                    ), {})
        }
    }
}

export const AssetState = <GBase extends ReturnType<typeof DependencyGraph>>(Base: GBase) => {
    return class AssetState extends Base {
        AssetState: AssetStateData
        EvaluateCode: EvaluateCodeData
        AssetMap: AssetMap

        constructor(...rest: any) {
            super()
            this.AssetState = new AssetStateData((EphemeraId) => { this._invalidateAssetCallback(EphemeraId) })
            this.EvaluateCode = new EvaluateCodeData(this.AssetState)
            this.AssetMap = new AssetMap(this.Ancestry)
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
