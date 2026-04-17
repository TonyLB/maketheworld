import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

export type CoyoteEngineTestFixture = {
    id: string
    label?: string
    roomObjectsByRoom: Partial<Record<EphemeraRoomId, string[]>>
    hypothesisLine?: string
}

export const COYOTE_ENGINE_TEST_FIXTURES: CoyoteEngineTestFixture[] = [
    {
        id: 'fixture-01',
        label: 'Rocket at the Straightaway',
        roomObjectsByRoom: {
            'ROOM#STRAIGHTAWAY': ['rocket'],
        },
    },
    {
        id: 'fixture-02',
        label: 'Lever at the Top of Cliff; Birdseed at the Base of Cliff',
        roomObjectsByRoom: {
            'ROOM#CLIFFTOP': ['lever'],
            'ROOM#VORTEX': ['birdseed'],
        },
    },
    {
        id: 'fixture-03',
        label: 'Roller skates, paint, portable hole, birdseed spread',
        roomObjectsByRoom: {
            'ROOM#STRAIGHTAWAY': ['roller skates'],
            'ROOM#CORNER': ['paint'],
            'ROOM#BRIDGE': ['portable hole', 'birdseed'],
        },
    },
    {
        id: 'fixture-04',
        label: 'Magnet and steel drum at the Straightaway',
        roomObjectsByRoom: {
            'ROOM#STRAIGHTAWAY': ['magnet', 'steel drum'],
        },
    },
    {
        id: 'fixture-05',
        label: 'Catapult at the Base of Cliff',
        roomObjectsByRoom: {
            'ROOM#VORTEX': ['catapult'],
        },
    },
    {
        id: 'fixture-06',
        label: 'Birdseed, glue, and anvil across three rooms',
        roomObjectsByRoom: {
            'ROOM#STRAIGHTAWAY': ['birdseed'],
            'ROOM#VORTEX': ['glue'],
            'ROOM#CLIFFTOP': ['anvil'],
        },
    },
    {
        id: 'fixture-07',
        label: 'Trampoline and net split by cliff levels',
        roomObjectsByRoom: {
            'ROOM#VORTEX': ['trampoline'],
            'ROOM#CLIFFTOP': ['net'],
        },
    },
    {
        id: 'fixture-08',
        label: 'Five-object straightaway bundle',
        roomObjectsByRoom: {
            'ROOM#STRAIGHTAWAY': ['rocket', 'skis', 'catapult', 'springs', 'glue'],
        },
    },
    {
        id: 'fixture-09',
        label: 'Umbrella, snorkel, and skis distributed',
        roomObjectsByRoom: {
            'ROOM#CLIFFTOP': ['umbrella'],
            'ROOM#CORNER': ['snorkel'],
            'ROOM#BRIDGE': ['skis'],
        },
    },
    {
        id: 'fixture-10',
        label: 'Cannon, birdseed, roller skates, and paint mix',
        roomObjectsByRoom: {
            'ROOM#CLIFFTOP': ['cannon'],
            'ROOM#VORTEX': ['birdseed'],
            'ROOM#STRAIGHTAWAY': ['roller skates'],
            'ROOM#CORNER': ['paint'],
        },
    },
]
