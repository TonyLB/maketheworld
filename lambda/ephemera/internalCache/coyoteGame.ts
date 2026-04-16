import { CacheBase } from '@tonylb/mtw-lambda-patterns/ts/internalCache'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

export type CacheCoyoteGameKeys = 'gameRooms' | 'intent'

type CoyoteGameCacheState = {
    gameRooms: string[]
    intent?: string
}

const defaultCoyoteGameData: CoyoteGameCacheState = {
    gameRooms: ['VORTEX', 'STRAIGHTAWAY', 'CLIFFTOP', 'CORNER', 'BRIDGE'],
    intent: undefined,
}

const COYOTE_GAME_INTENT_KEY = {
    EphemeraId: 'Global',
    DataCategory: 'CoyoteGame#Intent',
} as const

// Temporary invocation-scoped cache for the Coyote Game experimental tech demo.
// This is intentionally hard-coded and may be replaced by durable fetches later.
export class CacheCoyoteGameData extends CacheBase {
    private _inFlightIntent?: Promise<string>
    private state: CoyoteGameCacheState = {
        gameRooms: [...defaultCoyoteGameData.gameRooms],
        intent: defaultCoyoteGameData.intent,
    }

    constructor(private readonly deps: {
        generateIntent: () => Promise<string>
    }) {
        super()
    }

    get(key: 'gameRooms'): Promise<string[]>
    get(key: 'intent'): Promise<string>
    get(key: CacheCoyoteGameKeys): Promise<string[] | string>
    async get(key: CacheCoyoteGameKeys) {
        if (key === 'gameRooms') {
            return this.state.gameRooms
        }
        if (typeof this.state.intent === 'string') {
            return this.state.intent
        }
        if (this._inFlightIntent) {
            return this._inFlightIntent
        }
        this._inFlightIntent = this.loadIntent()
        try {
            const intent = await this._inFlightIntent
            return intent
        } finally {
            this._inFlightIntent = undefined
        }
    }

    private async loadIntent(): Promise<string> {
        const fetched = await ephemeraDB.getItem<{ intent?: string }>({
            Key: COYOTE_GAME_INTENT_KEY,
            ProjectionFields: ['intent'],
        })
        if (typeof fetched?.intent === 'string' && fetched.intent.length > 0) {
            this.state.intent = fetched.intent
            return fetched.intent
        }
        const generated = await this.deps.generateIntent()
        await ephemeraDB.putItem({
            ...COYOTE_GAME_INTENT_KEY,
            intent: generated,
        })
        this.state.intent = generated
        return generated
    }

    set(props: { key: 'gameRooms', value: string[] }): void
    set(props: { key: 'intent', value: string }): void
    set(props: { key: CacheCoyoteGameKeys, value: string[] | string }): void {
        if (props.key === 'gameRooms') {
            this.state.gameRooms = props.value as string[]
            return
        }
        this.state.intent = props.value as string
    }

    async invalidate(key: 'intent'): Promise<void> {
        void key
        this.state.intent = undefined
        this._inFlightIntent = undefined
        await ephemeraDB.deleteItem(COYOTE_GAME_INTENT_KEY)
    }

    override clear() {
        this.state = {
            gameRooms: [...defaultCoyoteGameData.gameRooms],
            intent: defaultCoyoteGameData.intent,
        }
        this._inFlightIntent = undefined
        super.clear()
    }
}

export default CacheCoyoteGameData
