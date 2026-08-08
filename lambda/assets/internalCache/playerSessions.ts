import { connectionDB, playerSessionsPK, sessionIdFromMetaSortKey } from "@tonylb/mtw-utilities/ts/dynamoDB"
import { CacheConstructor } from './baseClasses'

export class CachePlayerSessionsData {
    SessionsByPlayer: Record<string, Promise<string[]>> = {};
    clear() {
        this.SessionsByPlayer = {}
    }
    async get(player: string): Promise<string[] | undefined> {
        if (!(player in this.SessionsByPlayer)) {
            this.SessionsByPlayer[player] = connectionDB.query<{ ConnectionId: string; DataCategory: string }>({
                    Key: {
                        ConnectionId: playerSessionsPK(player)
                    },
                    ProjectionFields: ['DataCategory'],
                    ConsistentRead: true
                }).then((pointers) => (
                    [...new Set(
                        (pointers || [])
                            .map(({ DataCategory }) => (sessionIdFromMetaSortKey(DataCategory)))
                            .filter((sessionId): sessionId is string => Boolean(sessionId))
                    )]
                ))
        }
        return await this.SessionsByPlayer[player]
    }
}
