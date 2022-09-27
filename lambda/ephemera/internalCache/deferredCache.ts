export class Deferred <T>{
    promise: Promise<T>;
    resolve: (value: T) => void = () => {}
    reject: () => void = () => {}
    constructor() {
        this.promise = new Promise((resolve, reject)=> {
            this.reject = reject
            this.resolve = resolve
        })
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

    constructor(callback?: (key: string, value: T) => void) {
        this._callback = callback
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
            this._promises.push(promiseFactory(fetchNeeded)
                .then((output) => (transform(output)))
                .then((output) => {
                    Object.entries(output).forEach(([key, value]) => {
                        this.set(key, value)
                    })
                    const failedKeys = fetchNeeded.filter((key) => (!(Object.keys(output).includes(key))))
                    if (failedKeys.length) {
                        failedKeys.forEach((key) => {
                            cache[key].reject()
                        })
                        throw new DeferredCacheException(`Required key "${failedKeys[0]}" not returned by promise`)
                    }
                })
            )
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
        delete this._cache[key]
    }

    set(key: string, value: T) {
        if (!(key in this._cache)) {
            this._cache[key] = new Deferred<T>()
        }
        if (this._callback) {
            this._callback(key, value)
        }
        this._cache[key].resolve(value)
    }
}