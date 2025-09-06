import { DeferredCache } from '../deferredCache'

/**
 * Base class for cache handlers that use the dual storage pattern
 * 
 * This provides the common _Cache + _Store pattern used by most cache handlers,
 * while allowing custom implementations where needed.
 */

export abstract class DualStorageCacheHandler<T> {
    protected _Cache: DeferredCache<T>
    protected _Store: Record<string, T> = {}

    constructor(options: { callback?: (key: string, value: T) => void, defaultValue?: (key: string) => T } = {}) {
        this._Cache = new DeferredCache<T>({
            callback: (key, value) => this._setStore(key, value),
            ...options
        })
    }

    /**
     * Store a value in the _Store
     * Override this method to add custom store logic
     */
    protected _setStore(key: string, value: T): void {
        this._Store[key] = value
    }

    /**
     * Clear all cached data
     */
    clear() {
        this._Cache.clear()
        this._Store = {}
    }

    /**
     * Wait for all pending cache operations to complete
     */
    async flush() {
        await this._Cache.flush()
    }

    /**
     * Check if a key is cached
     */
    isCached(key: string): boolean {
        return this._Cache.isCached(key)
    }
}

