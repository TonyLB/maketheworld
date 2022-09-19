import { ephemeraDB, connectionDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index'
import { splitType } from '@tonylb/mtw-utilities/dist/types'
import { delayPromise } from '@tonylb/mtw-utilities/dist/dynamoDB/delayPromise'

type CacheItem<T> = {
    invalidatedAt?: number;
    value: T;
}

type CacheCategoryKeyValue<T extends Record<string, any>> = {
    cacheType: 'SetOnly';
    entries: Partial<T>;
}

type CacheCategoryFetchFunction<T extends Record<string, any>> = {
    (key: string): Promise<T>;
}

type CacheCategoryLookup<T extends Record<string, any>> = {
    cacheType: 'Lookup';
    entries: Record<string, CacheItem<T>>;
    fetch: CacheCategoryFetchFunction<T>;
}


type CacheCategoryFetchOnce<T extends Record<string, any>, C> = {
    cacheType: 'FetchOnce';
    entries: Partial<T>;
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
    fileURL?: string;
    HomeId: string;
}

type CacheStorageType = {
    Global: CacheCategoryKeyValue<CacheGlobal>;
    CurrentPlayerMeta: CacheCategoryFetchOnce<CurrentPlayerMeta, InternalCache>;
    RoomCharacterList: CacheCategoryLookup<Record<string, RoomCharacterActive>>;
    CharacterMeta: CacheCategoryLookup<CacheCharacterMeta>;
}

type CacheStorageTypeCategories = CacheStorageType[keyof CacheStorageType]
type CacheStorageTypeFetchableCategories = Extract<CacheStorageTypeCategories, { fetch: Function }>

type CacheGetArgumentBase = {
    category: keyof CacheStorageType;
    key: string;
}
interface CacheGetArgumentGlobal extends CacheGetArgumentBase {
    category: 'Global',
    key: keyof CacheGlobal
}
interface CacheGetArgumentCurrentPlayer extends CacheGetArgumentBase {
    category: 'CurrentPlayerMeta';
    key: keyof CurrentPlayerMeta;
}
interface CacheGetArgumentRoomCharacter extends CacheGetArgumentBase {
    category: 'RoomCharacterList';
    key: string;
}
interface CacheGetArgumentCharacterMeta extends CacheGetArgumentBase {
    category: 'CharacterMeta';
    key: string;
}
type CacheGetArgument = CacheGetArgumentGlobal | CacheGetArgumentCurrentPlayer | CacheGetArgumentRoomCharacter | CacheGetArgumentCharacterMeta

type CacheGetReturnValue<T extends CacheGetArgument, K extends T["key"]> = T["category"] extends 'Global' ? K extends keyof CacheGlobal ? CacheGlobal[K] : never
    : T["category"] extends 'CurrentPlayerMeta' ? K extends keyof CurrentPlayerMeta ? CurrentPlayerMeta[K] : never
    : T["category"] extends ('RoomCharacterList' | 'CharacterMeta') ? CacheStorageType[T["category"]]["entries"] extends CacheItem<infer P> ? P : never : never

const isFetchable = (category: CacheStorageTypeCategories): category is CacheStorageTypeFetchableCategories => (['FetchOnce', 'Lookup'].includes(category.cacheType))
const isGlobalArgument = (props: CacheGetArgument): props is CacheGetArgumentGlobal => (props.category === 'Global')
const isCurrentPlayerArgument = (props: CacheGetArgument): props is CacheGetArgumentCurrentPlayer => (props.category === 'CurrentPlayerMeta')
const isRoomCharacterArgument = (props: CacheGetArgument): props is CacheGetArgumentRoomCharacter => (props.category === 'RoomCharacterList')
const isCharacterMetaArgument = (props: CacheGetArgument): props is CacheGetArgumentCharacterMeta => (props.category === 'CharacterMeta')

const initialCache: CacheStorageType = {
    Global: {
        cacheType: 'SetOnly',
        entries: {}
    },
    CurrentPlayerMeta: {
        cacheType: 'FetchOnce',
        entries: {},
        fetch: async (internalCache: InternalCache) => {
            const connectionId = await internalCache.get({
                category: 'Global',
                key: 'ConnectionId'
            })
            if (connectionId) {
                //
                // TODO: Replace repeated attempts with exponential backoff by
                // refactoring connectionDB.getItem to allow a consistent argument
                // that can actviate strongly-consistent reads
                //
                let attempts = 0
                let exponentialBackoff = 50
                while(attempts < 5) {
                    const { player = '' } = await connectionDB.getItem<{ player: string }>({
                        ConnectionId: `CONNECTION#${connectionId}`,
                        DataCategory: 'Meta::Connection',
                        ProjectionFields: ['player']
                    }) || {}
                    if (player) {
                        return { player }
                    }
                    attempts += 1
                    await delayPromise(exponentialBackoff)
                    exponentialBackoff = exponentialBackoff * 2
                }
            }
            return { player: '' }
        }
    },
    RoomCharacterList: {
        cacheType: 'Lookup',
        entries: {},
        fetch: async (RoomId) => {
            const { activeCharacters = [] } = await ephemeraDB.getItem<{
                    activeCharacters: RoomCharacterActive[]
                }>({
                    EphemeraId: `ROOM#${RoomId}`,
                    DataCategory: 'Meta::Room',
                    ProjectionFields: ['activeCharacters']
                }) || { activeCharacters: [] }
            return activeCharacters.reduce((previous, value) => ({ ...previous,  [splitType(value.EphemeraId)[1]]: value }), {})
        }
    },
    CharacterMeta: {
        cacheType: 'Lookup',
        entries: {},
        fetch: async (CharacterId) => {
            const { EphemeraId = `CHARACTER#${CharacterId}`, Name = '', RoomId = '', Color, fileURL, HomeId = 'VORTEX' } = await ephemeraDB.getItem<CacheCharacterMeta>({
                    EphemeraId: `CHARACTER#${CharacterId}`,
                    DataCategory: 'Meta::Character',
                    ProjectionFields: ['#name', 'RoomId', 'Color', 'fileURL', 'HomeId'],
                    ExpressionAttributeNames: {
                        '#name': 'Name'
                    }
                }) || {}
            return { EphemeraId, Name, RoomId, Color, fileURL, HomeId }
        }
    }
}

export class InternalCache extends Object {
    _cache: CacheStorageType = initialCache

    constructor() {
        super()
    }

    set({ category, key, value }: { category: 'Global'; key: keyof CacheStorageType['Global']["entries"]; value: any; }): void {
        this._cache[category] = this._cache[category] || { entries: {} }
        this._cache[category].entries[key] = value
    }

    get(props: CacheGetArgumentGlobal): Promise<CacheGlobal[keyof CacheGlobal] | undefined>
    get(props: CacheGetArgumentCurrentPlayer): Promise<CurrentPlayerMeta[keyof CurrentPlayerMeta] | undefined>
    get(props: CacheGetArgumentRoomCharacter): Promise<Record<string, RoomCharacterActive> | undefined>
    get(props: CacheGetArgumentCharacterMeta): Promise<CacheCharacterMeta | undefined>
    get(props: CacheGetArgument): Promise<CacheGlobal[keyof CacheGlobal] | CurrentPlayerMeta[keyof CurrentPlayerMeta] | Record<string, RoomCharacterActive> | CacheCharacterMeta | undefined>
    async get(props: CacheGetArgument): Promise<CacheGlobal[keyof CacheGlobal] | CurrentPlayerMeta[keyof CurrentPlayerMeta] | Record<string, RoomCharacterActive> | CacheCharacterMeta | undefined> {
        //
        // Unfortunately, I have not yet figured out a way to typescript constrain these polymorphic outputs without
        // repeating a lot of code.
        //
        if (isGlobalArgument(props)) {
            const { category, key } = props
            const cacheCategory = this._cache[category]
            return cacheCategory.entries[key]
        }
        if (isCurrentPlayerArgument(props)) {
            const { category, key } = props
            const cacheCategory = this._cache[category]
            if (Object.keys(cacheCategory.entries).length === 0) {
                const fetchedValue = await cacheCategory.fetch(this)
                cacheCategory.entries = fetchedValue
            }
            return cacheCategory.entries[key]
        }
        if (isRoomCharacterArgument(props)) {
            const { category, key } = props
            const cacheCategory = this._cache[category]
            if (!cacheCategory.entries[key]) {
                const fetchedValue = await cacheCategory.fetch(key)
                cacheCategory.entries[key] = {
                    value: fetchedValue
                }
            }
            return cacheCategory.entries[key].value
        }
        if (isCharacterMetaArgument(props)) {
            const { category, key } = props
            const cacheCategory = this._cache[category]
            if (!cacheCategory.entries[key]) {
                const fetchedValue = await cacheCategory.fetch(key)
                cacheCategory.entries[key] = {
                    value: fetchedValue
                }
            }
            return cacheCategory.entries[key].value
        }
    }

    clear() {
        this._cache.Global.entries = {}
        this._cache.CurrentPlayerMeta.entries = {}
        this._cache.RoomCharacterList.entries = {}
        this._cache.CharacterMeta.entries = {}
    }
}

export const internalCache = new InternalCache()
export default internalCache
