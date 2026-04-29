import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoomObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { CoyoteTropeAffinity } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { defaultStableKeyProposal } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { combineHypothesisClusters } from '../pipelines/hypothesis/combineHypothesisClusters'
import type {
    CoyoteHarnessPhasePlanInject,
    CoyoteHarnessPlanSelectInject,
} from '../pipelines/hypothesis/coyoteHarnessInjectTypes'
import type { CoyoteHop1Handoff } from '../pipelines/hypothesis/coyoteHop1Handoff'
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
    tropeAffinities?: CoyoteTropeAffinity[]
}

/** Build harness objects with deterministic uuids (`stableKey` disambiguated per slot); trope-first affinity hints per row. */
export function harnessRoomObjectsSpec(
    roomSlug: string,
    specs: HarnessRoomObjectSpec[]
): EphemeraMetaRoomObject[] {
    return specs.map((spec, index) => ({
        uuid: `OBJECT#harness-${roomSlug}-${index}` as `OBJECT#${string}`,
        shortName: spec.shortName,
        stableKey: `${defaultStableKeyProposal(spec.shortName)}-${index}`,
        ...(spec.tropeAffinities?.length ? { tropeAffinities: spec.tropeAffinities } : {}),
        ...(spec.tropeAffinities?.length ? {} : { tropeAffinities: [], tropeAffinitiesFailed: true }),
        affinities: [],
        affinitiesFailed: true,
    }))
}

/** Build harness objects with deterministic uuids (`stableKey` disambiguated per slot; no trope affinity hints). */
export function harnessRoomObjects(roomSlug: string, shortNames: string[]): EphemeraMetaRoomObject[] {
    return harnessRoomObjectsSpec(roomSlug, shortNames.map((shortName) => ({ shortName })))
}

/** Birdseed staged as bait: placed to stage the gag, then targets the quarry. */
const birdseedLureAffinities: CoyoteTropeAffinity[] = [
    {
        trope: 'Distraction',
        aptness: 'High',
        narrowing: 'bait lure that commits Road Runner to the chosen lane',
    },
]

const FIXTURE_01_ROOM_OBJECTS: CoyoteEngineTestFixture['roomObjectsByRoom'] = {
    'ROOM#STRAIGHTAWAY': harnessRoomObjectsSpec('straightaway', [
        {
            shortName: 'rocket',
            tropeAffinities: [
                {
                    trope: 'Contraption',
                    aptness: 'High',
                    narrowing: 'self-powered lane setup hardware',
                },
                {
                    trope: 'Finishing Move',
                    aptness: 'Good',
                    narrowing: 'payload delivery into terminal beat',
                },
            ],
        },
    ]),
}

/**
 * Frozen stage-one seam JSON used only to derive golden **`combined`** via the same parse and combine
 * path as **`seamCombineRender`** (`stableKey` **`rocket-0`** matches **`harnessRoomObjectsSpec`**).
 */
const FIXTURE_01_GOLDEN_SEAM_BODY = JSON.stringify({
    candidates: [
        {
            candidateId: 'candidate-1',
            executionSummary: 'Use the straightaway rocket lane as the main trap route.',
            tropeAssignments: [
                {
                    trope: 'Contraption',
                    executionDetail: 'Rocket hardware is staged and aligned on the straightaway.',
                    members: [
                        {
                            stableKey: 'rocket-0',
                            tropeFunction: 'delivery lane hardware for straightaway setup',
                        },
                    ],
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
        seamParsed.candidates,
        roomObjectsByRoom
    )
    if (!combinedResult.ok) {
        throw new Error(`fixture-01 planSelect golden combine: ${combinedResult.errorMessage}`)
    }
    return {
        roomObjectsByRoom,
        combined: combinedResult.combined,
    }
}

const FIXTURE_01_PLAN_SELECT_INJECT = buildFixture01PlanSelectInject()
const FIXTURE_01_PHASE_PLAN_HANDOFF: CoyoteHop1Handoff = {
    paragraphSummary: 'Conflict review favors candidate-1: lock a single Contraption-first lane using the straightaway rocket setup, then carry that same lane through the terminal beat with no prop-role conflicts.',
    planIssues: [],
}
const FIXTURE_01_PHASE_PLAN_INJECT: CoyoteHarnessPhasePlanInject = {
    ...FIXTURE_01_PLAN_SELECT_INJECT,
    hop1Handoff: FIXTURE_01_PHASE_PLAN_HANDOFF,
}

function buildPlanSelectInjectFromGoldenSeam(args: {
    fixtureId: string
    roomObjectsByRoom: Partial<Record<EphemeraRoomId, EphemeraMetaRoomObject[]>>
    stageOneSeamBody: string
}): CoyoteHarnessPlanSelectInject {
    const roomObjectsByRoom = normalizeCoyoteHarnessRoomObjects(args.roomObjectsByRoom)
    const seamParsed = parseHypothesisStageOneOutput(args.stageOneSeamBody, roomObjectsByRoom)
    if (!seamParsed.ok) {
        throw new Error(`${args.fixtureId} planSelect golden seam: ${seamParsed.errorMessage}`)
    }
    const combinedResult = combineHypothesisClusters(
        seamParsed.candidates,
        roomObjectsByRoom
    )
    if (!combinedResult.ok) {
        throw new Error(`${args.fixtureId} planSelect golden combine: ${combinedResult.errorMessage}`)
    }
    return {
        roomObjectsByRoom,
        combined: combinedResult.combined,
    }
}

export const COYOTE_ENGINE_TEST_FIXTURES: CoyoteEngineTestFixture[] = [
    {
        id: 'fixture-01',
        label: 'Rocket at the Straightaway',
        roomObjectsByRoom: FIXTURE_01_ROOM_OBJECTS,
        planSelectInject: FIXTURE_01_PLAN_SELECT_INJECT,
        phasePlanInject: FIXTURE_01_PHASE_PLAN_INJECT,
    },
    {
        id: 'fixture-02',
        label: 'Lever at the Top of Cliff; Birdseed at the Base of Cliff',
        roomObjectsByRoom: {
            'ROOM#CLIFFTOP': harnessRoomObjectsSpec('clifftop', [
                {
                    shortName: 'lever',
                    tropeAffinities: [
                        {
                            trope: 'Contraption',
                            aptness: 'High',
                            narrowing: 'mechanical trigger prep above lane',
                        },
                        {
                            trope: 'Finishing Move',
                            aptness: 'Good',
                            narrowing: 'release mechanism for cliffside payload',
                        },
                    ],
                },
            ]),
            'ROOM#VORTEX': harnessRoomObjectsSpec('vortex', [
                {
                    shortName: 'birdseed',
                    tropeAffinities: birdseedLureAffinities,
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
                    tropeAffinities: [
                        {
                            trope: 'Contraption',
                            aptness: 'High',
                            narrowing: 'mobility rig for setup and chase positioning',
                        },
                        {
                            trope: 'Finishing Move',
                            aptness: 'Poor',
                            narrowing: 'delivery assist but not terminal by itself',
                        },
                    ],
                },
            ]),
            'ROOM#CORNER': harnessRoomObjectsSpec('corner', [
                {
                    shortName: 'paint',
                    tropeAffinities: [
                        {
                            trope: 'Distraction',
                            aptness: 'Good',
                            narrowing: 'visual lure through fake passage cue',
                        },
                        {
                            trope: 'Contraption',
                            aptness: 'Good',
                            narrowing: 'prep-world edit before engagement',
                        },
                    ],
                },
            ]),
            'ROOM#BRIDGE': harnessRoomObjectsSpec('bridge', [
                {
                    shortName: 'portable hole',
                    tropeAffinities: [
                        {
                            trope: 'Disadvantage',
                            aptness: 'High',
                            narrowing: 'persistent route hazard in bridge lane',
                        },
                        {
                            trope: 'Finishing Move',
                            aptness: 'Good',
                            narrowing: 'terminal drop endpoint if committed',
                        },
                    ],
                },
                {
                    shortName: 'birdseed',
                    tropeAffinities: birdseedLureAffinities,
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
                    tropeAffinities: [
                        {
                            trope: 'Disadvantage',
                            aptness: 'High',
                            narrowing: 'persistent pull alters runner pathing',
                        },
                        {
                            trope: 'Finishing Move',
                            aptness: 'Good',
                            narrowing: 'terminal snap-in collision setup',
                        },
                    ],
                },
                {
                    shortName: 'steel drum',
                    tropeAffinities: [
                        {
                            trope: 'Contraption',
                            aptness: 'Good',
                            narrowing: 'rig body for trigger chain',
                        },
                        {
                            trope: 'Finishing Move',
                            aptness: 'Good',
                            narrowing: 'rolling impact payload',
                        },
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
                    tropeAffinities: [
                        {
                            trope: 'Contraption',
                            aptness: 'High',
                            narrowing: 'pre-aimed launch apparatus',
                        },
                        {
                            trope: 'Finishing Move',
                            aptness: 'High',
                            narrowing: 'terminal launch and drop delivery',
                        },
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
                    tropeAffinities: birdseedLureAffinities,
                },
            ]),
            'ROOM#VORTEX': harnessRoomObjectsSpec('vortex', [
                {
                    shortName: 'glue',
                    tropeAffinities: [
                        {
                            trope: 'Disadvantage',
                            aptness: 'High',
                            narrowing: 'persistent adhesion constraint on movement',
                        },
                        {
                            trope: 'Contraption',
                            aptness: 'Poor',
                            narrowing: 'support prep material only',
                        },
                    ],
                },
            ]),
            'ROOM#CLIFFTOP': harnessRoomObjectsSpec('clifftop', [
                {
                    shortName: 'anvil',
                    tropeAffinities: [
                        {
                            trope: 'Finishing Move',
                            aptness: 'High',
                            narrowing: 'point terminal payload from above',
                        },
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
                    tropeAffinities: [
                        {
                            trope: 'Contraption',
                            aptness: 'High',
                            narrowing: 'trajectory setup hardware',
                        },
                        {
                            trope: 'Disadvantage',
                            aptness: 'Good',
                            narrowing: 'forced bounce path control',
                        },
                    ],
                },
            ]),
            'ROOM#CLIFFTOP': harnessRoomObjectsSpec('clifftop', [
                {
                    shortName: 'net',
                    tropeAffinities: [
                        {
                            trope: 'Disadvantage',
                            aptness: 'High',
                            narrowing: 'capture constraint state',
                        },
                        {
                            trope: 'Finishing Move',
                            aptness: 'Good',
                            narrowing: 'terminal containment beat',
                        },
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
                    tropeAffinities: [
                        {
                            trope: 'Contraption',
                            aptness: 'High',
                            narrowing: 'high-energy prep subsystem',
                        },
                        {
                            trope: 'Finishing Move',
                            aptness: 'Good',
                            narrowing: 'payload acceleration toward terminal beat',
                        },
                    ],
                },
                {
                    shortName: 'skis',
                    tropeAffinities: [
                        {
                            trope: 'Contraption',
                            aptness: 'Good',
                            narrowing: 'mobility prep on long straightaway route',
                        },
                        {
                            trope: 'Distraction',
                            aptness: 'Poor',
                            narrowing: 'visual decoy only in narrow reads',
                        },
                    ],
                },
                {
                    shortName: 'catapult',
                    tropeAffinities: [
                        {
                            trope: 'Contraption',
                            aptness: 'High',
                            narrowing: 'launch platform in primary setup chain',
                        },
                        {
                            trope: 'Finishing Move',
                            aptness: 'High',
                            narrowing: 'terminal delivery rig when committed',
                        },
                    ],
                },
                {
                    shortName: 'springs',
                    tropeAffinities: [
                        {
                            trope: 'Contraption',
                            aptness: 'Good',
                            narrowing: 'triggered kinetic transfer between props',
                        },
                        {
                            trope: 'Finishing Move',
                            aptness: 'Good',
                            narrowing: 'impact amplification at terminal moment',
                        },
                    ],
                },
                {
                    shortName: 'glue',
                    tropeAffinities: [
                        {
                            trope: 'Disadvantage',
                            aptness: 'High',
                            narrowing: 'persistent adhesion constraint on route',
                        },
                        {
                            trope: 'Contraption',
                            aptness: 'Poor',
                            narrowing: 'support prep only',
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
                    tropeAffinities: [
                        {
                            trope: 'Contraption',
                            aptness: 'Good',
                            narrowing: 'deflection or glide prep tool',
                        },
                        {
                            trope: 'Distraction',
                            aptness: 'Poor',
                            narrowing: 'costume-like visual decoy read',
                        },
                    ],
                },
            ]),
            'ROOM#CORNER': harnessRoomObjectsSpec('corner', [
                {
                    shortName: 'snorkel',
                    tropeAffinities: [
                        {
                            trope: 'Contraption',
                            aptness: 'Good',
                            narrowing: 'environment adaptation prep tool',
                        },
                        {
                            trope: 'Disadvantage',
                            aptness: 'Poor',
                            narrowing: 'indirect impairment setup helper',
                        },
                    ],
                },
            ]),
            'ROOM#BRIDGE': harnessRoomObjectsSpec('bridge', [
                {
                    shortName: 'skis',
                    tropeAffinities: [
                        {
                            trope: 'Contraption',
                            aptness: 'High',
                            narrowing: 'mobility prep on long bridge approach',
                        },
                        {
                            trope: 'Finishing Move',
                            aptness: 'Poor',
                            narrowing: 'delivery assist only',
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
                    tropeAffinities: [
                        {
                            trope: 'Finishing Move',
                            aptness: 'High',
                            narrowing: 'terminal projectile payload',
                        },
                        {
                            trope: 'Contraption',
                            aptness: 'Good',
                            narrowing: 'mounted firing prep',
                        },
                    ],
                },
            ]),
            'ROOM#VORTEX': harnessRoomObjectsSpec('vortex', [
                {
                    shortName: 'birdseed',
                    tropeAffinities: birdseedLureAffinities,
                },
            ]),
            'ROOM#STRAIGHTAWAY': harnessRoomObjectsSpec('straightaway', [
                {
                    shortName: 'roller skates',
                    tropeAffinities: [
                        {
                            trope: 'Contraption',
                            aptness: 'High',
                            narrowing: 'position and speed setup',
                        },
                        {
                            trope: 'Finishing Move',
                            aptness: 'Poor',
                            narrowing: 'delivery helper only',
                        },
                    ],
                },
            ]),
            'ROOM#CORNER': harnessRoomObjectsSpec('corner', [
                {
                    shortName: 'paint',
                    tropeAffinities: [
                        {
                            trope: 'Distraction',
                            aptness: 'Good',
                            narrowing: 'visual deception lure at turn',
                        },
                        {
                            trope: 'Contraption',
                            aptness: 'Good',
                            narrowing: 'prep illusion and route edit',
                        },
                    ],
                },
            ]),
        },
    },
]

const STAGE_ONE_GOLDEN_BY_FIXTURE_ID: Partial<Record<CoyoteEngineTestFixture['id'], string>> = {
    'fixture-02': JSON.stringify({
        candidates: [
            {
                candidateId: 'candidate-1',
                executionSummary: 'Birdseed lures Road Runner while lever rig prepares the cliffside release.',
                tropeAssignments: [
                    {
                        trope: 'Contraption',
                        executionDetail: 'Lever is staged at CLIFFTOP as release hardware.',
                        members: [{ stableKey: 'lever-0', tropeFunction: 'release lever' }],
                    },
                    {
                        trope: 'Distraction',
                        executionDetail: 'Road Runner stops to eat birdseed at VORTEX.',
                        members: [{ stableKey: 'birdseed-0', tropeFunction: 'lane bait' }],
                    },
                ],
            },
        ],
    }),
    'fixture-03': JSON.stringify({
        candidates: [
            {
                candidateId: 'candidate-1',
                executionSummary: 'Paint and skates prep a route while birdseed lures into a portable-hole finish.',
                tropeAssignments: [
                    {
                        trope: 'Contraption',
                        executionDetail: 'Roller skates and paint prep speed and route illusion before commitment.',
                        members: [
                            { stableKey: 'roller-skates-0', tropeFunction: 'speed rig' },
                            { stableKey: 'paint-0', tropeFunction: 'route edit' },
                        ],
                    },
                    {
                        trope: 'Distraction',
                        executionDetail: 'Road Runner pauses for birdseed at the bridge approach.',
                        members: [{ stableKey: 'birdseed-1', tropeFunction: 'target bait' }],
                    },
                    {
                        trope: 'Finishing Move',
                        executionDetail: 'Portable hole is used as the terminal drop endpoint.',
                        members: [{ stableKey: 'portable-hole-0', tropeFunction: 'drop trap' }],
                    },
                ],
            },
        ],
    }),
    'fixture-04': JSON.stringify({
        candidates: [
            {
                candidateId: 'candidate-1',
                executionSummary: 'Magnet control narrows path and steel drum closes the impact beat.',
                tropeAssignments: [
                    {
                        trope: 'Disadvantage',
                        executionDetail: 'Magnet creates persistent path pull in straightaway lane.',
                        members: [{ stableKey: 'magnet-0', tropeFunction: 'path pull' }],
                    },
                    {
                        trope: 'Finishing Move',
                        executionDetail: 'Steel drum rolls through as terminal impact payload.',
                        members: [{ stableKey: 'steel-drum-1', tropeFunction: 'impact payload' }],
                    },
                ],
            },
        ],
    }),
    'fixture-05': JSON.stringify({
        candidates: [
            {
                candidateId: 'candidate-1',
                executionSummary: 'Catapult alone serves as the contraption for a launch-based chase setup.',
                tropeAssignments: [
                    {
                        trope: 'Contraption',
                        executionDetail: 'Catapult is pre-aimed at VORTEX for launch timing.',
                        members: [{ stableKey: 'catapult-0', tropeFunction: 'launch rig' }],
                    },
                ],
            },
        ],
    }),
    'fixture-06': JSON.stringify({
        candidates: [
            {
                candidateId: 'candidate-1',
                executionSummary: 'Birdseed lures, glue constrains, and anvil closes terminally.',
                tropeAssignments: [
                    {
                        trope: 'Distraction',
                        executionDetail: 'Road Runner pauses for birdseed along the straightaway.',
                        members: [{ stableKey: 'birdseed-0', tropeFunction: 'target bait' }],
                    },
                    {
                        trope: 'Disadvantage',
                        executionDetail: 'Glue applies persistent movement constraint in VORTEX lane.',
                        members: [{ stableKey: 'glue-0', tropeFunction: 'speed drag' }],
                    },
                    {
                        trope: 'Finishing Move',
                        executionDetail: 'Anvil drops from CLIFFTOP as the terminal payload.',
                        members: [{ stableKey: 'anvil-0', tropeFunction: 'boom payload' }],
                    },
                ],
            },
        ],
    }),
    'fixture-07': JSON.stringify({
        candidates: [
            {
                candidateId: 'candidate-1',
                executionSummary: 'Trampoline sets trajectory while net imposes terminal containment.',
                tropeAssignments: [
                    {
                        trope: 'Contraption',
                        executionDetail: 'Trampoline is staged to control launch arc.',
                        members: [{ stableKey: 'trampoline-0', tropeFunction: 'launch pad' }],
                    },
                    {
                        trope: 'Disadvantage',
                        executionDetail: 'Net applies capture constraint at CLIFFTOP endpoint.',
                        members: [{ stableKey: 'net-0', tropeFunction: 'capture wrap' }],
                    },
                ],
            },
        ],
    }),
    'fixture-08': JSON.stringify({
        candidates: [
            {
                candidateId: 'candidate-1',
                executionSummary: 'Multi-prop straightaway rig builds speed and release timing before terminal spring impact.',
                tropeAssignments: [
                    {
                        trope: 'Contraption',
                        executionDetail: 'Rocket, skis, and catapult chain into one prep platform.',
                        members: [
                            { stableKey: 'rocket-0', tropeFunction: 'thrust source' },
                            { stableKey: 'skis-1', tropeFunction: 'speed rail' },
                            { stableKey: 'catapult-2', tropeFunction: 'launch arm' },
                        ],
                    },
                    {
                        trope: 'Disadvantage',
                        executionDetail: 'Glue slows pathing to hold timing window.',
                        members: [{ stableKey: 'glue-4', tropeFunction: 'speed drag' }],
                    },
                    {
                        trope: 'Finishing Move',
                        executionDetail: 'Springs deliver the terminal strike at committed lane point.',
                        members: [{ stableKey: 'springs-3', tropeFunction: 'impact snap' }],
                    },
                ],
            },
        ],
    }),
    'fixture-09': JSON.stringify({
        candidates: [
            {
                candidateId: 'candidate-1',
                executionSummary: 'Umbrella, snorkel, and skis form one prep-heavy chase contraption.',
                tropeAssignments: [
                    {
                        trope: 'Contraption',
                        executionDetail: 'Tools combine into a mobility-and-survival prep loadout.',
                        members: [
                            { stableKey: 'umbrella-0', tropeFunction: 'glide aid' },
                            { stableKey: 'snorkel-0', tropeFunction: 'breath prep' },
                            { stableKey: 'skis-0', tropeFunction: 'speed rig' },
                        ],
                    },
                ],
            },
        ],
    }),
    'fixture-10': JSON.stringify({
        candidates: [
            {
                candidateId: 'candidate-1',
                executionSummary: 'Paint and skates prep route, birdseed lures stop, cannon closes with terminal blast.',
                tropeAssignments: [
                    {
                        trope: 'Contraption',
                        executionDetail: 'Roller skates plus paint set speed and deceptive route geometry.',
                        members: [
                            { stableKey: 'roller-skates-0', tropeFunction: 'speed rig' },
                            { stableKey: 'paint-0', tropeFunction: 'route edit' },
                        ],
                    },
                    {
                        trope: 'Distraction',
                        executionDetail: 'Birdseed draws Road Runner into the prepared line.',
                        members: [{ stableKey: 'birdseed-0', tropeFunction: 'target bait' }],
                    },
                    {
                        trope: 'Finishing Move',
                        executionDetail: 'Cannon fires the terminal payload once lane commitment is locked.',
                        members: [{ stableKey: 'cannon-0', tropeFunction: 'boom' }],
                    },
                ],
            },
        ],
    }),
}

const HOP1_HANDOFF_GOLDEN_BY_FIXTURE_ID: Partial<Record<CoyoteEngineTestFixture['id'], CoyoteHop1Handoff>> = {
    'fixture-02': {
        paragraphSummary: 'Choose candidate-1: keep birdseed lure timing aligned to the cliffside lever release so setup and payoff stay in one lane.',
        planIssues: [],
    },
    'fixture-03': {
        paragraphSummary: 'Choose candidate-1: preserve the paint-plus-skates setup, then commit the bridge portable-hole finish after lure confirmation.',
        planIssues: [],
    },
    'fixture-04': {
        paragraphSummary: 'Choose candidate-1: keep magnet control as persistent path pressure and reserve steel drum for the terminal impact beat.',
        planIssues: [],
    },
    'fixture-05': {
        paragraphSummary: 'Choose candidate-1: keep a single catapult-driven lane with explicit setup-to-release timing.',
        planIssues: [],
    },
    'fixture-06': {
        paragraphSummary: 'Choose candidate-1: preserve lure then constraint then anvil payoff ordering across straightaway, vortex, and clifftop.',
        planIssues: [],
    },
    'fixture-07': {
        paragraphSummary: 'Choose candidate-1: trampoline sets trajectory first and net applies terminal containment at the endpoint.',
        planIssues: [],
    },
    'fixture-08': {
        paragraphSummary: 'Choose candidate-1: keep the multi-prop straightaway chain but lock one primary prep sequence before spring impact.',
        planIssues: [],
    },
    'fixture-09': {
        paragraphSummary: 'Choose candidate-1: keep umbrella, snorkel, and skis as a single prep loadout and avoid unsupported terminal claims.',
        planIssues: [],
    },
    'fixture-10': {
        paragraphSummary: 'Choose candidate-1: keep paint-plus-skates setup, birdseed lure, then cannon terminal release in one coherent lane.',
        planIssues: [],
    },
}

for (const fixture of COYOTE_ENGINE_TEST_FIXTURES) {
    if (fixture.planSelectInject !== undefined) {
        continue
    }
    const stageOneSeamBody = STAGE_ONE_GOLDEN_BY_FIXTURE_ID[fixture.id]
    if (!stageOneSeamBody) {
        continue
    }
    fixture.planSelectInject = buildPlanSelectInjectFromGoldenSeam({
        fixtureId: fixture.id,
        roomObjectsByRoom: fixture.roomObjectsByRoom,
        stageOneSeamBody,
    })
}

for (const fixture of COYOTE_ENGINE_TEST_FIXTURES) {
    if (fixture.phasePlanInject !== undefined) {
        continue
    }
    if (fixture.planSelectInject === undefined) {
        continue
    }
    const hop1Handoff = HOP1_HANDOFF_GOLDEN_BY_FIXTURE_ID[fixture.id]
    if (hop1Handoff === undefined) {
        continue
    }
    fixture.phasePlanInject = {
        ...fixture.planSelectInject,
        hop1Handoff,
    }
}

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
