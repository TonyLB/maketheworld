import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoomObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { CoyoteAffinityPossibility } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { defaultStableKeyProposal } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import {
    combineHypothesisClusters,
    renderCombinedHypothesisForStageTwo,
} from '../pipelines/hypothesis/combineHypothesisClusters'
import type {
    CoyoteHarnessPhasePlanInject,
    CoyoteHarnessPlanSelectInject,
} from '../pipelines/hypothesis/coyoteHarnessInjectTypes'
import { parseHypothesisStageOneOutput } from '../pipelines/hypothesis/parseHypothesisStageOneOutput'
import type { CoyoteRoomObjectsByRoom } from '../../utilities/coyoteRoomObjectSnapshot'

export type { CoyoteHarnessPhasePlanInject, CoyoteHarnessPlanSelectInject } from '../pipelines/hypothesis/coyoteHarnessInjectTypes'

/** Same room grid as [`normalizeFixtureRoomObjects`](./runCoyoteEngineTestHarness.ts). */
const COYOTE_HARNESS_ROOM_IDS: EphemeraRoomId[] = [
    'ROOM#VORTEX',
    'ROOM#STRAIGHTAWAY',
    'ROOM#CLIFFTOP',
    'ROOM#CORNER',
    'ROOM#BRIDGE',
]

/** Phase aliases that require hand-maintained inject bundles for **`runOnly`** runs. */
export type CoyoteHarnessInjectPhase = 'planSelect' | 'phasePlan'

export type CoyoteHarnessStartAtInjectSuccess =
    | { ok: true; phase: 'planSelect'; inject: CoyoteHarnessPlanSelectInject }
    | { ok: true; phase: 'phasePlan'; inject: CoyoteHarnessPhasePlanInject }

export type CoyoteHarnessStartAtInjectResult = CoyoteHarnessStartAtInjectSuccess | { ok: false; message: string }

export type CoyoteEngineTestFixture = {
    id: string
    label?: string
    roomObjectsByRoom: Partial<Record<EphemeraRoomId, EphemeraMetaRoomObject[]>>
    hypothesisLine?: string
    planSelectInject?: CoyoteHarnessPlanSelectInject
    phasePlanInject?: CoyoteHarnessPhasePlanInject
}

/**
 * Every harness room id is present; missing rooms use an empty object list
 * (same behavior as **`normalizeFixtureRoomObjects`** in the harness runner).
 */
export function normalizeCoyoteHarnessRoomObjects(
    roomObjectsByRoom: Partial<Record<EphemeraRoomId, EphemeraMetaRoomObject[]>>
): CoyoteRoomObjectsByRoom {
    return Object.fromEntries(
        COYOTE_HARNESS_ROOM_IDS.map((roomId) => [roomId, roomObjectsByRoom[roomId] ?? []])
    ) as CoyoteRoomObjectsByRoom
}

export type HarnessRoomObjectSpec = {
    shortName: string
    affinities?: CoyoteAffinityPossibility[]
}

/** Build harness objects with deterministic uuids (`stableKey` disambiguated per slot); optional **`affinities`** per row. */
export function harnessRoomObjectsSpec(
    roomSlug: string,
    specs: HarnessRoomObjectSpec[]
): EphemeraMetaRoomObject[] {
    return specs.map((spec, index) => ({
        uuid: `OBJECT#harness-${roomSlug}-${index}` as `OBJECT#${string}`,
        shortName: spec.shortName,
        stableKey: `${defaultStableKeyProposal(spec.shortName)}-${index}`,
        ...(spec.affinities?.length ? { affinities: spec.affinities } : {}),
    }))
}

/** Build harness objects with deterministic uuids (`stableKey` disambiguated per slot; no affinities). */
export function harnessRoomObjects(roomSlug: string, shortNames: string[]): EphemeraMetaRoomObject[] {
    return harnessRoomObjectsSpec(roomSlug, shortNames.map((shortName) => ({ shortName })))
}

/** Birdseed staged as bait: placed to stage the gag, then targets the quarry. */
const birdseedLureAffinities: CoyoteAffinityPossibility[] = [
    {
        role: 'influence-road-runner',
        aptness: 0.8,
    },
]

const FIXTURE_01_ROOM_OBJECTS: CoyoteEngineTestFixture['roomObjectsByRoom'] = {
    'ROOM#STRAIGHTAWAY': harnessRoomObjectsSpec('straightaway', [
        {
            shortName: 'rocket',
            affinities: [
                { role: 'delivery', aptness: 0.4 },
                {
                    role: 'coyote-enhancement',
                    aptness: 0.69,
                },
                { role: 'terminal', aptness: 0.61 },
            ],
        },
    ]),
}

/**
 * Frozen stage-one seam JSON used only to derive golden **`combinedMarkdown`** via the same parse, combine,
 * and render path as **`seamCombineRender`** (`stableKey` **`rocket-0`** matches **`harnessRoomObjectsSpec`**).
 */
const FIXTURE_01_GOLDEN_SEAM_BODY = JSON.stringify({
    clusters: [
        {
            clusterName: 'Straightaway rocket',
            members: [
                {
                    stableKey: 'rocket-0',
                    intendedRole: { role: 'delivery', aptness: 0.4 },
                },
            ],
        },
    ],
})

function buildFixture01PlanSelectInject(): CoyoteHarnessPlanSelectInject {
    const roomObjectsByRoom = normalizeCoyoteHarnessRoomObjects(FIXTURE_01_ROOM_OBJECTS)
    const seamParsed = parseHypothesisStageOneOutput(FIXTURE_01_GOLDEN_SEAM_BODY, roomObjectsByRoom)
    if (!seamParsed.ok) {
        throw new Error(`fixture-01 planSelect golden seam: ${seamParsed.errorMessage}`)
    }
    const combinedResult = combineHypothesisClusters(
        seamParsed.clusters,
        roomObjectsByRoom,
        seamParsed.explicitOutliers
    )
    if (!combinedResult.ok) {
        throw new Error(`fixture-01 planSelect golden combine: ${combinedResult.errorMessage}`)
    }
    return {
        roomObjectsByRoom,
        combinedMarkdown: renderCombinedHypothesisForStageTwo(combinedResult.combined, roomObjectsByRoom),
    }
}

const FIXTURE_01_PLAN_SELECT_INJECT = buildFixture01PlanSelectInject()

export const COYOTE_ENGINE_TEST_FIXTURES: CoyoteEngineTestFixture[] = [
    {
        id: 'fixture-01',
        label: 'Rocket at the Straightaway',
        roomObjectsByRoom: FIXTURE_01_ROOM_OBJECTS,
        planSelectInject: FIXTURE_01_PLAN_SELECT_INJECT,
    },
    {
        id: 'fixture-02',
        label: 'Lever at the Top of Cliff; Birdseed at the Base of Cliff',
        roomObjectsByRoom: {
            'ROOM#CLIFFTOP': harnessRoomObjectsSpec('clifftop', [
                {
                    shortName: 'lever',
                    affinities: [
                        { role: 'trigger', aptness: 0.4 },
                        { role: 'prep', aptness: 0.7 },
                    ],
                },
            ]),
            'ROOM#VORTEX': harnessRoomObjectsSpec('vortex', [
                {
                    shortName: 'birdseed',
                    affinities: birdseedLureAffinities,
                },
            ]),
        },
    },
    {
        id: 'fixture-03',
        label: 'Roller skates, paint, portable hole, birdseed spread',
        roomObjectsByRoom: {
            'ROOM#STRAIGHTAWAY': harnessRoomObjectsSpec('straightaway', [
                {
                    shortName: 'roller skates',
                    affinities: [
                        {
                            role: 'coyote-equipment',
                            aptness: 0.71,
                        },
                        { role: 'delivery', aptness: 0.64 },
                    ],
                },
            ]),
            'ROOM#CORNER': harnessRoomObjectsSpec('corner', [
                {
                    shortName: 'paint',
                    affinities: [
                        { role: 'prep', aptness: 0.7 },
                        {
                            role: 'connect-props',
                            aptness: 0.53,
                        },
                    ],
                },
            ]),
            'ROOM#BRIDGE': harnessRoomObjectsSpec('bridge', [
                {
                    shortName: 'portable hole',
                    affinities: [
                        { role: 'prep', aptness: 0.9 }
                    ],
                },
                {
                    shortName: 'birdseed',
                    affinities: birdseedLureAffinities,
                },
            ]),
        },
    },
    {
        id: 'fixture-04',
        label: 'Magnet and steel drum at the Straightaway',
        roomObjectsByRoom: {
            'ROOM#STRAIGHTAWAY': harnessRoomObjectsSpec('straightaway', [
                {
                    shortName: 'magnet',
                    affinities: [
                        {
                            role: 'influence-road-runner',
                            aptness: 0.73,
                        },
                        { role: 'terminal', aptness: 0.62 },
                    ],
                },
                {
                    shortName: 'steel drum',
                    affinities: [
                        { role: 'delivery', aptness: 0.54 },
                        { role: 'trigger', aptness: 0.49 },
                        { role: 'autonomous_agent', aptness: 0.44 },
                    ],
                },
            ]),
        },
    },
    {
        id: 'fixture-05',
        label: 'Catapult at the Base of Cliff',
        roomObjectsByRoom: {
            'ROOM#VORTEX': harnessRoomObjectsSpec('vortex', [
                {
                    shortName: 'catapult',
                    affinities: [
                        { role: 'delivery', aptness: 0.72 },
                        { role: 'terminal', aptness: 0.4 },
                    ],
                },
            ]),
        },
    },
    {
        id: 'fixture-06',
        label: 'Birdseed, glue, and anvil across three rooms',
        roomObjectsByRoom: {
            'ROOM#STRAIGHTAWAY': harnessRoomObjectsSpec('straightaway', [
                {
                    shortName: 'birdseed',
                    affinities: birdseedLureAffinities,
                },
            ]),
            'ROOM#VORTEX': harnessRoomObjectsSpec('vortex', [
                {
                    shortName: 'glue',
                    affinities: [
                        {
                            role: 'enhance-prop',
                            aptness: 0.66,
                        },
                        { role: 'prep', aptness: 0.54 },
                    ],
                },
            ]),
            'ROOM#CLIFFTOP': harnessRoomObjectsSpec('clifftop', [
                {
                    shortName: 'anvil',
                    affinities: [
                        { role: 'terminal', aptness: 0.74 }
                    ],
                },
            ]),
        },
    },
    {
        id: 'fixture-07',
        label: 'Trampoline and net split by cliff levels',
        roomObjectsByRoom: {
            'ROOM#VORTEX': harnessRoomObjectsSpec('vortex', [
                {
                    shortName: 'trampoline',
                    affinities: [
                        { role: 'prep', aptness: 0.67 },
                        { role: 'delivery', aptness: 0.64 },
                    ],
                },
            ]),
            'ROOM#CLIFFTOP': harnessRoomObjectsSpec('clifftop', [
                {
                    shortName: 'net',
                    affinities: [
                        { role: 'terminal', aptness: 0.66 },
                        { role: 'trigger', aptness: 0.4 },
                    ],
                },
            ]),
        },
    },
    {
        id: 'fixture-08',
        label: 'Five-object straightaway bundle',
        roomObjectsByRoom: {
            'ROOM#STRAIGHTAWAY': harnessRoomObjectsSpec('straightaway', [
                {
                    shortName: 'rocket',
                    affinities: [
                        { role: 'delivery', aptness: 0.4 },
                        {
                            role: 'coyote-enhancement',
                            aptness: 0.69,
                        },
                        { role: 'terminal', aptness: 0.61 },
                    ],
                },
                {
                    shortName: 'skis',
                    affinities: [
                        { role: 'delivery', aptness: 0.4 },
                        {
                            role: 'coyote-equipment',
                            aptness: 0.7,
                        },
                    ],
                },
                {
                    shortName: 'catapult',
                    affinities: [
                        { role: 'delivery', aptness: 0.72 },
                        { role: 'terminal', aptness: 0.4 },
                    ],
                },
                {
                    shortName: 'springs',
                    affinities: [
                        { role: 'terminal', aptness: 0.53 },
                        { role: 'trigger', aptness: 0.47 },
                    ],
                },
                {
                    shortName: 'glue',
                    affinities: [
                        {
                            role: 'coyote-equipment',
                            aptness: 0.57,
                        },
                        {
                            role: 'enhance-prop',
                            aptness: 0.52,
                        },
                    ],
                },
            ]),
        },
    },
    {
        id: 'fixture-09',
        label: 'Umbrella, snorkel, and skis distributed',
        roomObjectsByRoom: {
            'ROOM#CLIFFTOP': harnessRoomObjectsSpec('clifftop', [
                {
                    shortName: 'umbrella',
                    affinities: [
                        {
                            role: 'coyote-equipment',
                            aptness: 0.45,
                        },
                    ],
                },
            ]),
            'ROOM#CORNER': harnessRoomObjectsSpec('corner', [
                {
                    shortName: 'snorkel',
                    affinities: [
                        {
                            role: 'coyote-equipment',
                            aptness: 0.45,
                        },
                    ],
                },
            ]),
            'ROOM#BRIDGE': harnessRoomObjectsSpec('bridge', [
                {
                    shortName: 'skis',
                    affinities: [
                        { role: 'delivery', aptness: 0.8 },
                        {
                            role: 'coyote-equipment',
                            aptness: 0.66,
                        },
                    ],
                },
            ]),
        },
    },
    {
        id: 'fixture-10',
        label: 'Cannon, birdseed, roller skates, and paint mix',
        roomObjectsByRoom: {
            'ROOM#CLIFFTOP': harnessRoomObjectsSpec('clifftop', [
                {
                    shortName: 'cannon',
                    affinities: [
                        { role: 'terminal', aptness: 0.77 },
                        { role: 'trigger', aptness: 0.69 },
                    ],
                },
            ]),
            'ROOM#VORTEX': harnessRoomObjectsSpec('vortex', [
                {
                    shortName: 'birdseed',
                    affinities: birdseedLureAffinities,
                },
            ]),
            'ROOM#STRAIGHTAWAY': harnessRoomObjectsSpec('straightaway', [
                {
                    shortName: 'roller skates',
                    affinities: [
                        {
                            role: 'coyote-equipment',
                            aptness: 0.7,
                        },
                        { role: 'delivery', aptness: 0.65 },
                    ],
                },
            ]),
            'ROOM#CORNER': harnessRoomObjectsSpec('corner', [
                {
                    shortName: 'paint',
                    affinities: [
                        {
                            role: 'connect-props',
                            aptness: 0.6,
                        },
                        { role: 'prep', aptness: 0.7 },
                    ],
                },
            ]),
        },
    },
]

/**
 * Resolve start-at inject for **`planSelect`** / **`phasePlan`** (1-based fixture index, slash / harness aligned).
 */
export function resolveCoyoteHarnessStartAtInject(args: {
    fixtureIndex1Based: number
    phase: CoyoteHarnessInjectPhase
    fixtures?: CoyoteEngineTestFixture[]
}): CoyoteHarnessStartAtInjectResult {
    const fixtures = args.fixtures ?? COYOTE_ENGINE_TEST_FIXTURES
    const { fixtureIndex1Based: i, phase } = args
    const max = fixtures.length
    if (!Number.isInteger(i) || i < 1 || i > max) {
        return {
            ok: false,
            message: `Coyote engine test harness: fixture index must be an integer from 1 to ${max} (received ${i}).`,
        }
    }
    const fixture = fixtures[i - 1]
    if (phase === 'planSelect') {
        const inject = fixture.planSelectInject
        if (inject === undefined) {
            return {
                ok: false,
                message:
                    `Coyote engine test harness does not yet supply starting input for run-only phase "planSelect" at fixture index ${i} (${fixture.id}).`,
            }
        }
        return { ok: true, phase: 'planSelect', inject }
    }
    const inject = fixture.phasePlanInject
    if (inject === undefined) {
        return {
            ok: false,
            message:
                `Coyote engine test harness does not yet supply starting input for run-only phase "phasePlan" at fixture index ${i} (${fixture.id}).`,
        }
    }
    return { ok: true, phase: 'phasePlan', inject }
}
