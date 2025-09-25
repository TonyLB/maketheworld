import { MetaData } from "./meta"
import { S3Client } from "@aws-sdk/client-s3"

type CacheConnectionKeys = 's3Client'
class CacheConnectionData {
    s3Client?: S3Client;
    get(key: 's3Client'): Promise<S3Client | undefined>
    get(key: CacheConnectionKeys): Promise<S3Client | undefined>
    async get(key: CacheConnectionKeys): Promise<S3Client | undefined> {
        return this[key]
    }
    
    set(props: { key: 's3Client', value: S3Client; }): void
    set({ key, value }: { key: CacheConnectionKeys, value: any }): void {
        this[key] = value
    }
    
    clear() {
        this.s3Client = undefined
    }
}

class InternalCache {
    Meta: MetaData = new MetaData()
    Connection: CacheConnectionData = new CacheConnectionData()
    
    constructor() {
    }

    clear(): void {
        this.Meta.clear()
        this.Connection.clear()
    }

    async flush(): Promise<void> {
    }
}
export const internalCache = new InternalCache()
export default internalCache
