import evaluateCode from '@tonylb/mtw-utilities/dist/computation/sandbox';
import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { deepEqual } from '@tonylb/mtw-utilities/dist/objects';
import { CacheConstructor } from './baseClasses'

type AssetStateAddress = {
    tag: 'Variable' | 'Computed';
    EphemeraId: string;
}

export type AssetStateMapping = Record<string, AssetStateAddress>

type AssetStateOutput<T extends AssetStateMapping> = {
    [key in keyof T]: any;
}

export class AssetStateData {
    _StatePromiseByEphemeraId: Record<string, Promise<any>> = {}
    _StateOverrides: Record<string, any> = {}
    
    clear() {
        this._StatePromiseByEphemeraId = {}
    }
    async get<T extends AssetStateMapping>(keys: T): Promise<AssetStateOutput<T>> {
        const itemsInNeedOfFetch = Object.values(keys)
            .filter(({ EphemeraId }) => (!(EphemeraId in this._StatePromiseByEphemeraId)))
        if (itemsInNeedOfFetch.length > 0) {
            const batchGetPromise = ephemeraDB.batchGetItem<{ EphemeraId: string; value: any; }>({
                Items: itemsInNeedOfFetch.map(({ EphemeraId, tag }) => ({ EphemeraId, DataCategory: `Meta::${tag}` })),
                ProjectionFields: ['EphemeraId', '#value'],
                ExpressionAttributeNames: {
                    '#value': 'value'
                }
            })
            Object.values(itemsInNeedOfFetch).forEach(({ EphemeraId }) => {
                this._StatePromiseByEphemeraId[EphemeraId] = batchGetPromise
                    .then((items) => (items.find(({ EphemeraId: check }) => (check === EphemeraId))?.value))
                    .catch((err) => {
                        if (typeof this._StateOverrides[EphemeraId] === 'undefined') {
                            throw err
                        }
                    })
                    .then((value) => ((typeof this._StateOverrides[EphemeraId] === 'undefined') ? value : this._StateOverrides[EphemeraId]))
            })
        }
        return Object.assign({}, ...(await Promise.all(
            Object.entries(keys).map(async ([key, { EphemeraId }]) => ({ [key]: await this._StatePromiseByEphemeraId[EphemeraId] }))
        ))) as AssetStateOutput<T>
    }

    set(EphemeraId: string, value: any) {
        this._StateOverrides[EphemeraId] = value
        this._StatePromiseByEphemeraId[EphemeraId] = Promise.resolve(value)
    }

    invalidate(EphemeraId: string) {
        delete this._StateOverrides[EphemeraId]
        delete this._StatePromiseByEphemeraId[EphemeraId]
    }

    isOverridden(EphemeraId: string) {
        return EphemeraId in this._StateOverrides
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

export const AssetState = <GBase extends CacheConstructor>(Base: GBase) => {
    return class AssetState extends Base {
        AssetState: AssetStateData
        EvaluateCode: EvaluateCodeData

        constructor(...rest: any) {
            super()
            this.AssetState = new AssetStateData()
            this.EvaluateCode = new EvaluateCodeData(this.AssetState)
        }
        override clear() {
            this.AssetState.clear()
            this.EvaluateCode.clear()
            super.clear()
        }
    }
}

export default AssetState
