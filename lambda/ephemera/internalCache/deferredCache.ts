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

    set (invalidationCounter: number, value: T): boolean {
        if (invalidationCounter < this.invalidationCounter) {
            return false
        }
        if (this.isFulfilled || this.isRejected) {
            this.promise = new Promise((resolve, reject)=> {
                this._reject = reject
                this._resolve = resolve
            })
            this.isRejected = false
        }
        this._resolve(value)
        this.isFulfilled = true
        return true
    }
    
}

export class DeferredCacheException extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'DeferredCacheException'
    }
}

type DeferredCacheGeneralOutputDistributor<K, T, A> = {
    promiseFactory: (keys: K[]) => Promise<A>;
    requiredKeys: K[];
    transform: (args: A) => [K, T][];
}

export class DeferredCacheGeneral <K, T>{
    _cache: [K, Deferred<T>][] = [];
    _promises: Promise<any>[] = [];
    _callback?: (key: K, value: T) => void;
    _default?: (key: K) => T;
    _comparison: (keyA: K, keyB: K) => boolean;

    constructor({ callback, defaultValue, comparison }: { callback?: (key: K, value: T) => void, defaultValue?: (key: K) => T, comparison: (keyA: K, keyB: K) => boolean }) {
        this._callback = callback
        this._default = defaultValue
        this._comparison = comparison
    }

    _find(key: K): Deferred<T> | undefined {
        const cachedRecord = this._cache.find(([keyB]) => (this._comparison(key, keyB)))
        return cachedRecord?.[1]
    }

    async get(key: K): Promise<T> {
        const cachedRecord = this._find(key)
        if (cachedRecord) {
            return cachedRecord.promise
        }
        throw new DeferredCacheException(`Key "${key}" not defined in cache`)
    }

    generalAdd<A>({ promiseFactory, requiredKeys, transform }: DeferredCacheGeneralOutputDistributor<K, T, A>): void {
        let fetchNeeded: K[] = []
        requiredKeys.forEach((key) => {
            if (!this._find(key)) {
                fetchNeeded.push(key)
                this._cache.push([key, new Deferred<T>()])
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
                    let invalidatedKeys: K[] = []
                    let invalidationCounters = keysRemaining.map<[K, number]>((key) => {
                        const cachedRecord = this._find(key)
                        return [key, cachedRecord ? cachedRecord.invalidationCounter : 0]
                    })
                    const getInvalidationCounter = (key: K) => (invalidationCounters.find(([keyB]) => (this._comparison(key, keyB)))?.[1] || 0)
                    await promiseFactory(keysRemaining)
                        .then((output) => (transform(output)))
                        .then((output) => {
                            output.forEach(([key, value]) => {
                                if (!this.set(getInvalidationCounter(key), key, value) && (keysRemaining.includes(key))) {
                                    invalidatedKeys.push(key)
                                }
                            })
                            const failedKeys = keysRemaining.filter((key) => (!(output.find(([keyB]) => (this._comparison(key, keyB))))))
                            if (failedKeys.length) {
                                const defaultFunc = this._default
                                if (!(typeof defaultFunc === 'undefined')) {
                                    failedKeys.forEach((key) => {
                                        if (!this.set(getInvalidationCounter(key), key, defaultFunc(key))) {
                                            invalidatedKeys.push(key)
                                        }
                                    })
                                }
                                else {
                                    console.log(`FAILED KEYS: ${JSON.stringify(failedKeys, null, 4)}`)
                                    failedKeys.forEach((key) => {
                                        const cachedKey = this._find(key)
                                        if (!cachedKey || !cachedKey.reject(getInvalidationCounter(key), new DeferredCacheException(`Required key "${key}" not returned by promise`))) {
                                            invalidatedKeys.push(key)
                                        }
                                    })
                                }
                            }
                        })
                    keysRemaining = [...invalidatedKeys]
                    repeatCount++
                }
                keysRemaining.forEach((key) => {
                    let cachedKey = this._find(key)
                    if (!cachedKey) {
                        cachedKey = new Deferred<T>()
                        this._cache.push([key, cachedKey])
                    }
                    cachedKey.reject(Infinity, new DeferredCacheException(`Required key "${key}" failed invalidation retry ten times`))
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
        //
        // TODO: Prevent clear when there are unresolved promises outstanding (since losing the connections between promise and Deferred could
        // lead to infinitely locked awaits)
        //
        this._cache = []
        this._promises = []
    }

    invalidate(key: K) {
        const cachedKey = this._find(key)
        if (cachedKey) {
            if (cachedKey.isFulfilled || cachedKey.isRejected) {
                this._cache = this._cache.filter(([keyB]) => (!this._comparison(key, keyB)))
            }
            else {
                cachedKey.invalidate()
            }
        }
    }

    set(invalidationCounter: number, key: K, value: T): boolean {
        let cachedKey = this._find(key)
        if (!cachedKey) {
            cachedKey = new Deferred<T>()
            this._cache.push([key, cachedKey])
        }
        if (this._callback) {
            this._callback(key, value)
        }
        return cachedKey.set(invalidationCounter, value)
    }

    isCached(key: K): boolean {
        return Boolean(this._find(key))
    }
}

type DeferredCacheOutputDistributor<T, A> = {
    promiseFactory: (keys: string[]) => Promise<A>;
    requiredKeys: string[];
    transform: (args: A) => Record<string, T>;
}

export class DeferredCache<T> extends DeferredCacheGeneral<string, T> {
    constructor({ callback, defaultValue }: { callback?: (key: string, value: T) => void, defaultValue?: (key: string) => T } = {}) {
        super({ callback, defaultValue, comparison: (keyA: string, keyB: string) => (keyA === keyB) })
    }

    add<A>({ promiseFactory, requiredKeys, transform }: DeferredCacheOutputDistributor<T, A>): void {
        this.generalAdd<A>({
            promiseFactory,
            requiredKeys,
            transform: (args: A) => {
                const generalArgs = transform(args)
                return Object.entries(generalArgs)
            }
        })
    }
}