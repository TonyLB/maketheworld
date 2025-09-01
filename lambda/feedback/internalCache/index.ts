import { CacheSessionConnectionsData } from '@tonylb/mtw-sessions/ts/sessionCache'

export class InternalCache {
    SessionConnections: CacheSessionConnectionsData = new CacheSessionConnectionsData()

    clear() {
        this.SessionConnections.clear()
    }
}

export default new InternalCache()
