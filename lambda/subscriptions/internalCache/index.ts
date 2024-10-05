import { CacheConstructor, CacheBase } from './baseClasses'

import { connectionDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index'
import { delayPromise } from '@tonylb/mtw-utilities/dist/dynamoDB/delayPromise'
import CacheCharacterSessions from './characterSessions'
import CacheSessionConnections from './sessionConnections'
import CachePlayerSessions from './playerSessions'

type CacheGlobalKeys = 'ConnectionId' | 'SessionId' | 'RequestId' | 'player'

export class CacheGlobalData {
    ConnectionId?: string;
    RequestId?: string;
    player?: string;
    SessionId?: string;
    get(key: 'ConnectionId' | 'RequestId' | 'player' | 'SessionId'): Promise<string | undefined>
    get(key: CacheGlobalKeys): Promise<string | string[] | undefined>
    async get(key: CacheGlobalKeys) {
        switch(key) {
            case 'player':
            case 'SessionId':
                if (this.ConnectionId && !(this.player && this.SessionId)) {
                    const { player = '', SessionId = '' } = await connectionDB.getItem<{ player: string; SessionId: string; }>({
                        Key: {
                            ConnectionId: `CONNECTION#${this.ConnectionId}`,
                            DataCategory: 'Meta::Connection'
                        },
                        ProjectionFields: ['player', 'SessionId'],
                        ConsistentRead: true
                    }) || {}
                    if (player && SessionId) {
                        this.player = player
                        this.SessionId = SessionId
                    }
                }
                return key === 'player' ? this.player : this.SessionId
            default:
                return this[key]
        }
    }

    clear() {
        this.ConnectionId = undefined
        this.RequestId = undefined
        this.player = undefined
        this.SessionId = undefined
    }

    set(props: { key: 'ConnectionId' | 'RequestId', value: string; }): void {
        this[props.key] = props.value
    }
}

export const CacheGlobal = <GBase extends CacheConstructor>(Base: GBase) => {
    return class CacheGlobal extends Base {
        Global: CacheGlobalData = new CacheGlobalData()

        override clear() {
            this.Global.clear()
            super.clear()
        }
    }
}

const InternalCache = CachePlayerSessions(CacheCharacterSessions(CacheSessionConnections(CacheGlobal(CacheBase))))
export const internalCache = new InternalCache()
export default internalCache
