import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import {
    applyLadderUpdateFromDestinationChain,
    buildAssetChainForAsset,
    buildProposedRoomStackForNavigate,
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

describe('buildProposedRoomStackForNavigate', () => {
    const baseStack = [
        { asset: 'primitives', RoomId: 'VORTEX' },
        { asset: 'TownCenter', RoomId: 'TestTwo' },
    ]

    it('extends the ladder for a child asset navigate', () => {
        const result = buildProposedRoomStackForNavigate({
            targetRoomId: 'ROOM#TestFour' as EphemeraRoomId,
            currentRoomStack: baseStack,
            characterAssets,
            roomAssets: ['ASSET#draftOne'],
            canonAssets,
        })

        expect(result).toEqual([
            { asset: 'primitives', RoomId: 'VORTEX' },
            { asset: 'TownCenter', RoomId: 'TestTwo' },
            { asset: 'draftOne', RoomId: 'TestFour' },
        ])
        expect(result.every((frame) => frame.timeWritten === undefined)).toBe(true)
    })

    it('rewrites the tail for a lateral move within the same layer', () => {
        const result = buildProposedRoomStackForNavigate({
            targetRoomId: 'ROOM#TestThree' as EphemeraRoomId,
            currentRoomStack: baseStack,
            characterAssets,
            roomAssets: ['ASSET#TownCenter'],
            canonAssets,
        })

        expect(result).toEqual([
            { asset: 'primitives', RoomId: 'VORTEX' },
            { asset: 'TownCenter', RoomId: 'TestThree' },
        ])
        expect(result.every((frame) => frame.timeWritten === undefined)).toBe(true)
    })

    it('forks to a sibling overlay branch', () => {
        const currentRoomStack = [
            { asset: 'primitives', RoomId: 'VORTEX' },
            { asset: 'TownCenter', RoomId: 'Suburbs' },
            { asset: 'draftOne', RoomId: 'Laboratory' },
        ]
        const result = buildProposedRoomStackForNavigate({
            targetRoomId: 'ROOM#BigTop' as EphemeraRoomId,
            currentRoomStack,
            characterAssets,
            roomAssets: ['ASSET#circusEvent'],
            canonAssets,
        })

        expect(result).toEqual([
            { asset: 'primitives', RoomId: 'VORTEX' },
            { asset: 'TownCenter', RoomId: 'Suburbs' },
            { asset: 'draftOne', RoomId: 'Laboratory' },
            { asset: 'circusEvent', RoomId: 'BigTop' },
        ])
        expect(result.every((frame) => frame.timeWritten === undefined)).toBe(true)
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
