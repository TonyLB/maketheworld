import { assetDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index'
import { delayPromise } from '@tonylb/mtw-utilities/dist/dynamoDB/delayPromise'

export class CacheBase {
    async get(props: { category: never; key: never }) {
        return undefined
    }
    async clear() {}
}

type Constructor<T = {}> = new (...args: any[]) => T;

type CacheConstructor = Constructor<{
    get(props: { category: never; key: never; }): Promise<undefined>;
    clear(): void;
}>

type CacheGlobalData = {
    connectionId: string;
    RequestId: string;
}

export const CacheGlobal = <GBase extends CacheConstructor>(Base: GBase) => {
    return class CacheGlobal extends Base {
        Global: Partial<CacheGlobalData> = {}

        override get(props: { category: 'Global'; key: keyof CacheGlobalData}): Promise<CacheGlobalData[typeof props["key"]]>
        override get(...args: Parameters<InstanceType<GBase>["get"]>): ReturnType<InstanceType<GBase>["get"]>
        override async get(props: any) {
            if (props.category === 'Global') {
                return this.Global[props.key]
            }
            return await super.get(props)
        }

        override clear() {
            this.Global = {}
            super.clear()
        }

        set(props: { category: 'Global', key: 'connectionId' | 'RequestId', value: string }): void
        set({ key, value }: { category: 'Global', key: keyof CacheGlobalData, value: any }): void {
            this.Global[key] = value
        }
    }
}

type CacheLookupOnceData = {
    player: string;
}

export const CacheLookupOnce = <GBase extends Constructor<{ get(props: { category: 'Global', key: 'connectionId' }): Promise<string>; clear(): void; }>>(Base: GBase) => {
    return class CacheGlobal extends Base {
        Lookup: CacheLookupOnceData | undefined = undefined

        override get(props: { category: 'Lookup'; key: 'player'}): Promise<string>
        override get(...args: Parameters<InstanceType<GBase>["get"]>): ReturnType<InstanceType<GBase>["get"]>
        override async get(props: any) {
            if (props.category === 'Lookup') {
                if (this.Lookup === undefined) {
                    const connectionId = await super.get({
                        category: 'Global',
                        key: 'connectionId'
                    })
                    //
                    // TODO: Replace repeated attempts with exponential backoff by
                    // refactoring ephemeraDB.getItem to allow a consistent argument
                    // that can actviate strongly-consistent reads
                    //
                    let attempts = 0
                    let exponentialBackoff = 50
                    while(attempts < 5) {
                        const { player = '' } = await assetDB.getItem<{ player: string }>({
                            AssetId: `CONNECTION#${connectionId}`,
                            DataCategory: 'Meta::Connection',
                            ProjectionFields: ['player']
                        }) || {}
                        if (player) {
                            this.Lookup = { player }
                            break
                        }
                        attempts += 1
                        await delayPromise(exponentialBackoff)
                        exponentialBackoff = exponentialBackoff * 2
                    }
                }
                return this.Lookup?.[props.key]
            }
            return await super.get(props)
        }

        override clear() {
            this.Lookup = undefined
            super.clear()
        }

    }
}

const InternalCache = CacheLookupOnce(CacheGlobal(CacheBase))
export const internalCache = new InternalCache()
export default internalCache
