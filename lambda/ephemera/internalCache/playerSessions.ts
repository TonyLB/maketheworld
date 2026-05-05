import { connectionDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

export class CachePlayerSessionsData {
    SessionsByPlayer: Promise<Record<string, string[]>> | undefined;
    clear() {
        this.SessionsByPlayer = undefined
    }
    async get(player: string): Promise<string[] | undefined> {
        if (!(this.SessionsByPlayer)) {
            this.SessionsByPlayer = connectionDB.query<{ ConnectionId: string; DataCategory: string; player?: string }>({
                    IndexName: 'DataCategoryIndex',
                    Key: {
                        DataCategory: 'Meta::Session'
                    },
                    ProjectionFields: ['ConnectionId', 'player']
                }).then((sessions) => (
                    (sessions || []).reduce<Record<string, string[]>>((previous, { ConnectionId, player }) => ({
                        ...previous,
                        ...(player
                            ? {
                                [player]: [
                                    ...(previous[player] || []),
                                    ConnectionId.startsWith('SESSION#') ? ConnectionId.slice(8) : ConnectionId
                                ]
                            }
                            : {})
                    }), {})
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

export default CachePlayerSessionsData
