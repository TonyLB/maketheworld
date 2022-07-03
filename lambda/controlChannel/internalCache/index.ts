import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index'
import { splitType } from '@tonylb/mtw-utilities/dist/types';

type CacheItem<T> = {
    invalidatedAt?: number;
    value: T;
}

type CacheCategoryKeyValue<T> = {
    cacheType: 'SetOnly';
    entries: Partial<T>;
}

type CacheCategoryLookup<T> = {
    cacheType: 'Lookup';
    entries: Record<string, CacheItem<T>>;
    fetch: (key: string) => Promise<T>;
}

type CacheCategoryFetchOnce<T, C> = {
    cacheType: 'FetchOnce';
    entry?: T;
    fetch: (values: C) => Promise<T>;
}

type RoomCharacterActive = {
    EphemeraId: string;
    Color?: string;
    ConnectionIds: string[];
    fileURL?: string;
    Name: string;
}

type CurrentPlayerMeta = {
    player: string;
}

type CacheGlobal = {
    ConnectionId: string;
    RequestId: string;
}

type CacheCharacterMeta = {
    EphemeraId: string;
    Name: string;
    RoomId: string;
    Color?: string;
}

type CacheStorageType = {
    Global: CacheCategoryKeyValue<CacheGlobal>;
    CurrentPlayerMeta: CacheCategoryFetchOnce<CurrentPlayerMeta, InternalCache>;
    RoomCharacterList: CacheCategoryLookup<Record<string, RoomCharacterActive>>;
    CharacterMeta: CacheCategoryLookup<CacheCharacterMeta>;
}

type CacheStorageTypeCategories = CacheStorageType[keyof CacheStorageType]
type CacheStorageTypeFetchableCategories = Extract<CacheStorageTypeCategories, { fetch: Function }>
type CacheCategoryToKeys = {
    [Category in keyof CacheStorageType]: CacheStorageType[Category] extends CacheCategoryFetchOnce<infer A, infer Cache>
    ? keyof A
    : CacheStorageType[Category] extends CacheCategoryLookup<infer T>
        ? keyof T
        : CacheStorageType[Category] extends CacheCategoryKeyValue<infer K>
            ? keyof K
            : never
}
type CacheCategoryToOutput = {
    [Category in keyof CacheStorageType]: CacheStorageType[Category] extends CacheCategoryFetchOnce<infer A, infer Cache>
        ? A
        : CacheStorageType[Category] extends CacheCategoryLookup<infer T>
            ? T
            : CacheStorageType[Category] extends CacheCategoryKeyValue<infer K>
                ? K
                : never
}

const isFetchable = (category: CacheStorageTypeCategories): category is CacheStorageTypeFetchableCategories => (['FetchOnce', 'Lookup'].includes(category.cacheType))

const initialCache: CacheStorageType = {
    Global: {
        cacheType: 'SetOnly',
        entries: {}
    },
    CurrentPlayerMeta: {
        cacheType: 'FetchOnce',
        fetch: async (internalCache: InternalCache) => {
            const connectionId = await internalCache.get({
                category: 'Global',
                key: 'ConnectionId'
            })
            const { player = '' } = await ephemeraDB.getItem<{ player: string }>({
                EphemeraId: `CONNECTION#${connectionId}`,
                DataCategory: 'Meta::Connection',
                ProjectionFields: ['player']
            }) || {}
            return {
                player
            }
        }
    },
    RoomCharacterList: {
        cacheType: 'Lookup',
        entries: {},
        fetch: async (RoomId) => {
            const { activeCharacters = {} } = await ephemeraDB.getItem<{
                    activeCharacters: Record<string, RoomCharacterActive>
                }>({
                    EphemeraId: `ROOM#${RoomId}`,
                    DataCategory: 'Meta::Room',
                    ProjectionFields: ['activeCharacters']
                }) || { activeCharacters: {} }
            return Object.entries(activeCharacters).reduce((previous, [key, value]) => ({ ...previous,  [splitType(key)[1]]: value }), {})
        }
    },
    CharacterMeta: {
        cacheType: 'Lookup',
        entries: {},
        fetch: async (CharacterId) => {
            return await ephemeraDB.getItem<CacheCharacterMeta>({
                    EphemeraId: `CHARACTERINPLAY#${CharacterId}`,
                    DataCategory: 'Meta::Character',
                    ProjectionFields: ['EphemeraId', '#name', 'RoomId', 'Color'],
                    ExpressionAttributeNames: {
                        '#name': 'Name'
                    }
                }) || {
                    EphemeraId: '',
                    Name: '',
                    RoomId: ''
                }
        }
    }
}

export class InternalCache extends Object {
    _cache: CacheStorageType = initialCache

    constructor() {
        super()
    }

    set({ category, key, value }: { category: 'Global'; key: CacheCategoryToKeys['Global']; value: any; }): void {
        this._cache[category] = this._cache[category] || { entries: {} }
        this._cache[category].entries[key] = value
    }

    async get<T extends keyof CacheStorageType>({ category, key }: { category: T; key: CacheCategoryToKeys[T] }): Promise<CacheCategoryToOutput[T][CacheCategoryToKeys[T]] | undefined> {
        const cacheCategory = this._cache[category]
        if (isFetchable(cacheCategory)) {
            if (cacheCategory.cacheType === 'Lookup') {
                if (!cacheCategory.entries[key]) {
                    const fetchedValue = await cacheCategory.fetch(key) as CacheCategoryToOutput[T][CacheCategoryToKeys[T]]
                    cacheCategory.entries[key] = {
                        value: fetchedValue
                    }
                }
                return cacheCategory.entries[key].value as CacheCategoryToOutput[T][CacheCategoryToKeys[T]]
            }
            if (cacheCategory.cacheType === 'FetchOnce') {
                if (!cacheCategory.entry) {
                    const fetchedValue = await cacheCategory.fetch(this)
                    cacheCategory.entry = fetchedValue
                }
                return cacheCategory.entry[key]
            }
        }
        else {
            return cacheCategory.entries[key]
        }
    }

    clear() {
        this._cache = initialCache
    }
}

export const internalCache = new InternalCache()
export default internalCache
