import { MetaData } from "./meta"

class InternalCache {
    Meta: MetaData = new MetaData()
    
    constructor() {
    }

    clear(): void {
        this.Meta.clear()
    }

    async flush(): Promise<void> {
    }
}
export const internalCache = new InternalCache()
export default internalCache
