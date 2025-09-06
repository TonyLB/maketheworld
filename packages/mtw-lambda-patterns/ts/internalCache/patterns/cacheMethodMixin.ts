import { DeferredCache } from '../deferredCache'

type Constructor<T = {}> = new (...args: any[]) => T;

/**
 * Mixin that provides standard cache methods for handlers using DeferredCache
 * 
 * This abstracts the common pattern of implementing clear(), flush(), invalidate(), and set()
 * methods for cache handlers, while allowing custom implementations where needed.
 */

export function withCacheMethods<T>(
    generateKey: (...args: any[]) => string
) {
    return <TBase extends Constructor<{ 
        _Cache: DeferredCache<T>, 
        _Store: Record<string, T> 
    }>>(Base: TBase) => {
        return class extends Base {
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
             * Invalidate a specific cache entry
             * 
             * @param args - Arguments used to generate the cache key
             */
            invalidate(...args: any[]) {
                const key = generateKey(...args)
                if (key in this._Store) {
                    delete this._Store[key]
                }
                if (this._Cache.isCached(key)) {
                    this._Cache.invalidate(key)
                }
            }

            /**
             * Manually set a cache entry
             * 
             * @param args - Arguments used to generate the cache key (last argument is the value)
             */
            set(...args: [...any[], T]) {
                const value = args.pop() as T
                const key = generateKey(...args)
                this._Cache.set(Infinity, key, value)
                this._Store[key] = value
            }

            /**
             * Check if a key is cached
             * 
             * @param args - Arguments used to generate the cache key
             */
            isCached(...args: any[]): boolean {
                const key = generateKey(...args)
                return this._Cache.isCached(key)
            }
        }
    }
}

