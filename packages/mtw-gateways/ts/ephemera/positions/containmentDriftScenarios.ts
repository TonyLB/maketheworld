/**
 * Shared fixtures for the containment-drift payoff tests.
 *
 * The sweeps live in `lambda/diagnostics` and the heals in `lambda/ephemera`, and neither can import
 * the other, so the loop *drifted rows -> finding -> heal -> second sweep reads 0* is closed in two
 * legs that read this one module:
 *
 * - the diagnostics leg sweeps `drifted` and asserts `expected`, then sweeps `healed` and asserts silence;
 * - the ephemera leg delivers the findings `expected` names to the real consumers over an in-memory
 *   world seeded with `drifted`, and asserts the result equals `healed` (after `normalizeMintedIds`).
 *
 * Rows are the raw `{ EphemeraId, DataCategory, ludicGraph }` shape both sides read. Every scenario
 * is a mutation of one clean world (`kitchenWorld`): an Area (Town) holding a Room (Kitchen) holding
 * a Feature (Stove), optionally with an Object (Cup) in the Kitchen. Test support only.
 */

export type ScenarioRow = { EphemeraId: string; DataCategory: string; ludicGraph: { nodes: unknown[]; edges?: unknown[] } }

/** A node of a component's per-asset `Component Updated` diff: `ref < 0` marks a removal. */
export type AuthoredNode = { universalKey: string; ref?: number }

export type CoverUnrepairable = { ephemeraId: string; noBase: boolean; kinds: string[] }

export type DriftExpectation = {
    /** Parents the fixed-containment sweep reports (and the population heal is delivered for). */
    fixed: string[]
    /** Wholes/members the cover sweep emits for (and `healPresenceCover` is delivered for). */
    cover: string[]
    /** What the cover sweep lists as report-only. */
    unrepairable: CoverUnrepairable[]
}

export type ContainmentDriftScenario = {
    name: string
    drifted: ScenarioRow[]
    /** Each parent's authored per-asset node list (the sweeps' and the heal's setpoint). */
    authored: Record<string, AuthoredNode[]>
    expected: DriftExpectation
    /** The state once the heals land. Defaults to `drifted` when the drift is report-only. */
    healed: ScenarioRow[]
    /** What the sweeps read over `healed`. Defaults to nothing. */
    expectedHealed?: Pick<DriftExpectation, 'unrepairable'>
    /** Findings to deliver even though no sweep emitted them (a redelivery); the heals must commit nothing. */
    redeliver?: { fixed?: string[]; cover?: string[] }
}

const TOWN = 'AREA#Town'
const KITCHEN = 'ROOM#Kitchen'
const STOVE = 'FEATURE#Stove'
const CUP = 'OBJECT#Cup'
const BASE = 'PRESENCE#Base'

type Entry = { host: string; presence: string }
const binding = (universalKey: string, parent?: Entry, members: Entry[] = []) => ({
    tag: 'Presence',
    universalKey,
    fromHostPresences: parent ? [parent] : [],
    cover: { members },
})
const partOf = (from: string, to: string) => ({ tag: 'Relational', kind: 'PartOf', from, to })
const row = (EphemeraId: string, category: 'Area' | 'Room' | 'Feature' | 'Object', nodes: unknown[], edges: unknown[] = []): ScenarioRow => ({
    EphemeraId,
    DataCategory: `Meta::${category}`,
    ludicGraph: { nodes: [{ tag: category, universalKey: EphemeraId }, ...nodes], ...(edges.length ? { edges } : {}) },
})

type WorldOptions = {
    /** The Kitchen's Area-binding id (default: a fixed id). */
    carve?: string
    /** The Stove's own binding id (default: `PRESENCE#Base`). */
    stoveBinding?: string
    /** Whether the Kitchen holds a Cup (an Object, whose binding is its placement). */
    cup?: boolean
}

/** The clean world: every nesting populated, every cover in agreement. */
export const kitchenWorld = ({ carve = 'PRESENCE#kitchen-in-town', stoveBinding = BASE, cup = false }: WorldOptions = {}): ScenarioRow[] => [
    row(TOWN, 'Area', [
        { tag: 'Room', universalKey: KITCHEN },
        binding(BASE, undefined, [{ host: KITCHEN, presence: carve }]),
    ], [partOf(KITCHEN, TOWN)]),
    row(KITCHEN, 'Room', [
        { tag: 'Feature', universalKey: STOVE },
        ...(cup ? [{ tag: 'Object', universalKey: CUP }] : []),
        binding(BASE, undefined, [
            { host: STOVE, presence: stoveBinding },
            ...(cup ? [{ host: CUP, presence: BASE }] : []),
        ]),
        binding(carve, { host: TOWN, presence: BASE }),
    ], [partOf(STOVE, KITCHEN)]),
    row(STOVE, 'Feature', [binding(stoveBinding, { host: KITCHEN, presence: BASE })]),
    ...(cup ? [row(CUP, 'Object', [binding(BASE, { host: KITCHEN, presence: BASE })])] : []),
]

const rowOf = (rows: ScenarioRow[], id: string): ScenarioRow => rows.find((candidate) => candidate.EphemeraId === id)!
/** `rows` with one row's graph rewritten. */
const withRow = (rows: ScenarioRow[], id: string, change: (graph: ScenarioRow['ludicGraph']) => ScenarioRow['ludicGraph']): ScenarioRow[] => (
    rows.map((candidate) => candidate.EphemeraId === id ? { ...candidate, ludicGraph: change(candidate.ludicGraph) } : candidate)
)
const without = (rows: ScenarioRow[], id: string) => rows.filter((candidate) => candidate.EphemeraId !== id)
const nodeKey = (node: unknown): string | undefined => (node as { universalKey?: string }).universalKey

const authoredAll: Record<string, AuthoredNode[]> = {
    [TOWN]: [{ universalKey: KITCHEN }],
    [KITCHEN]: [{ universalKey: STOVE }],
}

const nothing: DriftExpectation = { fixed: [], cover: [], unrepairable: [] }

const clean = kitchenWorld()
const cleanWithCup = kitchenWorld({ cup: true })

export const containmentDriftScenarios: ContainmentDriftScenario[] = [
    // ---- Presence Cover Drift sweep ----
    {
        name: 'cover: the Kitchen\'s cover entry for the Stove names a stale binding',
        drifted: withRow(clean, KITCHEN, (graph) => ({
            ...graph,
            nodes: graph.nodes.map((node) => nodeKey(node) === BASE
                ? binding(BASE, undefined, [{ host: STOVE, presence: 'PRESENCE#stale' }])
                : node),
        })),
        authored: authoredAll,
        expected: { ...nothing, cover: [KITCHEN] },
        healed: clean,
    },
    {
        name: 'orphan pointer (Feature): the Stove points at the Kitchen, whose graph lacks its node and cover entry',
        drifted: withRow(clean, KITCHEN, (graph) => ({
            ...graph,
            nodes: graph.nodes
                .filter((node) => nodeKey(node) !== STOVE)
                .map((node) => nodeKey(node) === BASE ? binding(BASE) : node),
        })),
        authored: {},
        expected: { ...nothing, cover: [STOVE] },
        healed: clean,
    },
    {
        name: 'orphan pointer (Object): the Cup points at the Kitchen, whose graph lacks its node and cover entry',
        drifted: withRow(cleanWithCup, KITCHEN, (graph) => ({
            ...graph,
            nodes: graph.nodes
                .filter((node) => nodeKey(node) !== CUP)
                .map((node) => nodeKey(node) === BASE ? binding(BASE, undefined, [{ host: STOVE, presence: BASE }]) : node),
        })),
        authored: {},
        expected: { ...nothing, cover: [CUP] },
        healed: cleanWithCup,
    },
    {
        name: 'orphan pointer, report-only: the Kitchen lacks the Cup\'s node and the Cup names a Kitchen binding that does not exist',
        drifted: [...clean, row(CUP, 'Object', [binding(BASE, { host: KITCHEN, presence: 'PRESENCE#gone' })])],
        authored: {},
        // Nothing a heal can re-seat the node under, so no finding is emitted: the sweep only lists it.
        expected: { ...nothing, unrepairable: [{ ephemeraId: CUP, noBase: false, kinds: ['Orphaned'] }] },
        healed: [...clean, row(CUP, 'Object', [binding(BASE, { host: KITCHEN, presence: 'PRESENCE#gone' })])],
        expectedHealed: { unrepairable: [{ ephemeraId: CUP, noBase: false, kinds: ['Orphaned'] }] },
        redeliver: { cover: [CUP] },
    },
    // ---- Fixed Containment sweep ----
    {
        name: 'never populated: the authored Room and Feature were never nested (the old heal found no PartOf edge to follow)',
        drifted: [
            row(TOWN, 'Area', [binding(BASE)]),
            row(KITCHEN, 'Room', [binding(BASE)]),
            row(STOVE, 'Feature', []),
        ],
        authored: authoredAll,
        expected: { ...nothing, fixed: [KITCHEN, TOWN].sort() },
        // The Stove's first binding is `PRESENCE#Base`; the Kitchen already holds its root, so its Area binding is a fresh mint.
        healed: kitchenWorld({ carve: 'PRESENCE#minted-1' }),
    },
    {
        name: 'missing PartOf edge: node, cover and bindings agree but the Area lacks the Room\'s edge',
        drifted: withRow(clean, TOWN, (graph) => ({ nodes: graph.nodes })),
        authored: authoredAll,
        expected: { ...nothing, fixed: [TOWN] },
        healed: clean,
    },
    {
        name: 'child binding at the wrong place: the Stove names a Kitchen root that does not exist',
        drifted: withRow(clean, STOVE, (graph) => ({
            ...graph,
            nodes: graph.nodes.map((node) => nodeKey(node) === BASE ? binding(BASE, { host: KITCHEN, presence: 'PRESENCE#gone' }) : node),
        })),
        authored: authoredAll,
        // Judged from the Kitchen's side, its Base entry for the Stove and the Stove's pointer at a binding the Kitchen lacks are both stale.
        expected: { ...nothing, fixed: [KITCHEN], cover: [KITCHEN], unrepairable: [{ ephemeraId: KITCHEN, noBase: false, kinds: ['Stale', 'Stale'] }] },
        healed: clean,
    },
    {
        name: 'Room-in-Area carve-out carries members instead of being empty',
        drifted: withRow(clean, KITCHEN, (graph) => ({
            ...graph,
            nodes: graph.nodes.map((node) => nodeKey(node) === 'PRESENCE#kitchen-in-town'
                ? binding('PRESENCE#kitchen-in-town', { host: TOWN, presence: BASE }, [{ host: STOVE, presence: BASE }])
                : node),
        })),
        authored: authoredAll,
        expected: { ...nothing, fixed: [TOWN], cover: [KITCHEN], unrepairable: [{ ephemeraId: KITCHEN, noBase: false, kinds: ['Stale'] }] },
        healed: clean,
    },
    {
        name: 'rootless Room: bindings but no hostless root (the deliberate overlap with the cover sweep\'s noBase)',
        drifted: [
            ...without(without(clean, KITCHEN), STOVE),
            row(KITCHEN, 'Room', [binding('PRESENCE#kitchen-in-town', { host: TOWN, presence: BASE })]),
        ],
        authored: { [TOWN]: [{ universalKey: KITCHEN }] },
        expected: { ...nothing, fixed: [KITCHEN], unrepairable: [{ ephemeraId: KITCHEN, noBase: true, kinds: [] }] },
        healed: [
            ...without(without(clean, KITCHEN), STOVE),
            row(KITCHEN, 'Room', [binding('PRESENCE#kitchen-in-town', { host: TOWN, presence: BASE }), binding(BASE)]),
        ],
    },
    // ---- Not sensed ----
    {
        name: 'de-authored nesting: stored, no longer declared, so neither sensed nor removed',
        drifted: clean,
        authored: {},
        expected: nothing,
        healed: clean,
        redeliver: { fixed: [TOWN, KITCHEN] },
    },
    {
        name: 'removed-diff child (ref < 0) is not populated',
        drifted: [row(TOWN, 'Area', [binding(BASE)]), row(KITCHEN, 'Room', [binding(BASE)])],
        authored: { [TOWN]: [{ universalKey: KITCHEN, ref: -1 }] },
        expected: nothing,
        healed: [row(TOWN, 'Area', [binding(BASE)]), row(KITCHEN, 'Room', [binding(BASE)])],
        redeliver: { fixed: [TOWN] },
    },
]

/**
 * Rows in a canonical order and form, with each freshly minted `PRESENCE#<uuid>` renamed
 * `PRESENCE#minted-N` in order of first appearance, so a heal's `addPresenceBinding` does not make a
 * golden brittle. Component nodes are reduced to `{ tag, universalKey }`; bindings, edges and cover
 * members are sorted. A presence id is "minted" when it is neither `PRESENCE#Base` nor already a
 * readable name (anything with a letter outside a hex uuid).
 */
export const normalizeMintedIds = (rows: ScenarioRow[]): ScenarioRow[] => {
    const uuidLike = /^PRESENCE#[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const sorted = [...rows].sort((a, b) => a.EphemeraId.localeCompare(b.EphemeraId))
    const names = new Map<string, string>()
    const rename = (id: string): string => {
        if (!uuidLike.test(id)) {
            return id
        }
        if (!names.has(id)) {
            names.set(id, `PRESENCE#minted-${names.size + 1}`)
        }
        return names.get(id)!
    }
    const byKey = (a: unknown, b: unknown) => JSON.stringify(a).localeCompare(JSON.stringify(b))
    // Name in a stable order first: rows sorted by id, then each row's nodes by the *unminted* key, uuids by sorted order of discovery
    for (const { ludicGraph } of sorted) {
        for (const node of [...ludicGraph.nodes].sort(byKey)) {
            const { tag, universalKey, fromHostPresences } = node as { tag?: string; universalKey?: string; fromHostPresences?: Entry[] }
            if (tag === 'Presence' && universalKey) {
                rename(universalKey)
            }
            for (const parent of fromHostPresences ?? []) {
                rename(parent.presence)
            }
        }
    }
    return sorted.map(({ EphemeraId, DataCategory, ludicGraph }) => ({
        EphemeraId,
        DataCategory,
        ludicGraph: {
            nodes: ludicGraph.nodes.map((node) => {
                const { tag, universalKey, fromHostPresences, cover } = node as { tag: string; universalKey: string; fromHostPresences?: Entry[]; cover?: { members: Entry[] } }
                return tag === 'Presence'
                    ? {
                        tag,
                        universalKey: rename(universalKey),
                        fromHostPresences: (fromHostPresences ?? []).map((parent) => ({ host: parent.host, presence: rename(parent.presence) })),
                        cover: { members: [...(cover?.members ?? [])].map((entry) => ({ host: entry.host, presence: rename(entry.presence) })).sort(byKey) },
                    }
                    : { tag, universalKey }
            }).sort(byKey),
            edges: (ludicGraph.edges ?? []).map((edge) => {
                const { kind, from, to } = edge as { kind: string; from: string; to: string }
                return { tag: 'Relational', kind, from, to }
            }).sort(byKey),
        },
    }))
}
