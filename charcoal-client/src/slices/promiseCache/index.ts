import { v4 as uuidv4 } from 'uuid'

//
// Putting non-serializable items like promises into the Redux cache is a big no-no, and we don't *really*
// need to have access to the darn things through selectors anyway (since all the promise logic is
// internal to black-box mechanisms that just store *data* in the Redux store). The promise cache class
// provides a mechanism to store string pointers to promises, instead of the promises themselves, to
// be good Redux citizens.
//

type PromiseCacheElement<D> = {
    key: string;
    promise: Promise<D>;
    _resolve: (value: D) => void;
    _reject: (value: D) => void;
}

export class PromiseCache<D> {
    _cache: Record<string, PromiseCacheElement<D>> = {}

    add(): Omit<PromiseCacheElement<D>, '_resolve' | '_reject'> {
        const key = uuidv4()
        let cacheElement: Partial<PromiseCacheElement<D>> = { key }
        const promise = new Promise<D>((resolve, reject) => {
            cacheElement._resolve = resolve
            cacheElement._reject = reject
        })
        cacheElement.promise = promise
        this._cache[key] = cacheElement as PromiseCacheElement<D>
        return {
            key,
            promise
        }
    }

    resolve(key: string, data: D) {
        if (key in this._cache) {
            this._cache[key]._resolve(data)
        }
    }

    reject(key: string, data: D) {
        if (key in this._cache) {
            this._cache[key]._reject(data)
        }
    }
}
