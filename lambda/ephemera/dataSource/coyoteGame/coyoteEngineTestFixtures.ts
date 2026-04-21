import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoomObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { CoyoteAffinityPossibility } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { defaultStableKeyProposal } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'

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

export type CoyoteEngineTestFixture = {
    id: string
    label?: string
    roomObjectsByRoom: Partial<Record<EphemeraRoomId, EphemeraMetaRoomObject[]>>
    hypothesisLine?: string
}

/** Birdseed staged as bait: placed to stage the gag, then targets the quarry. */
const birdseedLureAffinities: CoyoteAffinityPossibility[] = [
    {
        role: 'entity_modification',
        target: 'road_runner',
        mode: 'direct',
        aptness: 0.8,
    },
]

export const COYOTE_ENGINE_TEST_FIXTURES: CoyoteEngineTestFixture[] = [
    {
        id: 'fixture-01',
        label: 'Rocket at the Straightaway',
        roomObjectsByRoom: {
            'ROOM#STRAIGHTAWAY': harnessRoomObjectsSpec('straightaway', [
                {
                    shortName: 'rocket',
                    affinities: [
                        { role: 'delivery', aptness: 0.4 },
                        {
                            role: 'entity_modification',
                            target: 'coyote',
                            mode: 'direct',
                            aptness: 0.69,
                        },
                        { role: 'terminal', aptness: 0.61 },
                    ],
                },
            ]),
        },
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
                            role: 'entity_modification',
                            target: 'coyote',
                            mode: 'constructive',
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
                            role: 'entity_modification',
                            target: 'prop',
                            mode: 'constructive',
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
                            role: 'entity_modification',
                            target: 'road_runner',
                            mode: 'direct',
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
                            role: 'entity_modification',
                            target: 'prop',
                            mode: 'direct',
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
                            role: 'entity_modification',
                            target: 'coyote',
                            mode: 'direct',
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
                            role: 'entity_modification',
                            target: 'coyote',
                            mode: 'constructive',
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
                            role: 'entity_modification',
                            target: 'coyote',
                            mode: 'constructive',
                            aptness: 0.57,
                        },
                        {
                            role: 'entity_modification',
                            target: 'prop',
                            mode: 'direct',
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
                            role: 'entity_modification',
                            target: 'coyote',
                            mode: 'constructive',
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
                            role: 'entity_modification',
                            target: 'coyote',
                            mode: 'constructive',
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
                            role: 'entity_modification',
                            target: 'coyote',
                            mode: 'constructive',
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
                            role: 'entity_modification',
                            target: 'coyote',
                            mode: 'constructive',
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
                            role: 'entity_modification',
                            target: 'prop',
                            mode: 'constructive',
                            aptness: 0.6,
                        },
                        { role: 'prep', aptness: 0.7 },
                    ],
                },
            ]),
        },
    },
]
