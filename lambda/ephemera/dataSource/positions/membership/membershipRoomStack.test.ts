import {
    applyLadderUpdateFromDestinationChain,
    buildAssetChainForAsset,
    classifyRoomStackNavigateOperation,
    resolveDestinationAssetChain,
} from './membershipRoomStack'
import { trimRoomStackToAccessibleAssets } from './trimEvictionLadder'

const canonAssets = ['primitives', 'TownCenter']
const characterAssets = ['draftOne', 'circusEvent']

describe('resolveDestinationAssetChain', () => {
    it('picks the shallowest accessible participating asset chain', () => {
        expect(resolveDestinationAssetChain(
            ['ASSET#TownCenter', 'ASSET#draftOne'],
            canonAssets,
            characterAssets
        )).toEqual(['primitives', 'TownCenter'])
    })

    it('extends through personal assets when they are the shallowest participant', () => {
        expect(resolveDestinationAssetChain(
            ['ASSET#draftOne'],
            canonAssets,
            characterAssets,
            [{ asset: 'primitives', RoomId: 'VORTEX' }, { asset: 'TownCenter', RoomId: 'Suburbs' }]
        )).toEqual(['primitives', 'TownCenter', 'draftOne'])
    })

    it('falls back to primitives when no participants are accessible', () => {
        expect(resolveDestinationAssetChain(
            ['ASSET#unknown'],
            canonAssets,
            characterAssets
        )).toEqual(['primitives'])
    })
})

describe('classifyRoomStackNavigateOperation', () => {
    const baseStack = [
        { asset: 'primitives', RoomId: 'VORTEX' },
        { asset: 'TownCenter', RoomId: 'TownSquare' },
    ]

    it('classifies extend when destination chain adds an outer layer', () => {
        expect(classifyRoomStackNavigateOperation(
            baseStack,
            ['primitives', 'TownCenter', 'draftOne']
        )).toBe('extend')
    })

    it('classifies rewriteTail for lateral move within the same deepest asset', () => {
        expect(classifyRoomStackNavigateOperation(
            baseStack,
            ['primitives', 'TownCenter']
        )).toBe('rewriteTail')
    })

    it('classifies fork when destination chain diverges from the current branch', () => {
        expect(classifyRoomStackNavigateOperation(
            [
                ...baseStack,
                { asset: 'draftOne', RoomId: 'Laboratory' },
            ],
            ['primitives', 'TownCenter', 'circusEvent']
        )).toBe('fork')
    })
})

describe('applyLadderUpdateFromDestinationChain', () => {
    const baseStack = [
        { asset: 'primitives', RoomId: 'VORTEX' },
        { asset: 'TownCenter', RoomId: 'TestTwo' },
    ]

    it('extends the ladder when entering a child asset layer', () => {
        expect(applyLadderUpdateFromDestinationChain(
            baseStack,
            ['primitives', 'TownCenter', 'draftOne'],
            'TestFour'
        )).toEqual([
            { asset: 'primitives', RoomId: 'VORTEX' },
            { asset: 'TownCenter', RoomId: 'TestTwo' },
            { asset: 'draftOne', RoomId: 'TestFour' },
        ])
    })

    it('rewrites the tail room for a lateral move within the same layer', () => {
        expect(applyLadderUpdateFromDestinationChain(
            baseStack,
            ['primitives', 'TownCenter'],
            'TestThree'
        )).toEqual([
            { asset: 'primitives', RoomId: 'VORTEX' },
            { asset: 'TownCenter', RoomId: 'TestThree' },
        ])
    })

    it('forks to a sibling overlay branch', () => {
        expect(applyLadderUpdateFromDestinationChain(
            [
                { asset: 'primitives', RoomId: 'VORTEX' },
                { asset: 'TownCenter', RoomId: 'Suburbs' },
                { asset: 'draftOne', RoomId: 'Laboratory' },
            ],
            ['primitives', 'TownCenter', 'circusEvent'],
            'BigTop'
        )).toEqual([
            { asset: 'primitives', RoomId: 'VORTEX' },
            { asset: 'TownCenter', RoomId: 'Suburbs' },
            { asset: 'circusEvent', RoomId: 'BigTop' },
        ])
    })

    it('truncates to a shallower destination chain on parent move', () => {
        expect(applyLadderUpdateFromDestinationChain(
            [
                { asset: 'primitives', RoomId: 'VORTEX' },
                { asset: 'TownCenter', RoomId: 'TestTwo' },
                { asset: 'draftOne', RoomId: 'TestFour' },
            ],
            ['primitives'],
            'TestOne'
        )).toEqual([
            { asset: 'primitives', RoomId: 'TestOne' },
        ])
    })
})

describe('circus-style overlay trim', () => {
    it('removes inaccessible overlay rungs and preserves the canon inner presence', () => {
        const overlayStack = [
            { asset: 'primitives', RoomId: 'VORTEX' },
            { asset: 'TownCenter', RoomId: 'Suburbs' },
            { asset: 'circusEvent', RoomId: 'BigTop' },
        ]
        const trimmed = trimRoomStackToAccessibleAssets(overlayStack, ['primitives', 'TownCenter'])
        expect(trimmed).toEqual([
            { asset: 'primitives', RoomId: 'VORTEX' },
            { asset: 'TownCenter', RoomId: 'Suburbs' },
        ])
    })

    it('builds canon chain without the overlay asset', () => {
        expect(buildAssetChainForAsset('TownCenter', ['primitives', 'TownCenter', 'circusEvent']))
            .toEqual(['primitives', 'TownCenter'])
    })
})
