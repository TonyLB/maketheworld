import { connectionDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { CacheConstructor } from './baseClasses'

export class CachePlayerConnectionsData {
    ConnectionsByPlayer: Promise<Record<string, string[]>> | undefined;
    clear() {
        this.ConnectionsByPlayer = undefined
    }
    async get(player: string): Promise<string[] | undefined> {
        if (!(this.ConnectionsByPlayer)) {
            this.ConnectionsByPlayer = connectionDB.getItem<{ connections: Record<string, string> }>({
                    ConnectionId: 'Global',
                    DataCategory: 'Connections',
                    ProjectionFields: ['connections']
                }).then((value) => (value?.connections))
                .then((connections) => (
                    Object.entries(connections || {}).reduce<Record<string, string[]>>((previous, [connectionId, player]) => ({
                        ...previous,
                        [player]: [
                            ...(previous[player] || []),
                            connectionId
                        ]
                    }), {})
                ))
        }
        return (await this.ConnectionsByPlayer)[player]
    }
}

export const CachePlayerConnections = <GBase extends CacheConstructor>(Base: GBase) => {
    return class CachePlayerConnections extends Base {
        PlayerConnections: CachePlayerConnectionsData = new CachePlayerConnectionsData()

        override clear() {
            this.PlayerConnections.clear()
            super.clear()
        }
    }
}

export default CachePlayerConnections
