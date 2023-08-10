export class CacheBase {
    clear() {}
    async flush() {}
}

type Constructor<T = {}> = new (...args: any[]) => T;

export type CacheConstructor = Constructor<{
    clear(): void;
    flush(): Promise<void>;
}>
