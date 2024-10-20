export class Deferred <T>{
    invalidationCounter: number;
    promise: Promise<T>;
    _resolve: (value: T) => void = () => {}
    _reject: () => void = () => {}
    isFulfilled: boolean = false
    isRejected: boolean = false
    constructor() {
        this.invalidationCounter = 0
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

    reject (invalidationCounter: number): void {
        if (invalidationCounter >= this.invalidationCounter) {
            this._reject()
            this.isRejected = true
        }
    }
}

export class CacheBase {
    clear() {}
    async flush() {}
}

type Constructor<T = {}> = new (...args: any[]) => T;

export type CacheConstructor = Constructor<{
    clear(): void;
    flush(): Promise<void>;
}>
