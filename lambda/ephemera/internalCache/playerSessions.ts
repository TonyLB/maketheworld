import { connectionDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { CacheConstructor } from './baseClasses'

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
                        DataCategory: 'Connections'
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

export const CachePlayerSessions = <GBase extends CacheConstructor>(Base: GBase) => {
    return class CachePlayerSessions extends Base {
        PlayerSessions: CachePlayerSessionsData = new CachePlayerSessionsData()

        override clear() {
            this.PlayerSessions.clear()
            super.clear()
        }
    }
}

export default CachePlayerSessions
