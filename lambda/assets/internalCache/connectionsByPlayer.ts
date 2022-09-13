import { connectionDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { CacheConstructor } from './baseClasses'

export class CacheConnectionsByPlayerData {
    ConnectionsByPlayer?: Record<string, string[]>;
    clear() {
        this.ConnectionsByPlayer = undefined
    }
    async get(player: string): Promise<string[]> {
        if (!this.ConnectionsByPlayer) {
            const { connections = {} } = (await connectionDB.getItem<{ connections: Record<string, string> }>({
                ConnectionId: 'Global',
                DataCategory: 'Connections',
                ProjectionFields: ['connections']
            })) || {}
            this.ConnectionsByPlayer = Object.entries(connections)
                .reduce<Record<string, string[]>>((previous, [key, value]) => ({
                    ...previous,
                    [value]: [
                        ...(previous[value] || []),
                        key
                    ]
                }), {})
        }
        return (this.ConnectionsByPlayer || {})[player] || []
    }
}

export const CacheConnectionsByPlayer = <GBase extends CacheConstructor>(Base: GBase) => {
    return class CacheConnectionsByPlayer extends Base {
        ConnectionsByPlayer: CacheConnectionsByPlayerData = new CacheConnectionsByPlayerData()

        override clear() {
            this.ConnectionsByPlayer.clear()
            super.clear()
        }
    }
}

export default CacheConnectionsByPlayer
