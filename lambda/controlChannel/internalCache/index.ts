type CacheItem = {
    invalidatedAt?: number;
    value: any;
}

type CacheCategory = {
    entries: Record<string, any>;
}

//
// TODO: More specifically type-constrain certain categories to having only certain data types
//

//
// TODO: Create two different types of categories:  Key-Value, which store individual data
// items by explicit key, and Lookup which come with a fetch function that takes a key and
// asynchronously fetches an entry of a specified data-type according to that key.
//
export class InternalCache extends Object {
    _cache: Record<string, CacheCategory> = {};

    constructor() {
        super()
    }

    set({ category, key, value }: { category: string; key: string; value: any; }): void {
        this._cache[category] = this._cache[category] || { entries: {} }
        this._cache[category].entries[key] = value
    }

    get({ category, key }: { category: string; key: string }): any {
        return this._cache[category]?.entries?.[key]
    }

    clear() {
        this._cache = {}
    }
}

export const internalCache = new InternalCache()
export default internalCache
