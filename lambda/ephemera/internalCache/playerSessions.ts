import { connectionDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

export class CachePlayerSessionsData {
    SessionsByPlayer: Promise<Record<string, string[]>> | undefined;
    clear() {
        this.SessionsByPlayer = undefined
    }
    async get(player: string): Promise<string[] | undefined> {
        if (!(this.SessionsByPlayer)) {
            this.SessionsByPlayer = connectionDB.getItem<{ sessions: Record<string, string> }>({
                    Key: {
                        ConnectionId: 'Global',
                        DataCategory: 'Sessions'
                    },
                    ProjectionFields: ['sessions']
                }).then((value) => (value?.sessions))
                .then((sessions) => (
                    Object.entries(sessions || {}).reduce<Record<string, string[]>>((previous, [sessionId, player]) => ({
                        ...previous,
                        [player]: [
                            ...(previous[player] || []),
                            sessionId
                        ]
                    }), {})
                ))
        }
        return (await this.SessionsByPlayer)[player]
    }
}

export default CachePlayerSessionsData
