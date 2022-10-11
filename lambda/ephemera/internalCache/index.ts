import { CacheConstructor, CacheBase } from './baseClasses'

import { connectionDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index'
import { delayPromise } from '@tonylb/mtw-utilities/dist/dynamoDB/delayPromise'
import CacheRoomCharacterLists from './roomCharacterLists';
import CacheCharacterMeta from './characterMeta';
import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB';
import CacheCharacterConnections from './characterConnections';
import AssetState from './assetState';
import DependencyGraph from './dependencyGraph';
import ComponentMeta from './componentMeta';
import ComponentRender from './componentRender';
import { EphemeraCharacterId } from '../cacheAsset/baseClasses';
import CacheCharacterPossibleMaps from './characterPossibleMaps';

type CacheGlobalKeys = 'ConnectionId' | 'RequestId' | 'player' | 'assets' | 'connections' | 'mapSubscriptions'

export type MapSubscriptionConnection = {
    connectionId: string;
    characterIds: EphemeraCharacterId[]
}

class CacheGlobalData {
    ConnectionId?: string;
    RequestId?: string;
    player?: string;
    assets?: string[];
    connections?: string[];
    mapSubscriptions?: MapSubscriptionConnection[];
    get(key: 'ConnectionId' | 'RequestId' | 'player'): Promise<string | undefined>
    get(key: 'assets' | 'connections'): Promise<string[] | undefined>
    get(key: 'mapSubscriptions'): Promise<MapSubscriptionConnection[] | undefined>
    get(key: CacheGlobalKeys): Promise<string | string[] | MapSubscriptionConnection[] | undefined>
    async get(key: CacheGlobalKeys) {
        switch(key) {
            case 'player':
                if (!this.player && this.ConnectionId) {
                    //
                    // TODO: Replace repeated attempts with exponential backoff by
                    // refactoring connectionDB.getItem to allow a consistent argument
                    // that can actviate strongly-consistent reads
                    //
                    let attempts = 0
                    let exponentialBackoff = 50
                    while(attempts < 5) {
                        const { player = '' } = await connectionDB.getItem<{ player: string }>({
                            ConnectionId: `CONNECTION#${this.ConnectionId}`,
                            DataCategory: 'Meta::Connection',
                            ProjectionFields: ['player']
                        }) || {}
                        if (player) {
                            this.player = player
                            return player
                        }
                        attempts += 1
                        await delayPromise(exponentialBackoff)
                        exponentialBackoff = exponentialBackoff * 2
                    }
                    console.log(`Exponential backoff on player caching failed after five attempts (${this.ConnectionId})`)
                }
                return this.player
            case 'assets':
                if (typeof this.assets === 'undefined') {
                    const { assets = [] } = (await ephemeraDB.getItem<{ assets: string[] }>({
                        EphemeraId: 'Global',
                        DataCategory: 'Assets',
                        ProjectionFields: ['assets']
                    })) || {}
                    this.assets = assets
                }
                return this.assets
            case 'connections':
                if (typeof this.connections === 'undefined') {
                    const { connections = {} } = (await connectionDB.getItem<{ connections: Record<string, string> }>({
                        ConnectionId: 'Global',
                        DataCategory: 'Connections',
                        ProjectionFields: ['connections']
                    })) || {}
                    this.connections = Object.keys(connections)
                }
                return this.connections
            case 'mapSubscriptions':
                if (typeof this.mapSubscriptions === 'undefined') {
                    const { connections = [] } = (await connectionDB.getItem<{ connections: MapSubscriptionConnection[] }>({
                        ConnectionId: 'Map',
                        DataCategory: 'Subscriptions',
                        ProjectionFields: ['connections']
                    })) || {}
                    this.mapSubscriptions = connections
                }
            default:
                return this[key]
        }
    }

    clear() {
        this.ConnectionId = undefined
        this.RequestId = undefined
        this.player = undefined
        this.assets = undefined
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

const InternalCache = CacheCharacterPossibleMaps(ComponentRender(ComponentMeta(AssetState(DependencyGraph(CacheCharacterConnections(CacheCharacterMeta(CacheRoomCharacterLists(CacheGlobal(CacheBase)))))))))
export const internalCache = new InternalCache()
export default internalCache
