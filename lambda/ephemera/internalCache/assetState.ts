import evaluateCode from '@tonylb/mtw-utilities/dist/computation/sandbox';
import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { deepEqual } from '@tonylb/mtw-utilities/dist/objects';
import { DeferredCache } from './deferredCache'
import DependencyGraph, { DependencyGraphData, tagFromEphemeraId } from './dependencyGraph';

export type AssetStateMapping = Record<string, string>

type AssetStateOutput<T extends AssetStateMapping> = {
    [key in keyof T]: any;
}

export class AssetStateData {
    _StateCache: DeferredCache<any> = new DeferredCache<any>();
    _StateOverriden: Record<string, boolean> = {}
    
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
        // const itemsInNeedOfFetch = Object.values(keys)
        //     .filter((EphemeraId) => (!(EphemeraId in this._StateCache)))
        // if (itemsInNeedOfFetch.length > 0) {
        //     itemsInNeedOfFetch.forEach((item) => {
        //         this._StateCache[item] = new Deferred<any>()
        //     })
        //     await ephemeraDB.batchGetItem<{ EphemeraId: string; value: any; }>({
        //         Items: itemsInNeedOfFetch.map((EphemeraId) => ({ EphemeraId, DataCategory: `Meta::${tagFromEphemeraId(EphemeraId)}` })),
        //         ProjectionFields: ['EphemeraId', '#value'],
        //         ExpressionAttributeNames: {
        //             '#value': 'value'
        //         }
        //     }).then((outputList) => {
        //         outputList.forEach(({ EphemeraId, value }) => {
        //             this._StateCache[EphemeraId].resolve(value)
        //         })
        //         const itemsFetched = outputList.map(({ EphemeraId }) => (EphemeraId))
        //         itemsInNeedOfFetch
        //             .filter((item) => (!(itemsFetched.includes(item))))
        //             .forEach((EphemeraId) => {
        //                 this._StateCache[EphemeraId].resolve(false)
        //             })
        //     })
        //     .catch(() => {
        //         itemsInNeedOfFetch
        //             .forEach((EphemeraId) => {
        //                 this._StateCache[EphemeraId].resolve(false)
        //             })
        //     })
        // }
        // return Object.assign({}, ...(await Promise.all(
        //     Object.entries(keys).map(async ([key, EphemeraId]) => ({ [key]: await this._StateCache[EphemeraId].promise }))
        // ))) as AssetStateOutput<T>
    }

    set(EphemeraId: string, value: any) {
        this._StateCache.set(EphemeraId, value)
        // if (!(EphemeraId in this._StateCache)) {
        //     this._StateCache[EphemeraId] = new Deferred()
        // }
        // this._StateCache[EphemeraId].resolve(value)
        this._StateOverriden[EphemeraId] = true
    }

    invalidate(EphemeraId: string) {
        this._StateCache.invalidate(EphemeraId)
        delete this._StateOverriden[EphemeraId]
    }

    isOverridden(EphemeraId: string) {
        return this._StateOverriden[EphemeraId]
    }
}

type EvaluateCodeAddress = {
    mapping: AssetStateMapping;
    source: string;
}

type EvaluateCodePromiseDistinguisher = {
    mapping: AssetStateMapping;
    promise: Promise<any>;
}

export class EvaluateCodeData {
    _AssetState: AssetStateData;
    _EvaluatePromiseBySource: Record<string, EvaluateCodePromiseDistinguisher[]> = {}

    constructor(AssetState: AssetStateData) {
        this._AssetState = AssetState
    }
    clear() {
        this._EvaluatePromiseBySource = {}
    }

    _findPromise({ source, mapping }: EvaluateCodeAddress): Promise<any> | undefined {
        if (!(source in this._EvaluatePromiseBySource)) {
            return undefined
        }
        const searchPromises = this._EvaluatePromiseBySource[source].find(({ mapping: searchMapping }) => (deepEqual(mapping, searchMapping)))
        return searchPromises?.promise
    }

    _cachePromise({ source, mapping }: EvaluateCodeAddress, promise: Promise<any>): void {
        this._EvaluatePromiseBySource[source] = [
            ...(this._EvaluatePromiseBySource[source] || []),
            { mapping, promise }
        ]
    }
    
    async get({ source, mapping }: EvaluateCodeAddress): Promise<any> {
        const cachedEvaluation = this._findPromise({ source, mapping })
        if (!cachedEvaluation) {
            const promiseToCache = (async () => {
                if (Object.keys(mapping).length) {
                    const sandbox = await this._AssetState.get(mapping)
                    return evaluateCode(`return (${source})`)({ ...sandbox })
                }
                else {
                    return evaluateCode(`return (${source})`)({})
                }
            })()
            this._cachePromise({ source, mapping }, promiseToCache)
            return promiseToCache
        }
        else {
            return cachedEvaluation
        }
    }
}

class AssetMap {
    _Ancestry: DependencyGraphData;
    constructor(Ancestry: DependencyGraphData) {
        this._Ancestry = Ancestry
    }

    async get(EphemeraId: string): Promise<AssetStateMapping> {
        const knownAncestry = this._Ancestry.getPartial(EphemeraId).find(({ EphemeraId: check }) => (check === EphemeraId))
        if (knownAncestry?.completeness === 'Complete') {
            return knownAncestry.connections.reduce<AssetStateMapping>((previous, { EphemeraId, key }) => (key ? { ...previous, [key]: EphemeraId } : previous), {})
        }
        const fetchedAncestry = await this._Ancestry.get(EphemeraId)
        return (fetchedAncestry.find(({ EphemeraId: check }) => (check === EphemeraId))?.connections ?? []).reduce<AssetStateMapping>((previous, { EphemeraId, key }) => (key ? { ...previous, [key]: EphemeraId } : previous), {})
    }
}

export const AssetState = <GBase extends ReturnType<typeof DependencyGraph>>(Base: GBase) => {
    return class AssetState extends Base {
        AssetState: AssetStateData
        EvaluateCode: EvaluateCodeData
        AssetMap: AssetMap

        constructor(...rest: any) {
            super()
            this.AssetState = new AssetStateData()
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
    }
}

export default AssetState
