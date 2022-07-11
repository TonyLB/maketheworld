export class CacheBase {
    get(props: { category: never; key: never }) {
        return undefined
    }
}

type CacheConstructor = new(...args: any[]) => {
    get(props: { category: never; key: never; }): undefined
}

type CacheGlobalData = {
    test: string;
}

export const CacheGlobal = <GBase extends CacheConstructor>(Base: GBase) => {
    return class CacheGlobal extends Base {
        Global: Partial<CacheGlobalData> = {}

        override get(props: { category: 'Global'; key: keyof CacheGlobalData}): CacheGlobalData[typeof props["key"]]
        override get(...args: Parameters<InstanceType<GBase>["get"]>): ReturnType<CacheBase["get"]>
        override get(props: any) {
            if (props.category === 'Global') {
                return this.Global[props.key]
            }
            return super.get(props)
        }

        set(props: { category: 'Global', key: 'test', value: string }): void
        set({ key, value }: { category: 'Global', key: keyof CacheGlobalData, value: any }): void {
            this.Global[key] = value
        }
    }
}

type CacheLookupData = {
    anotherTest: number;
}

export const CacheLookup = <GBase extends CacheConstructor>(Base: GBase) => {
    return class CacheGlobal extends Base {
        Lookup: Record<string, CacheLookupData> = {}

        override get(props: { category: 'Lookup'; key: string}): CacheLookupData
        override get(...args: Parameters<InstanceType<GBase>["get"]>): ReturnType<CacheBase["get"]>
        override get(props: any) {
            if (props.category === 'Lookup') {
                if (!(this.Lookup[props.key])) {
                    this.Lookup[props.key] = {
                        anotherTest: 2
                    }
                }
                return this.Lookup[props.key]
            }
            return super.get(props)
        }

    }
}