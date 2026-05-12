import type { RenderTree } from '@tonylb/mtw-base/ts/renderTree'
import { isRenderTree } from '@tonylb/mtw-base/ts/renderTree'
import type { CoyoteNarrativeBeatsStructured } from '@tonylb/mtw-interfaces/ts/coyoteNarrativeBeatsStructured'
import { CacheBase } from '@tonylb/mtw-lambda-patterns/ts/internalCache'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

import { truncateCoyoteGimmickEcho } from '../dataSource/coyoteGame/generators/pipelines/hypothesis/candidates/parseCandidateOutput'

export type CacheCoyoteGameKeys = 'gameRooms' | 'intent' | 'outcome'

/**
 * Durable Coyote hypothesis row: the **`Hypothesis:`** line plus optional hop-2 **walkthrough** (internal cartoon prose under **`## Cartoon play-by-play`**) and **narrativeBeatsStructured** (when hop-2 JSON validated).
 * Dynamo-backed reads rewrite a legacy first-line **`## Scene analysis`** heading to **`## Cartoon play-by-play`**.
 * **Plan outcome** ([`generatePlanOutcome`](../dataSource/coyoteGame/generators/pipelines/outcome/generatePlanOutcome.ts)) and the Await RoadRunner path use the same cached **`get('intent')`** value (no extra Dynamo read for outcome). If **narrativeBeatsStructured** is absent (validation failed, or legacy data), outcome generation still uses **intent** and optional **walkthrough**; see [`coyoteGame/AGENT.md`](../dataSource/coyoteGame/AGENT.md) (plan outcome).
 * Optional **`gimmick`**: internal-only short spine tag from the plan-select winner (not client-facing).
 */
export type CoyoteGameIntentRecord = {
    intent: string
    /**
     * Hop-2 internal prose; canonical section heading is **`## Cartoon play-by-play`**.
     * It has drifted from the original "golden-path walkthrough" intent for some flows.
     * Semantic realignment is deferred to a later prompt + handling optimization pass.
     */
    walkthrough?: string
    /** Machine-checkable narrative beats when hop-2 JSON validates. */
    narrativeBeatsStructured?: CoyoteNarrativeBeatsStructured
    /** Short spine tag from plan-select winner; absent on legacy rows. */
    gimmick?: string
}

/** Dynamo row shape; **`sceneAnalysis`** may exist on legacy reads only (mapped into **`walkthrough`**). */
type CoyoteGameDurableIntentRow = {
    intent?: string
    sceneAnalysis?: string
    walkthrough?: string
    phasePlan?: unknown
    narrativeBeatsStructured?: CoyoteNarrativeBeatsStructured
    gimmick?: string
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

const LEGACY_SCENE_ANALYSIS_HEADING_LINE = /^\s*##\s+Scene analysis\s*$/i
const CANONICAL_WALKTHROUGH_HEADING_LINE = '## Cartoon play-by-play'

function normalizeGimmickFromStorage(raw: unknown): string | undefined {
    if (typeof raw !== 'string') {
        return undefined
    }
    const normalized = truncateCoyoteGimmickEcho(raw)
    return normalized.length > 0 ? normalized : undefined
}

/** Rewrites legacy first-line `## Scene analysis` to `## Cartoon play-by-play` when loading from Dynamo. */
function normalizeWalkthroughHeadingFromStorage(walkthrough: string | undefined): string | undefined {
    if (walkthrough === undefined) {
        return undefined
    }
    const lines = walkthrough.split(/\r?\n/)
    if (lines.length > 0 && LEGACY_SCENE_ANALYSIS_HEADING_LINE.test(lines[0])) {
        lines[0] = CANONICAL_WALKTHROUGH_HEADING_LINE
    }
    return lines.join('\n')
}

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
        walkthrough = legacyScene
    }
    walkthrough = normalizeWalkthroughHeadingFromStorage(walkthrough)
    const narrativeBeatsStructured = fetched.narrativeBeatsStructured
        ?? (fetched.phasePlan as CoyoteNarrativeBeatsStructured | undefined)
    const gimmick = normalizeGimmickFromStorage(fetched.gimmick)
    return {
        intent,
        ...(walkthrough !== undefined ? { walkthrough } : {}),
        ...(narrativeBeatsStructured !== undefined ? { narrativeBeatsStructured } : {}),
        ...(gimmick !== undefined ? { gimmick } : {}),
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
            ProjectionFields: [
                'intent',
                'walkthrough',
                'narrativeBeatsStructured',
                'phasePlan',
                'sceneAnalysis',
                'gimmick',
            ],
        })
        const fromDynamo = normalizeDurableIntentRow(fetched ?? undefined)
        if (fromDynamo) {
            this.state.intent = fromDynamo
            return fromDynamo
        }
        const generated = await this.deps.generateIntent()
        const gimmickToStore = normalizeGimmickFromStorage(generated.gimmick)
        const intentRecord: CoyoteGameIntentRecord = {
            intent: generated.intent,
            ...(generated.walkthrough !== undefined ? { walkthrough: generated.walkthrough } : {}),
            ...(generated.narrativeBeatsStructured !== undefined
                ? { narrativeBeatsStructured: generated.narrativeBeatsStructured }
                : {}),
            ...(gimmickToStore !== undefined ? { gimmick: gimmickToStore } : {}),
        }
        await ephemeraDB.putItem({
            ...COYOTE_GAME_INTENT_KEY,
            intent: intentRecord.intent,
            ...(intentRecord.walkthrough !== undefined ? { walkthrough: intentRecord.walkthrough } : {}),
            ...(intentRecord.narrativeBeatsStructured !== undefined
                ? { narrativeBeatsStructured: intentRecord.narrativeBeatsStructured }
                : {}),
            ...(gimmickToStore !== undefined ? { gimmick: gimmickToStore } : {}),
        })
        this.state.intent = intentRecord
        return intentRecord
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
