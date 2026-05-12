import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoomObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { CoyoteTropeAffinity } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { defaultStableKeyProposal } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { combineCandidateOutput } from '../pipelines/hypothesis/candidates/combineCandidateOutput'
import type {
    CoyoteHarnessNarrativeBeatsInject,
    CoyoteHarnessPlanSelectInject,
} from '../pipelines/hypothesis/coyoteHarnessInjectTypes'
import type { PlanSelectOutputWithWinner } from '../pipelines/hypothesis/narrativeBeats/buildNarrativeBeatPrompt'
import type { PlanSelectOutput } from '../pipelines/hypothesis/planSelect/parsePlanSelectOutput'
import { parseCandidateOutput } from '../pipelines/hypothesis/candidates/parseCandidateOutput'
import type { CoyoteRoomObjectsByRoom } from '../../utilities/coyoteRoomObjectSnapshot'

export type { CoyoteHarnessNarrativeBeatsInject, CoyoteHarnessPlanSelectInject } from '../pipelines/hypothesis/coyoteHarnessInjectTypes'

/** Same room grid as [`normalizeFixtureRoomObjects`](./runCoyoteEngineTestHarness.ts). */
const COYOTE_HARNESS_ROOM_IDS: EphemeraRoomId[] = [
    'ROOM#VORTEX',
    'ROOM#STRAIGHTAWAY',
    'ROOM#CLIFFTOP',
    'ROOM#CORNER',
    'ROOM#BRIDGE',
]

/** Phase aliases that require hand-maintained inject bundles for **`runOnly`** runs. */
export type CoyoteHarnessInjectPhase = 'planSelect' | 'narrativeBeats'

export type CoyoteHarnessStartAtInjectSuccess =
    | { ok: true; phase: 'planSelect'; inject: CoyoteHarnessPlanSelectInject }
    | { ok: true; phase: 'narrativeBeats'; inject: CoyoteHarnessNarrativeBeatsInject }

export type CoyoteHarnessStartAtInjectResult = CoyoteHarnessStartAtInjectSuccess | { ok: false; message: string }

export type CoyoteEngineTestFixture = {
    id: string
    label?: string
    roomObjectsByRoom: Partial<Record<EphemeraRoomId, EphemeraMetaRoomObject[]>>
    hypothesisLine?: string
    planSelectInject?: CoyoteHarnessPlanSelectInject
    narrativeBeatsInject?: CoyoteHarnessNarrativeBeatsInject
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
    }))
}

/** Build harness objects with deterministic uuids (`stableKey` disambiguated per slot; no trope affinity hints). */
export function harnessRoomObjects(roomSlug: string, shortNames: string[]): EphemeraMetaRoomObject[] {
    return harnessRoomObjectsSpec(roomSlug, shortNames.map((shortName) => ({ shortName })))
}

/** Birdseed staged as bait: placed to stage the gag, then targets the quarry. */
const birdseedLureAffinities: CoyoteTropeAffinity[] = [
    {
        trope: 'Bait',
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
                    narrowing: 'payload delivery into terminal beat'
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
            gimmick: 'high speed chase',
            executionSummary: 'Coyote rides the rocket to chase down Road Runner.',
            tropeAssignments: {
                Contraption: {
                    executionDetail: 'Rocket accelerates down the straightaway.',
                    members: [
                        {
                            stableKey: 'rocket-0',
                            tropeFunction: 'vehicle',
                        },
                    ],
                },
            },
        },
    ],
})

function buildFixture01PlanSelectInject(): CoyoteHarnessPlanSelectInject {
    const roomObjectsByRoom = normalizeCoyoteHarnessRoomObjects(FIXTURE_01_ROOM_OBJECTS)
    const seamParsed = parseCandidateOutput(FIXTURE_01_GOLDEN_SEAM_BODY, roomObjectsByRoom)
    if (!seamParsed.ok) {
        throw new Error(`fixture-01 planSelect golden seam: ${seamParsed.errorMessage}`)
    }
    const combinedResult = combineCandidateOutput(
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
const FIXTURE_01_NARRATIVE_BEATS_HANDOFF: PlanSelectOutputWithWinner = {
    paragraphSummary:
        'Conflict review favors candidate-1: lock a single Contraption-first lane using the straightaway rocket setup, materialize Coyote as the finishing-move affordance grounded on that same seam, then carry the lane through the terminal beat with no prop-role conflicts.',
    planIssues: [],
    selectedCandidate: {
        candidateId: 'candidate-1',
        gimmick: 'high speed chase',
        executionSummary: 'Use the straightaway rocket lane as the main trap route.',
        tropeAssignments: {
            Contraption: {
                executionDetail: 'Rocket hardware is staged and aligned on the straightaway.',
                members: [
                    {
                        stableKey: 'rocket-0',
                        shortName: 'rocket',
                        room: 'STRAIGHTAWAY',
                        tropeFunction: 'delivery lane hardware for straightaway setup',
                    },
                ],
            },
            'Finishing Move': {
                executionDetail: 'Coyote closes the beat as the terminal pursuit affordance tied to the rocket lane.',
                members: [
                    {
                        stableKey: 'affordance:coyote',
                        shortName: 'Coyote',
                        room: 'STRAIGHTAWAY',
                        tropeFunction: 'terminal chase beat',
                    },
                ],
            },
        },
        outliers: [],
    },
}
const FIXTURE_01_NARRATIVE_BEATS_INJECT: CoyoteHarnessNarrativeBeatsInject = {
    roomObjectsByRoom: FIXTURE_01_PLAN_SELECT_INJECT.roomObjectsByRoom,
    planSelectOutput: FIXTURE_01_NARRATIVE_BEATS_HANDOFF,
}

function buildPlanSelectInjectFromGoldenSeam(args: {
    fixtureId: string
    roomObjectsByRoom: Partial<Record<EphemeraRoomId, EphemeraMetaRoomObject[]>>
    stageOneSeamBody: string
}): CoyoteHarnessPlanSelectInject {
    const roomObjectsByRoom = normalizeCoyoteHarnessRoomObjects(args.roomObjectsByRoom)
    const seamParsed = parseCandidateOutput(args.stageOneSeamBody, roomObjectsByRoom)
    if (!seamParsed.ok) {
        throw new Error(`${args.fixtureId} planSelect golden seam: ${seamParsed.errorMessage}`)
    }
    const combinedResult = combineCandidateOutput(
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
        narrativeBeatsInject: FIXTURE_01_NARRATIVE_BEATS_INJECT,
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
                            narrowing: 'mechanically tip or move things',
                            environmentAffordances: [{ object: 'boulder', roles: ['Finishing Move'] }],
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
                    ],
                },
            ]),
            'ROOM#CORNER': harnessRoomObjectsSpec('corner', [
                {
                    shortName: 'paint',
                    tropeAffinities: [
                        {
                            trope: 'Misdirection',
                            aptness: 'High',
                            narrowing: 'visual lure through fake passage cue',
                            environmentAffordances: [{ object: 'rock-wall', roles: ['Finishing Move'] }],
                        },
                        {
                            trope: 'Bait',
                            aptness: 'Good',
                            narrowing: 'helps draw attention'
                        },
                        {
                            trope: 'Contraption',
                            aptness: 'Poor',
                            narrowing: 'camouflage or decorate components',
                        }
                    ],
                },
            ]),
            'ROOM#BRIDGE': harnessRoomObjectsSpec('bridge', [
                {
                    shortName: 'portable hole',
                    tropeAffinities: [
                        {
                            trope: 'Misdirection',
                            aptness: 'High',
                            narrowing: 'persistent route hazard',
                            environmentAffordances: [{ object: 'long-fall', roles: ['Finishing Move'] }],
                        },
                        {
                            trope: 'Disadvantage',
                            aptness: 'Good',
                            narrowing: 'drop into an enclosed pit'
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
                            aptness: 'Good',
                            narrowing: 'persistent pull if Road Runner is made magnetic',
                        },
                        {
                            trope: 'Contraption',
                            aptness: 'High',
                            narrowing: 'attracts toward metal objects'
                        },
                    ],
                },
                {
                    shortName: 'steel drum',
                    tropeAffinities: [
                        {
                            trope: 'Contraption',
                            aptness: 'Good',
                            narrowing: 'vehicle or carrier',
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
                            environmentAffordances: [{
                                object: 'boulder',
                                roles: ['Finishing Move'],
                            }],
                        }
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
                            narrowing: 'slow target',
                        },
                        {
                            trope: 'Contraption',
                            aptness: 'Good',
                            narrowing: 'attach things',
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
                            environmentAffordances: [{
                                object: 'long-fall',
                                roles: ['Contraption'],
                            }],
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
                            narrowing: 'changes trajectory',
                            environmentAffordances: [{
                                object: 'boulder',
                                roles: ['Finishing Move'],
                            }, {
                                object: 'tumbleweed',
                                roles: ['Contraption'],
                            }],
                        },
                        {
                            trope: 'Disadvantage',
                            aptness: 'Good',
                            narrowing: 'forced bounce path control',
                            environmentAffordances: [{
                                object: 'cactus',
                                roles: ['Disadvantage'],
                            }, {
                                object: 'long-fall',
                                roles: ['Finishing Move'],
                            }],
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
                        }
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
                            narrowing: 'blow target up',
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
                        }
                    ],
                },
                {
                    shortName: 'catapult',
                    tropeAffinities: [
                        {
                            trope: 'Contraption',
                            aptness: 'High',
                            narrowing: 'launch platform in primary setup chain',
                            environmentAffordances: [{
                                object: 'boulder',
                                roles: ['Finishing Move'],
                            }],
                        }
                    ],
                },
                {
                    shortName: 'springs',
                    tropeAffinities: [
                        {
                            trope: 'Contraption',
                            aptness: 'Good',
                            narrowing: 'launches or redirects',
                            environmentAffordances: [{
                                object: 'boulder',
                                roles: ['Finishing Move'],
                            }],
                        },
                    ],
                },
                {
                    shortName: 'glue',
                    tropeAffinities: [
                        {
                            trope: 'Disadvantage',
                            aptness: 'High',
                            narrowing: 'slow target',
                        },
                        {
                            trope: 'Contraption',
                            aptness: 'Good',
                            narrowing: 'attach things',
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
                            trope: 'Misdirection',
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
                        }
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
                            trope: 'Contraption',
                            aptness: 'High',
                            narrowing: 'shoots something',
                            affordancesProvided: [{ object: 'cannonball', roles: ['Finishing Move'] }],
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
                        }
                    ],
                },
            ]),
            'ROOM#CORNER': harnessRoomObjectsSpec('corner', [
                {
                    shortName: 'paint',
                    tropeAffinities: [
                        {
                            trope: 'Misdirection',
                            aptness: 'High',
                            narrowing: 'visual lure through fake passage cue',
                            environmentAffordances: [{ object: 'rock-wall', roles: ['Finishing Move'] }],
                        },
                        {
                            trope: 'Bait',
                            aptness: 'Good',
                            narrowing: 'helps draw attention'
                        },
                        {
                            trope: 'Contraption',
                            aptness: 'Poor',
                            narrowing: 'camouflage or decorate components',
                        }
                    ]
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
                gimmick: 'deliver damage',
                executionSummary: 'Birdseed lures Road Runner while lever rig prepares the cliffside release.',
                tropeAssignments: {
                    Contraption: {
                        executionDetail: 'Lever is staged at CLIFFTOP as release hardware.',
                        members: [{ stableKey: 'lever-0', tropeFunction: 'release lever' }],
                    },
                    Bait: {
                        executionDetail: 'Road Runner stops to eat birdseed at CLIFFBASE.',
                        members: [{ stableKey: 'birdseed-0', tropeFunction: 'lane bait' }],
                    },
                },
            },
        ],
    }),
    'fixture-03': JSON.stringify({
        candidates: [
            {
                candidateId: 'candidate-1',
                gimmick: 'hole trap',
                executionSummary: 'Paint and skates prep a route while birdseed lures into a portable-hole finish.',
                tropeAssignments: {
                    Contraption: {
                        executionDetail: 'Roller skates and paint prep speed and route illusion before commitment.',
                        members: [
                            { stableKey: 'roller-skates-0', tropeFunction: 'speed rig' },
                            { stableKey: 'paint-0', tropeFunction: 'route edit' },
                        ],
                    },
                    Bait: {
                        executionDetail: 'Road Runner pauses for birdseed at the bridge approach.',
                        members: [{ stableKey: 'birdseed-1', tropeFunction: 'target bait' }],
                    },
                    'Finishing Move': {
                        executionDetail: 'Portable hole is used as the terminal drop endpoint.',
                        members: [{ stableKey: 'portable-hole-0', tropeFunction: 'drop trap' }],
                    },
                },
            },
        ],
    }),
    'fixture-04': JSON.stringify({
        candidates: [
            {
                candidateId: 'candidate-1',
                gimmick: 'deliver damage',
                executionSummary: 'Magnet control narrows path and steel drum closes the impact beat.',
                tropeAssignments: {
                    Disadvantage: {
                        executionDetail: 'Magnet creates persistent path pull in straightaway lane.',
                        members: [{ stableKey: 'magnet-0', tropeFunction: 'path pull' }],
                    },
                    'Finishing Move': {
                        executionDetail: 'Steel drum rolls through as terminal impact payload.',
                        members: [{ stableKey: 'steel-drum-1', tropeFunction: 'impact payload' }],
                    },
                },
            },
        ],
    }),
    'fixture-05': JSON.stringify({
        candidates: [
            {
                candidateId: 'candidate-1',
                gimmick: 'unexpected approach',
                executionSummary: 'Catapult alone serves as the contraption for a launch-based chase setup.',
                tropeAssignments: {
                    Contraption: {
                        executionDetail: 'Catapult is pre-aimed at CLIFFBASE for launch timing.',
                        members: [
                            {
                                stableKey: 'catapult-0',
                                tropeFunction: 'launch rig',
                                environmentAffordances: [{ object: 'boulder', roles: ['Finishing Move'] }],
                            },
                        ],
                    },
                },
            },
        ],
    }),
    'fixture-06': JSON.stringify({
        candidates: [
            {
                candidateId: 'candidate-1',
                gimmick: 'deliver damage',
                executionSummary: 'Birdseed lures, glue constrains, and anvil closes terminally.',
                tropeAssignments: {
                    Bait: {
                        executionDetail: 'Road Runner pauses for birdseed along the straightaway.',
                        members: [{ stableKey: 'birdseed-0', tropeFunction: 'target bait' }],
                    },
                    Disadvantage: {
                        executionDetail: 'Glue applies persistent movement constraint in CLIFFBASE lane.',
                        members: [{ stableKey: 'glue-0', tropeFunction: 'speed drag' }],
                    },
                    'Finishing Move': {
                        executionDetail: 'Anvil drops from CLIFFTOP as the terminal payload.',
                        members: [{ stableKey: 'anvil-0', tropeFunction: 'boom payload' }],
                    },
                },
            },
        ],
    }),
    'fixture-07': JSON.stringify({
        candidates: [
            {
                candidateId: 'candidate-1',
                gimmick: 'booby-trap',
                executionSummary: 'Trampoline sets trajectory while net imposes terminal containment.',
                tropeAssignments: {
                    Contraption: {
                        executionDetail: 'Trampoline is staged to control launch arc.',
                        members: [{ stableKey: 'trampoline-0', tropeFunction: 'launch pad' }],
                    },
                    Disadvantage: {
                        executionDetail: 'Net applies capture constraint at CLIFFTOP endpoint.',
                        members: [{ stableKey: 'net-0', tropeFunction: 'capture wrap' }],
                    },
                },
            },
        ],
    }),
    'fixture-08': JSON.stringify({
        candidates: [
            {
                candidateId: 'candidate-1',
                gimmick: 'high speed unexpected approach',
                executionSummary: 'Multi-prop straightaway rig builds speed and release timing before terminal spring impact.',
                tropeAssignments: {
                    Contraption: {
                        executionDetail: 'Rocket, skis, catapult, and spring chain into one prep platform.',
                        members: [
                            { stableKey: 'rocket-0', tropeFunction: 'thrust source' },
                            { stableKey: 'skis-1', tropeFunction: 'speed rail' },
                            {
                                stableKey: 'catapult-2',
                                tropeFunction: 'launch arm',
                                environmentAffordances: [{ object: 'boulder', roles: ['Finishing Move'] }],
                            },
                            {
                                stableKey: 'springs-3',
                                tropeFunction: 'launch',
                                environmentAffordances: [{ object: 'boulder', roles: ['Finishing Move'] }],
                            },
                        ],
                    },
                    Disadvantage: {
                        executionDetail: 'Glue slows pathing to hold timing window.',
                        members: [{ stableKey: 'glue-4', tropeFunction: 'speed drag' }],
                    },
                },
            },
        ],
    }),
    'fixture-09': JSON.stringify({
        candidates: [
            {
                candidateId: 'candidate-1',
                gimmick: 'complicated chase',
                executionSummary: 'Umbrella, snorkel, and skis form one prep-heavy chase contraption.',
                tropeAssignments: {
                    Contraption: {
                        executionDetail: 'Tools combine into a mobility-and-survival prep loadout.',
                        members: [
                            { stableKey: 'umbrella-0', tropeFunction: 'glide aid' },
                            { stableKey: 'snorkel-0', tropeFunction: 'breath prep' },
                            { stableKey: 'skis-0', tropeFunction: 'speed rig' },
                        ],
                    },
                },
            },
        ],
    }),
    'fixture-10': JSON.stringify({
        candidates: [
            {
                candidateId: 'candidate-1',
                gimmick: 'deliver damage',
                executionSummary: 'Paint and skates prep route, birdseed lures stop, cannon closes with terminal blast.',
                tropeAssignments: {
                    Contraption: {
                        executionDetail: 'Roller skates plus paint set speed and deceptive route geometry.',
                        members: [
                            { stableKey: 'roller-skates-0', tropeFunction: 'speed rig' },
                            { stableKey: 'paint-0', tropeFunction: 'route edit' },
                            {
                                stableKey: 'cannon-0',
                                tropeFunction: 'boom',
                                affordancesProvided: [{ object: 'cannonball', roles: ['Finishing Move'] }],
                            },
                        ],
                    },
                    Bait: {
                        executionDetail: 'Birdseed draws Road Runner into the prepared line.',
                        members: [{ stableKey: 'birdseed-0', tropeFunction: 'target bait' }],
                    },
                },
            },
        ],
    }),
}

const PLAN_SELECT_OUTPUT_GOLDEN_BY_FIXTURE_ID: Partial<Record<CoyoteEngineTestFixture['id'], PlanSelectOutput>> = {
    'fixture-02': {
        paragraphSummary: 'Choose candidate-1: keep birdseed lure timing aligned to the cliffside lever release so setup and payoff stay in one lane.',
        planIssues: [],
        selectedCandidate: {
            candidateId: 'candidate-1',
            gimmick: 'deliver damage',
            executionSummary: 'Birdseed lures Road Runner while lever rig prepares the cliffside release.',
            tropeAssignments: {
                Contraption: {
                    executionDetail: 'Lever is staged at CLIFFTOP as release hardware.',
                    members: [
                        {
                            stableKey: 'lever-0',
                            shortName: 'lever',
                            room: 'CLIFFTOP',
                            tropeFunction: 'release lever',
                        },
                    ],
                },
                Bait: {
                    executionDetail: 'Road Runner stops to eat birdseed at CLIFFBASE.',
                    members: [
                        {
                            stableKey: 'birdseed-0',
                            shortName: 'birdseed',
                            room: 'CLIFFBASE',
                            tropeFunction: 'lane bait',
                        },
                    ],
                },
            },
            outliers: [],
        },
    },
    'fixture-03': {
        paragraphSummary: 'Choose candidate-1: preserve the paint-plus-skates setup, then commit the bridge portable-hole finish after lure confirmation.',
        planIssues: [],
        selectedCandidate: {
            candidateId: 'candidate-1',
            gimmick: 'hole trap',
            executionSummary: 'Paint and skates prep a route while birdseed lures into a portable-hole finish.',
            tropeAssignments: {
                Contraption: {
                    executionDetail: 'Roller skates and paint prep speed and route illusion before commitment.',
                    members: [
                        {
                            stableKey: 'roller-skates-0',
                            shortName: 'roller skates',
                            room: 'STRAIGHTAWAY',
                            tropeFunction: 'speed rig',
                        },
                        {
                            stableKey: 'paint-0',
                            shortName: 'paint',
                            room: 'CORNER',
                            tropeFunction: 'route edit',
                        },
                    ],
                },
                Bait: {
                    executionDetail: 'Road Runner pauses for birdseed at the bridge approach.',
                    members: [
                        {
                            stableKey: 'birdseed-1',
                            shortName: 'birdseed',
                            room: 'BRIDGE',
                            tropeFunction: 'target bait',
                        },
                    ],
                },
                'Finishing Move': {
                    executionDetail: 'Portable hole is used as the terminal drop endpoint.',
                    members: [
                        {
                            stableKey: 'portable-hole-0',
                            shortName: 'portable hole',
                            room: 'BRIDGE',
                            tropeFunction: 'drop trap',
                        },
                    ],
                },
            },
            outliers: [],
        },
    },
    'fixture-04': {
        paragraphSummary: 'Choose candidate-1: keep magnet control as persistent path pressure and reserve steel drum for the terminal impact beat.',
        planIssues: [],
        selectedCandidate: {
            candidateId: 'candidate-1',
            gimmick: 'deliver damage',
            executionSummary: 'Magnet control narrows path and steel drum closes the impact beat.',
            tropeAssignments: {
                Contraption: {
                    executionDetail: 'Magnet pulls the drum into position.',
                    members: [
                        {
                            stableKey: 'magnet-0',
                            shortName: 'magnet',
                            room: 'STRAIGHTAWAY',
                            tropeFunction: 'path pull',
                        },
                    ],
                },
                'Finishing Move': {
                    executionDetail: 'Steel drum flattens the Road Runner.',
                    members: [
                        {
                            stableKey: 'steel-drum-1',
                            shortName: 'steel drum',
                            room: 'STRAIGHTAWAY',
                            tropeFunction: 'impact payload',
                        },
                    ],
                },
            },
            outliers: [],
        },
    },
    'fixture-05': {
        paragraphSummary: 'Choose candidate-1: keep a single catapult-driven lane with explicit setup-to-release timing.',
        planIssues: [],
        selectedCandidate: {
            candidateId: 'candidate-1',
            gimmick: 'unexpected approach',
            executionSummary: 'Catapult launches a boulder at the Road Runner.',
            tropeAssignments: {
                Contraption: {
                    executionDetail: 'Catapult is pre-aimed at CLIFFBASE for launch timing.',
                    members: [
                        {
                            stableKey: 'catapult-0',
                            shortName: 'catapult',
                            room: 'VORTEX',
                            tropeFunction: 'launch rig',
                        },
                    ],
                },
                'Finishing Move': {
                    executionDetail: 'Boulder smashes the Road Runner.',
                    members: [
                        {
                            stableKey: 'affordance:boulder',
                            shortName: 'boulder',
                            room: 'VORTEX',
                            tropeFunction: 'impact payload',
                        },
                    ],
                },
            },
            outliers: [],
        },
    },
    'fixture-06': {
        paragraphSummary: 'Choose candidate-1: preserve lure then constraint then anvil payoff ordering across straightaway, vortex, and clifftop.',
        planIssues: [],
        selectedCandidate: {
            candidateId: 'candidate-1',
            gimmick: 'deliver damage',
            executionSummary: 'Birdseed lures, glue constrains, and anvil closes terminally.',
            tropeAssignments: {
                Bait: {
                    executionDetail: 'Road Runner pauses for birdseed along the straightaway.',
                    members: [
                        {
                            stableKey: 'birdseed-0',
                            shortName: 'birdseed',
                            room: 'STRAIGHTAWAY',
                            tropeFunction: 'target bait',
                        },
                    ],
                },
                Disadvantage: {
                    executionDetail: 'Glue applies persistent movement constraint in CLIFFBASE lane.',
                    members: [
                        {
                            stableKey: 'glue-0',
                            shortName: 'glue',
                            room: 'VORTEX',
                            tropeFunction: 'speed drag',
                        },
                    ],
                },
                'Finishing Move': {
                    executionDetail: 'Anvil drops from CLIFFTOP as the terminal payload.',
                    members: [
                        {
                            stableKey: 'anvil-0',
                            shortName: 'anvil',
                            room: 'CLIFFTOP',
                            tropeFunction: 'smashing payload',
                        },
                    ],
                },
            },
            outliers: [],
        },
    },
    'fixture-07': {
        paragraphSummary: 'Choose candidate-1: trampoline sets trajectory first and net applies terminal containment at the endpoint.',
        planIssues: [],
        selectedCandidate: {
            candidateId: 'candidate-1',
            gimmick: 'booby-trap',
            executionSummary: 'Trampoline sets trajectory while net imposes terminal containment.',
            tropeAssignments: {
                Contraption: {
                    executionDetail: 'Trampoline is staged to control launch arc.',
                    members: [
                        {
                            stableKey: 'trampoline-0',
                            shortName: 'trampoline',
                            room: 'VORTEX',
                            tropeFunction: 'launch pad',
                        },
                    ],
                },
                Disadvantage: {
                    executionDetail: 'Net applies capture constraint at CLIFFTOP endpoint.',
                    members: [
                        {
                            stableKey: 'net-0',
                            shortName: 'net',
                            room: 'CLIFFTOP',
                            tropeFunction: 'capture wrap',
                        },
                    ],
                },
                'Finishing Move': {
                    executionDetail: 'Coyote captures the Road Runner.',
                    members: [
                        {
                            stableKey: 'affordance:coyote',
                            shortName: 'Coyote',
                            room: 'CLIFFTOP',
                            tropeFunction: 'finish',
                        },
                    ],
                },
            },
            outliers: [],
        },
    },
    'fixture-08': {
        paragraphSummary: 'Choose candidate-1: keep the multi-prop straightaway chain but lock one primary prep sequence before spring impact.',
        planIssues: [],
        selectedCandidate: {
            candidateId: 'candidate-1',
            gimmick: 'high speed unexpected approach',
            executionSummary:
                'Multi-prop straightaway rig builds speed and release timing before terminal spring impact.',
            tropeAssignments: {
                Contraption: {
                    executionDetail: 'Rocket, spring, and catapult chain into one multi-stage launch of Coyote on skis.',
                    members: [
                        {
                            stableKey: 'rocket-0',
                            shortName: 'rocket',
                            room: 'STRAIGHTAWAY',
                            tropeFunction: 'increase speed',
                        },
                        {
                            stableKey: 'skis-1',
                            shortName: 'skis',
                            room: 'STRAIGHTAWAY',
                            tropeFunction: 'control at speed',
                        },
                        {
                            stableKey: 'springs-3',
                            shortName: 'springs',
                            room: 'STRAIGHTAWAY',
                            tropeFunction: 'launch',
                        },
                        {
                            stableKey: 'catapult-2',
                            shortName: 'catapult',
                            room: 'STRAIGHTAWAY',
                            tropeFunction: 'launch',
                        },
                    ],
                },
                Disadvantage: {
                    executionDetail: 'Glue slows pathing to hold timing window.',
                    members: [
                        {
                            stableKey: 'glue-4',
                            shortName: 'glue',
                            room: 'STRAIGHTAWAY',
                            tropeFunction: 'speed drag',
                        },
                    ],
                },
                'Finishing Move': {
                    executionDetail: 'Coyote captures the Road Runner.',
                    members: [
                        {
                            stableKey: 'affordance:coyote',
                            shortName: 'Coyote',
                            room: 'STRAIGHTAWAY',
                            tropeFunction: 'finish',
                        },
                    ],
                },
            },
            outliers: [],
        },
    },
    'fixture-09': {
        paragraphSummary: 'Choose candidate-1: keep umbrella, snorkel, and skis as a single prep loadout and avoid unsupported terminal claims.',
        planIssues: [],
        selectedCandidate: {
            candidateId: 'candidate-1',
            gimmick: 'complicated chase',
            executionSummary: 'Umbrella, snorkel, and skis form one Rube-Goldberg contraption.',
            tropeAssignments: {
                Contraption: {
                    executionDetail: 'Tools combine into a multi-stage sequence.',
                    members: [
                        {
                            stableKey: 'umbrella-0',
                            shortName: 'umbrella',
                            room: 'CLIFFTOP',
                            tropeFunction: 'glide aid',
                        },
                        {
                            stableKey: 'snorkel-0',
                            shortName: 'snorkel',
                            room: 'CORNER',
                            tropeFunction: 'breath prep',
                        },
                        {
                            stableKey: 'skis-0',
                            shortName: 'skis',
                            room: 'BRIDGE',
                            tropeFunction: 'speed rig',
                        },
                    ],
                },
            },
            outliers: [],
        },
    },
    'fixture-10': {
        paragraphSummary: 'Choose candidate-1: keep paint-plus-skates setup, birdseed lure, then cannon terminal release in one coherent lane.',
        planIssues: [],
        selectedCandidate: {
            candidateId: 'candidate-1',
            gimmick: 'deliver damage',
            executionSummary:
                'Paint and birdseed lure stop, Coyote on skates starts a chase, then cannon finishes.',
            tropeAssignments: {
                Contraption: {
                    executionDetail: 'Coyote chases with roller skates into the path of the cannonball.',
                    members: [
                        {
                            stableKey: 'roller-skates-0',
                            shortName: 'roller skates',
                            room: 'STRAIGHTAWAY',
                            tropeFunction: 'speed rig',
                        },
                        {
                            stableKey: 'cannon-0',
                            shortName: 'cannon',
                            room: 'CLIFFTOP',
                            tropeFunction: 'launch',
                        },
                    ],
                },
                Bait: {
                    executionDetail: 'Birdseed draws Road Runner into the prepared line.',
                    members: [
                        {
                            stableKey: 'birdseed-0',
                            shortName: 'birdseed',
                            room: 'VORTEX',
                            tropeFunction: 'target bait',
                        },
                        {
                            stableKey: 'paint-0',
                            shortName: 'paint',
                            room: 'CORNER',
                            tropeFunction: 'attention draw',
                        },
                    ],
                },
                'Finishing Move': {
                    executionDetail: 'Cannonball finishes the chase by hitting the Road Runner.',
                    members: [
                        {
                            stableKey: 'affordance:cannonball',
                            shortName: 'cannonball',
                            room: 'CLIFFTOP',
                            tropeFunction: 'impact payload',
                        },
                    ],
                },
            },
            outliers: [],
        },
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
    if (fixture.narrativeBeatsInject !== undefined) {
        continue
    }
    if (fixture.planSelectInject === undefined) {
        continue
    }
    const planSelectOutput = PLAN_SELECT_OUTPUT_GOLDEN_BY_FIXTURE_ID[fixture.id]
    if (planSelectOutput === undefined || planSelectOutput.selectedCandidate === undefined) {
        continue
    }
    fixture.narrativeBeatsInject = {
        roomObjectsByRoom: fixture.planSelectInject.roomObjectsByRoom,
        planSelectOutput: planSelectOutput as PlanSelectOutputWithWinner,
    }
}

/**
 * Resolve start-at inject for **`planSelect`** / **`narrativeBeats`** (1-based fixture index, slash / harness aligned).
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
    const inject = fixture.narrativeBeatsInject
    if (inject === undefined) {
        return {
            ok: false,
            message:
                `Coyote engine test harness does not yet supply starting input for run-only phase "narrativeBeats" at fixture index ${i} (${fixture.id}).`,
        }
    }
    return { ok: true, phase: 'narrativeBeats', inject }
}
