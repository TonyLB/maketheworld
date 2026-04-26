import type { RenderTree } from '@tonylb/mtw-base/ts/renderTree'
import { isRenderTree } from '@tonylb/mtw-base/ts/renderTree'
import type { CoyotePhasePlan } from '@tonylb/mtw-interfaces/ts/coyotePhasePlan'
import { CacheBase } from '@tonylb/mtw-lambda-patterns/ts/internalCache'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

export type CacheCoyoteGameKeys = 'gameRooms' | 'intent' | 'outcome'

/**
 * Durable Coyote hypothesis row: the **`Hypothesis:`** line plus optional hop-2 **walkthrough** (scene analysis) and **phasePlan** (when hop-2 JSON validated).
 * **Plan outcome** ([`generatePlanOutcome`](../dataSource/coyoteGame/generatePlanOutcome.ts)) and the Await RoadRunner path use the same cached **`get('intent')`** value (no extra Dynamo read for outcome). If **phasePlan** is absent (validation failed, or legacy data), outcome generation still uses **intent** and optional **walkthrough**; see [`coyoteGame/AGENT.md`](../dataSource/coyoteGame/AGENT.md) (plan outcome).
 */
export type CoyoteGameIntentRecord = {
    intent: string
    /**
     * NOTE: This currently carries hop-2 "## Scene analysis" prompt prose.
     * It has drifted from the original "golden-path walkthrough" intent.
     * Semantic realignment is deferred to a later prompt + handling optimization pass.
     */
    walkthrough?: string
    /** Machine-checkable phase plan when hop-2 JSON validates. */
    phasePlan?: CoyotePhasePlan
}

/** Dynamo row shape; **`sceneAnalysis`** may exist on legacy reads only (mapped into **`walkthrough`**). */
type CoyoteGameDurableIntentRow = {
    intent?: string
    sceneAnalysis?: string
    walkthrough?: string
    phasePlan?: CoyotePhasePlan
}

type CoyoteGameCacheState = {
    gameRooms: string[]
    intent?: CoyoteGameIntentRecord
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

function normalizeDurableIntentRow(fetched: CoyoteGameDurableIntentRow | undefined): CoyoteGameIntentRecord | null {
    if (!fetched || typeof fetched.intent !== 'string' || fetched.intent.length === 0) {
        return null
    }
    const { intent } = fetched
    let walkthrough =
        typeof fetched.walkthrough === 'string' && fetched.walkthrough.length > 0 ? fetched.walkthrough : undefined
    if (walkthrough === undefined) {
        const legacyScene =
            typeof fetched.sceneAnalysis === 'string' && fetched.sceneAnalysis.length > 0
                ? fetched.sceneAnalysis
                : undefined
        // Legacy sceneAnalysis maps into walkthrough for compatibility.
        // Semantic cleanup from Scene Analysis text to true walkthrough is deferred.
        walkthrough = legacyScene
    }
    const phasePlan = fetched.phasePlan
    return {
        intent,
        ...(walkthrough !== undefined ? { walkthrough } : {}),
        ...(phasePlan !== undefined ? { phasePlan } : {}),
    }
}

// Temporary invocation-scoped cache for the Coyote Game experimental tech demo.
// This is intentionally hard-coded and may be replaced by durable fetches later.
export class CacheCoyoteGameData extends CacheBase {
    private _inFlightIntent?: Promise<CoyoteGameIntentRecord>
    private _inFlightOutcome?: Promise<RenderTree>
    private state: CoyoteGameCacheState = {
        gameRooms: [...defaultCoyoteGameData.gameRooms],
        intent: defaultCoyoteGameData.intent,
        outcome: defaultCoyoteGameData.outcome,
    }

    constructor(private readonly deps: {
        generateIntent: () => Promise<CoyoteGameIntentRecord>
        generateOutcome: () => Promise<RenderTree>
    }) {
        super()
    }

    get(key: 'gameRooms'): Promise<string[]>
    get(key: 'intent'): Promise<CoyoteGameIntentRecord>
    get(key: 'outcome'): Promise<RenderTree>
    get(key: CacheCoyoteGameKeys): Promise<string[] | CoyoteGameIntentRecord | RenderTree>
    async get(key: CacheCoyoteGameKeys) {
        if (key === 'gameRooms') {
            return this.state.gameRooms
        }
        if (key === 'intent') {
            if (this.state.intent !== undefined) {
                return this.state.intent
            }
            if (this._inFlightIntent) {
                return this._inFlightIntent
            }
            this._inFlightIntent = this.loadIntent()
            try {
                const intentRecord = await this._inFlightIntent
                return intentRecord
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

    private async loadIntent(): Promise<CoyoteGameIntentRecord> {
        const fetched = await ephemeraDB.getItem<CoyoteGameDurableIntentRow>({
            Key: COYOTE_GAME_INTENT_KEY,
            ProjectionFields: ['intent', 'walkthrough', 'phasePlan', 'sceneAnalysis'],
        })
        const fromDynamo = normalizeDurableIntentRow(fetched ?? undefined)
        if (fromDynamo) {
            this.state.intent = fromDynamo
            return fromDynamo
        }
        const generated = await this.deps.generateIntent()
        await ephemeraDB.putItem({
            ...COYOTE_GAME_INTENT_KEY,
            intent: generated.intent,
            ...(generated.walkthrough !== undefined ? { walkthrough: generated.walkthrough } : {}),
            ...(generated.phasePlan !== undefined ? { phasePlan: generated.phasePlan } : {}),
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
    set(props: { key: 'intent', value: CoyoteGameIntentRecord }): void
    set(props: { key: 'outcome', value: RenderTree }): void
    set(props: { key: CacheCoyoteGameKeys, value: string[] | CoyoteGameIntentRecord | RenderTree }): void {
        if (props.key === 'gameRooms') {
            this.state.gameRooms = props.value as string[]
            return
        }
        if (props.key === 'intent') {
            this.state.intent = props.value as CoyoteGameIntentRecord
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
