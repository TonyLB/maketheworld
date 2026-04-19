import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoomObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { defaultStableKeyProposal } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'

/** Build harness objects with deterministic uuids (`stableKey` disambiguated per slot; no affinities). */
export function harnessRoomObjects(
    roomSlug: string,
    shortNames: string[]
): EphemeraMetaRoomObject[] {
    return shortNames.map((shortName, index) => ({
        uuid: `OBJECT#harness-${roomSlug}-${index}` as `OBJECT#${string}`,
        shortName,
        stableKey: `${defaultStableKeyProposal(shortName)}-${index}`,
    }))
}

export type CoyoteEngineTestFixture = {
    id: string
    label?: string
    roomObjectsByRoom: Partial<Record<EphemeraRoomId, EphemeraMetaRoomObject[]>>
    hypothesisLine?: string
}

export const COYOTE_ENGINE_TEST_FIXTURES: CoyoteEngineTestFixture[] = [
    {
        id: 'fixture-01',
        label: 'Rocket at the Straightaway',
        roomObjectsByRoom: {
            'ROOM#STRAIGHTAWAY': harnessRoomObjects('straightaway', ['rocket']),
        },
    },
    {
        id: 'fixture-02',
        label: 'Lever at the Top of Cliff; Birdseed at the Base of Cliff',
        roomObjectsByRoom: {
            'ROOM#CLIFFTOP': harnessRoomObjects('clifftop', ['lever']),
            'ROOM#VORTEX': harnessRoomObjects('vortex', ['birdseed']),
        },
    },
    {
        id: 'fixture-03',
        label: 'Roller skates, paint, portable hole, birdseed spread',
        roomObjectsByRoom: {
            'ROOM#STRAIGHTAWAY': harnessRoomObjects('straightaway', ['roller skates']),
            'ROOM#CORNER': harnessRoomObjects('corner', ['paint']),
            'ROOM#BRIDGE': harnessRoomObjects('bridge', ['portable hole', 'birdseed']),
        },
    },
    {
        id: 'fixture-04',
        label: 'Magnet and steel drum at the Straightaway',
        roomObjectsByRoom: {
            'ROOM#STRAIGHTAWAY': harnessRoomObjects('straightaway', ['magnet', 'steel drum']),
        },
    },
    {
        id: 'fixture-05',
        label: 'Catapult at the Base of Cliff',
        roomObjectsByRoom: {
            'ROOM#VORTEX': harnessRoomObjects('vortex', ['catapult']),
        },
    },
    {
        id: 'fixture-06',
        label: 'Birdseed, glue, and anvil across three rooms',
        roomObjectsByRoom: {
            'ROOM#STRAIGHTAWAY': harnessRoomObjects('straightaway', ['birdseed']),
            'ROOM#VORTEX': harnessRoomObjects('vortex', ['glue']),
            'ROOM#CLIFFTOP': harnessRoomObjects('clifftop', ['anvil']),
        },
    },
    {
        id: 'fixture-07',
        label: 'Trampoline and net split by cliff levels',
        roomObjectsByRoom: {
            'ROOM#VORTEX': harnessRoomObjects('vortex', ['trampoline']),
            'ROOM#CLIFFTOP': harnessRoomObjects('clifftop', ['net']),
        },
    },
    {
        id: 'fixture-08',
        label: 'Five-object straightaway bundle',
        roomObjectsByRoom: {
            'ROOM#STRAIGHTAWAY': harnessRoomObjects('straightaway', [
                'rocket',
                'skis',
                'catapult',
                'springs',
                'glue',
            ]),
        },
    },
    {
        id: 'fixture-09',
        label: 'Umbrella, snorkel, and skis distributed',
        roomObjectsByRoom: {
            'ROOM#CLIFFTOP': harnessRoomObjects('clifftop', ['umbrella']),
            'ROOM#CORNER': harnessRoomObjects('corner', ['snorkel']),
            'ROOM#BRIDGE': harnessRoomObjects('bridge', ['skis']),
        },
    },
    {
        id: 'fixture-10',
        label: 'Cannon, birdseed, roller skates, and paint mix',
        roomObjectsByRoom: {
            'ROOM#CLIFFTOP': harnessRoomObjects('clifftop', ['cannon']),
            'ROOM#VORTEX': harnessRoomObjects('vortex', ['birdseed']),
            'ROOM#STRAIGHTAWAY': harnessRoomObjects('straightaway', ['roller skates']),
            'ROOM#CORNER': harnessRoomObjects('corner', ['paint']),
        },
    },
]
