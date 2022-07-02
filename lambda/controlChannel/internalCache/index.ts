import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index'

type CacheItem<T> = {
    invalidatedAt?: number;
    value: T;
}

type CacheCategoryKeyValue = {
    entries: Record<string, CacheItem<any>>;
    fetch: false;
}

type CacheCategoryLookup<T> = {
    entries: Record<string, CacheItem<T>>;
    fetch: (key: string) => Promise<T>;
}

type RoomCharacterActive = {
    EphemeraId: string;
    Color?: string;
    ConnectionIds: string[];
    fileURL?: string;
    Name: string;
}

type CacheStorageType = {
    Global: CacheCategoryKeyValue;
    RoomCharacterList: CacheCategoryLookup<Record<string, RoomCharacterActive>>;
}

const initialCache: CacheStorageType = {
    Global: {
        entries: {},
        fetch: false
    },
    RoomCharacterList: {
        entries: {},
        fetch: async (RoomId) => {
            const { activeCharacters = {} } = await ephemeraDB.getItem<{
                    activeCharacters: Record<string, RoomCharacterActive>
                }>({
                    EphemeraId: `ROOM#${RoomId}`,
                    DataCategory: 'Meta::Room',
                    ProjectionFields: ['activeCharacters']
                }) || { activeCharacters: {} }
            return activeCharacters
        }
    }
}

const isCacheKeyValue = <T>(prop: CacheCategoryKeyValue | CacheCategoryLookup<T>): prop is CacheCategoryKeyValue => (prop.fetch === false)

export class InternalCache extends Object {
    _cache: CacheStorageType = initialCache

    constructor() {
        super()
    }

    set({ category, key, value }: { category: 'Global'; key: string; value: any; }): void {
        this._cache[category] = this._cache[category] || { entries: {} }
        this._cache[category].entries[key] = { value }
    }

    async get<T extends keyof CacheStorageType>({ category, key }: { category: T; key: string }): Promise<CacheStorageType[T] extends CacheCategoryLookup<infer T> ? T : any> {
        const cacheCategory = this._cache[category]
        if (!isCacheKeyValue(cacheCategory)) {
            if (!cacheCategory.entries[key]) {
                const fetchedValue = await cacheCategory.fetch(key)
                this._cache[category].entries[key] = {
                    value: fetchedValue
                }
            }
        }
        return this._cache[category]?.entries?.[key]?.value
    }

    clear() {
        this._cache = initialCache
    }
}

export const internalCache = new InternalCache()
export default internalCache
