import { connectionDB, META_SESSION_PK, sessionIdFromMetaSortKey } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { CacheConstructor } from './baseClasses'

export class CachePlayerSessionsData {
    SessionsByPlayer: Promise<Record<string, string[]>> | undefined;
    clear() {
        this.SessionsByPlayer = undefined
    }
    async get(player: string): Promise<string[] | undefined> {
        if (!(this.SessionsByPlayer)) {
            this.SessionsByPlayer = connectionDB.query<{ ConnectionId: string; DataCategory: string; player?: string }>({
                    Key: {
                        ConnectionId: META_SESSION_PK
                    },
                    KeyConditionExpression: 'begins_with(DataCategory, :prefix)',
                    ExpressionAttributeValues: {
                        ':prefix': 'SESSION#'
                    },
                    ProjectionFields: ['DataCategory', 'player'],
                    ConsistentRead: true
                }).then((sessions) => (
                    (sessions || []).reduce<Record<string, string[]>>((previous, { DataCategory, player }) => {
                        const sessionId = sessionIdFromMetaSortKey(DataCategory)
                        if (!player || !sessionId) {
                            return previous
                        }
                        return {
                            ...previous,
                            [player]: [...(previous[player] || []), sessionId]
                        }
                    }, {})
                ))
                .then((sessionsByPlayer) => (
                    Object.fromEntries(
                        Object.entries(sessionsByPlayer).map(([key, values]) => (
                            [key, [...new Set(values)]]
                        ))
                    ) as Record<string, string[]>
                ))
        }
        return (await this.SessionsByPlayer)[player]
    }
}
