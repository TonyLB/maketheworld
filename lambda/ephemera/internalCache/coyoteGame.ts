import type { RenderTree } from '@tonylb/mtw-base/ts/renderTree'
import { isRenderTree } from '@tonylb/mtw-base/ts/renderTree'
import { CacheBase } from '@tonylb/mtw-lambda-patterns/ts/internalCache'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

export type CacheCoyoteGameKeys = 'gameRooms' | 'intent' | 'outcome'

type CoyoteGameCacheState = {
    gameRooms: string[]
    intent?: string
    outcome?: RenderTree
}

const defaultCoyoteGameData: CoyoteGameCacheState = {
    gameRooms: ['VORTEX', 'STRAIGHTAWAY', 'CLIFFTOP', 'CORNER', 'BRIDGE'],
    intent: undefined,
    outcome: undefined,
}

const COYOTE_GAME_INTENT_KEY = {
    EphemeraId: 'Global',
    DataCategory: 'CoyoteGame#Intent',
} as const

const COYOTE_GAME_OUTCOME_KEY = {
    EphemeraId: 'Global',
    DataCategory: 'CoyoteGame#Outcome',
} as const

// Temporary invocation-scoped cache for the Coyote Game experimental tech demo.
// This is intentionally hard-coded and may be replaced by durable fetches later.
export class CacheCoyoteGameData extends CacheBase {
    private _inFlightIntent?: Promise<string>
    private _inFlightOutcome?: Promise<RenderTree>
    private state: CoyoteGameCacheState = {
        gameRooms: [...defaultCoyoteGameData.gameRooms],
        intent: defaultCoyoteGameData.intent,
        outcome: defaultCoyoteGameData.outcome,
    }

    constructor(private readonly deps: {
        generateIntent: () => Promise<string>
        generateOutcome: () => Promise<RenderTree>
    }) {
        super()
    }

    get(key: 'gameRooms'): Promise<string[]>
    get(key: 'intent'): Promise<string>
    get(key: 'outcome'): Promise<RenderTree>
    get(key: CacheCoyoteGameKeys): Promise<string[] | string | RenderTree>
    async get(key: CacheCoyoteGameKeys) {
        if (key === 'gameRooms') {
            return this.state.gameRooms
        }
        if (key === 'intent') {
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
        if (key === 'outcome') {
            if (this.state.outcome !== undefined && isRenderTree(this.state.outcome)) {
                return this.state.outcome
            }
            if (this._inFlightOutcome) {
                return this._inFlightOutcome
            }
            this._inFlightOutcome = this.loadOutcome()
            try {
                const outcome = await this._inFlightOutcome
                return outcome
            } finally {
                this._inFlightOutcome = undefined
            }
        }
        const _exhaustive: never = key
        return _exhaustive
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

    private async loadOutcome(): Promise<RenderTree> {
        const fetched = await ephemeraDB.getItem<{ outcome?: unknown }>({
            Key: COYOTE_GAME_OUTCOME_KEY,
            ProjectionFields: ['outcome'],
        })
        if (fetched?.outcome !== undefined && isRenderTree(fetched.outcome)) {
            this.state.outcome = fetched.outcome
            return fetched.outcome
        }
        const generated = await this.deps.generateOutcome()
        await ephemeraDB.putItem({
            ...COYOTE_GAME_OUTCOME_KEY,
            outcome: generated,
        })
        this.state.outcome = generated
        return generated
    }

    set(props: { key: 'gameRooms', value: string[] }): void
    set(props: { key: 'intent', value: string }): void
    set(props: { key: 'outcome', value: RenderTree }): void
    set(props: { key: CacheCoyoteGameKeys, value: string[] | string | RenderTree }): void {
        if (props.key === 'gameRooms') {
            this.state.gameRooms = props.value as string[]
            return
        }
        if (props.key === 'intent') {
            this.state.intent = props.value as string
            return
        }
        this.state.outcome = props.value as RenderTree
    }

    async invalidate(key: 'intent' | 'outcome'): Promise<void> {
        if (key === 'intent') {
            this.state.intent = undefined
            this._inFlightIntent = undefined
            await ephemeraDB.deleteItem(COYOTE_GAME_INTENT_KEY)
            return
        }
        this.state.outcome = undefined
        this._inFlightOutcome = undefined
        await ephemeraDB.deleteItem(COYOTE_GAME_OUTCOME_KEY)
    }

    override clear() {
        this.state = {
            gameRooms: [...defaultCoyoteGameData.gameRooms],
            intent: defaultCoyoteGameData.intent,
            outcome: defaultCoyoteGameData.outcome,
        }
        this._inFlightIntent = undefined
        this._inFlightOutcome = undefined
        super.clear()
    }
}

export default CacheCoyoteGameData
