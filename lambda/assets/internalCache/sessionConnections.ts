import { connectionDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { CacheConstructor } from './baseClasses'

export class CacheSessionConnectionsData {
    ConnectionsBySessionId: Record<string, Promise<string[] | undefined>> = {};
    clear() {
        this.ConnectionsBySessionId = {}
    }
    async get(sessionId: string[]): Promise<string[] | undefined>
    async get(sessionId: string): Promise<string[] | undefined>
    async get(sessionId: string | string[]): Promise<string[] | undefined> {
        if (Array.isArray(sessionId)) {
            const sessionReturns = await Promise.all(sessionId.map((internalSession) => (this.get(internalSession))))
            return sessionReturns.map((connectionIds) => (connectionIds ?? [])).flat(1)
        }
        if (!(this.ConnectionsBySessionId[sessionId])) {
            this.ConnectionsBySessionId[sessionId] = connectionDB.getItem<{ connections: string[] }>({
                    Key: {
                        ConnectionId: `SESSION#${sessionId}`,
                        DataCategory: 'Meta::Session'
                    },
                    ProjectionFields: ['connections'],
                }).then((value) => (value?.connections))
        }
        return await this.ConnectionsBySessionId[sessionId]
    }

    set(sessionId: string, connections: string[]): void {
        this.ConnectionsBySessionId[sessionId] = Promise.resolve(connections)
    }
}

export const CacheSessionConnections = <GBase extends CacheConstructor>(Base: GBase) => {
    return class CacheSessionConnections extends Base {
        SessionConnections: CacheSessionConnectionsData = new CacheSessionConnectionsData()

        override clear() {
            this.SessionConnections.clear()
            super.clear()
        }
    }
}

export default CacheSessionConnections
