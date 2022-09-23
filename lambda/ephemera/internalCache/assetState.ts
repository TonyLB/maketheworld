import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { CacheConstructor } from './baseClasses'

type AssetStateAddress = {
    tag: 'Variable' | 'Computed';
    EphemeraId: string;
}

type AssetStateOutput<T extends Record<string, AssetStateAddress>> = {
    [key in keyof T]: any;
}

export class AssetStateData {
    _StatePromiseByEphemeraId: Record<string, Promise<any>> = {}
    _StateOverrides: Record<string, any> = {}
    
    clear() {
        this._StatePromiseByEphemeraId = {}
    }
    async get<T extends Record<string, AssetStateAddress>>(keys: T): Promise<AssetStateOutput<T>> {
        const itemsInNeedOfFetch = Object.values(keys)
            .filter(({ EphemeraId }) => (!(EphemeraId in this._StatePromiseByEphemeraId)))
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
}

export const AssetState = <GBase extends CacheConstructor>(Base: GBase) => {
    return class AssetState extends Base {
        AssetState: AssetStateData = new AssetStateData()

        override clear() {
            this.AssetState.clear()
            super.clear()
        }
    }
}

export default AssetState
