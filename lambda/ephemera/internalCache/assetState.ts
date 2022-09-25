import evaluateCode from '@tonylb/mtw-utilities/dist/computation/sandbox';
import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { deepEqual } from '@tonylb/mtw-utilities/dist/objects';
import { CacheConstructor, Deferred } from './baseClasses'
import DependencyGraph, { DependencyGraphData, tagFromEphemeraId } from './dependencyGraph';

export type AssetStateMapping = Record<string, string>

type AssetStateOutput<T extends AssetStateMapping> = {
    [key in keyof T]: any;
}

export class AssetStateData {
    _StateDeferredByEphemeraId: Record<string, Deferred<any>> = {}
    _StateOverriden: Record<string, boolean> = {}
    
    clear() {
        this._StateDeferredByEphemeraId = {}
        this._StateOverriden = {}
    }
    async get<T extends AssetStateMapping>(keys: T): Promise<AssetStateOutput<T>> {
        const itemsInNeedOfFetch = Object.values(keys)
            .filter((EphemeraId) => (!(EphemeraId in this._StateDeferredByEphemeraId)))
        if (itemsInNeedOfFetch.length > 0) {
            itemsInNeedOfFetch.forEach((item) => {
                this._StateDeferredByEphemeraId[item] = new Deferred<any>()
            })
            await ephemeraDB.batchGetItem<{ EphemeraId: string; value: any; }>({
                Items: itemsInNeedOfFetch.map((EphemeraId) => ({ EphemeraId, DataCategory: `Meta::${tagFromEphemeraId(EphemeraId)}` })),
                ProjectionFields: ['EphemeraId', '#value'],
                ExpressionAttributeNames: {
                    '#value': 'value'
                }
            }).then((outputList) => {
                outputList.forEach(({ EphemeraId, value }) => {
                    this._StateDeferredByEphemeraId[EphemeraId].resolve(value)
                })
                const itemsFetched = outputList.map(({ EphemeraId }) => (EphemeraId))
                itemsInNeedOfFetch
                    .filter((item) => (!(itemsFetched.includes(item))))
                    .forEach((EphemeraId) => {
                        this._StateDeferredByEphemeraId[EphemeraId].resolve(false)
                    })
            })
            .catch(() => {
                itemsInNeedOfFetch
                    .forEach((EphemeraId) => {
                        this._StateDeferredByEphemeraId[EphemeraId].resolve(false)
                    })
            })
        }
        return Object.assign({}, ...(await Promise.all(
            Object.entries(keys).map(async ([key, EphemeraId]) => ({ [key]: await this._StateDeferredByEphemeraId[EphemeraId].promise }))
        ))) as AssetStateOutput<T>
    }

    set(EphemeraId: string, value: any) {
        if (!(EphemeraId in this._StateDeferredByEphemeraId)) {
            this._StateDeferredByEphemeraId[EphemeraId] = new Deferred()
        }
        this._StateDeferredByEphemeraId[EphemeraId].resolve(value)
        this._StateOverriden[EphemeraId] = true
    }

    invalidate(EphemeraId: string) {
        delete this._StateDeferredByEphemeraId[EphemeraId]
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
    }
}

export default AssetState
