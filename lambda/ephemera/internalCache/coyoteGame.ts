import { CacheBase } from '@tonylb/mtw-lambda-patterns/ts/internalCache'

export type CacheCoyoteGameKeys = 'gameRooms'

type CoyoteGameCacheState = {
    gameRooms: string[]
}

const defaultCoyoteGameData: CoyoteGameCacheState = {
    gameRooms: ['VORTEX', 'STRAIGHTAWAY', 'CLIFFTOP', 'CORNER', 'BRIDGE']
}

// Temporary invocation-scoped cache for the Coyote Game experimental tech demo.
// This is intentionally hard-coded and may be replaced by durable fetches later.
export class CacheCoyoteGameData extends CacheBase {
    private state: CoyoteGameCacheState = {
        gameRooms: [...defaultCoyoteGameData.gameRooms]
    }

    get(key: 'gameRooms'): Promise<string[]>
    get(key: CacheCoyoteGameKeys): Promise<string[]>
    async get(key: CacheCoyoteGameKeys) {
        return this.state[key]
    }

    set(props: { key: 'gameRooms', value: string[] }): void
    set(props: { key: CacheCoyoteGameKeys, value: string[] }): void {
        this.state[props.key] = props.value
    }

    override clear() {
        this.state = {
            gameRooms: [...defaultCoyoteGameData.gameRooms]
        }
        super.clear()
    }
}

export default CacheCoyoteGameData
