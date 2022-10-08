export class Deferred <T>{
    invalidationCounter: number = 0
    promise: Promise<T>;
    _resolve: (value: T) => void = () => {}
    _reject: (err: Error) => void = () => {}
    isFulfilled: boolean = false
    isRejected: boolean = false
    constructor() {
        this.promise = new Promise((resolve, reject)=> {
            this._reject = reject
            this._resolve = resolve
        })
    }

    invalidate() {
        this.invalidationCounter += 1
        if (this.isFulfilled || this.isRejected) {
            this.promise = new Promise((resolve, reject)=> {
                this._reject = reject
                this._resolve = resolve
            })
            this.isFulfilled = false
            this.isRejected = false
        }
    }

    resolve (invalidationCounter: number, value: T): boolean {
        if (invalidationCounter < this.invalidationCounter) {
            return false
        }
        this._resolve(value)
        this.isFulfilled = true
        return true
    }

    reject (invalidationCounter: number, err: Error): boolean {
        if (invalidationCounter >= this.invalidationCounter) {
            this._reject(err)
            this.isRejected = true
            return true
        }
        return false
    }
}

export class DeferredCacheException extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'DeferredCacheException'
    }
}

type DeferredCacheOutputDistributor<T, A> = {
    promiseFactory: (keys: string[]) => Promise<A>;
    requiredKeys: string[];
    transform: (args: A) => Record<string, T>;
}

export class DeferredCache <T>{
    _cache: Record<string, Deferred<T>> = {};
    _promises: Promise<any>[] = [];
    _callback?: (key: string, value: T) => void;
    _default?: (key: string) => T;

    constructor({ callback, defaultValue }: { callback?: (key: string, value: T) => void, defaultValue?: (key: string) => T } = {}) {
        this._callback = callback
        this._default = defaultValue
   }

    async get(key: string): Promise<T> {
        if (key in this._cache) {
            return this._cache[key].promise
        }
        throw new DeferredCacheException(`Key "${key}" not defined in cache`)
    }

    add<A>({ promiseFactory, requiredKeys, transform }: DeferredCacheOutputDistributor<T, A>): void {
        let fetchNeeded: string[] = []
        requiredKeys.forEach((key) => {
            if (!(key in this._cache)) {
                fetchNeeded.push(key)
                this._cache[key] = new Deferred<T>()
            }
        })
        if (fetchNeeded.length) {
            let cache = this._cache
            //
            // Record current invalidationCounter (if any) in each target Deferred, and pass that to the
            // resolve call later.  If you get an invalid resolve, repeat up to ten times to try to
            // recover from invalidation
            //
            this._promises.push((async () => {
                let keysRemaining = fetchNeeded
                let repeatCount = 0
                while(keysRemaining.length && repeatCount < 10) {
                    let invalidatedKeys: string[] = []
                    let invalidationCounters = Object.assign({}, ...keysRemaining.map((key) => ({
                        [key]: key in this._cache ? this._cache[key].invalidationCounter : 0
                    })))
                    await promiseFactory(keysRemaining)
                        .then((output) => (transform(output)))
                        .then((output) => {
                            Object.entries(output).forEach(([key, value]) => {
                                if (!this.set(invalidationCounters[key] || 0, key, value) && (keysRemaining.includes(key))) {
                                    invalidatedKeys.push(key)
                                }
                            })
                            const failedKeys = keysRemaining.filter((key) => (!(Object.keys(output).includes(key))))
                            if (failedKeys.length) {
                                const defaultFunc = this._default
                                if (!(typeof defaultFunc === 'undefined')) {
                                    failedKeys.forEach((key) => {
                                        if (!this.set(invalidationCounters[key], key, defaultFunc(key))) {
                                            invalidatedKeys.push[key]
                                        }
                                    })
                                }
                                else {
                                    console.log(`FAILED KEYS: ${JSON.stringify(failedKeys, null, 4)}`)
                                    failedKeys.forEach((key) => {
                                        if (!cache[key].reject(invalidationCounters[key], new DeferredCacheException(`Required key "${key}" not returned by promise`))) {
                                            invalidatedKeys.push[key]
                                        }
                                    })
                                }
                            }
                        })
                    keysRemaining = [...invalidatedKeys]
                    repeatCount++
                }
                keysRemaining.forEach((key) => {
                    cache[key].reject(Infinity, new DeferredCacheException(`Required key "${key}" failed invalidation retry ten times`))
                })
            })())
        }
    }

    async flush() {
        if (this._promises.length) {
            await Promise.all(this._promises)
        }
    }

    clear() {
        this._cache = {}
        this._promises = []
    }

    invalidate(key: string) {
        if (key in this._cache) {
            if (this._cache[key].isFulfilled || this._cache[key].isRejected) {
                delete this._cache[key]
            }
            else {
                this._cache[key].invalidate()
            }
        }
    }

    set(invalidationCounter: number, key: string, value: T): boolean {
        if (!(key in this._cache)) {
            this._cache[key] = new Deferred<T>()
        }
        if (this._callback) {
            this._callback(key, value)
        }
        return this._cache[key].resolve(invalidationCounter, value)
    }

    isCached(key: string): boolean {
        return (key in this._cache)
    }
}