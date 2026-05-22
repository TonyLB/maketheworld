import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import { mergeAuthoritativeAcrossParticipationOrder } from '../aggregate/assemble'
import { aggregatePerspectiveExplicit } from '../aggregate/input'

import {
    buildDependentsPerspectives,
    collectLensUniversalKeyFromMergedRoom,
    collectSituationIdsFromMergedHost,
} from './perspectives'

describe('merged-host perspective helpers', () => {
    const assetA = 'ASSET#a1' as const
    const assetB = 'ASSET#b2' as const
    const roomU = 'ROOM#r1' as const

    it('collectSituationIdsFromMergedHost returns facet situation ids', () => {
        const baseRoom = new StandardRoom(
            deIndentWML(`
            <Room key=(one) uuid=(ROOM#r1)>
                <Situation key=(base) uuid=(SITUATION#base) />
            </Room>
        `)
        )
        const overrideRoom = new StandardRoom(
            deIndentWML(`
            <Room key=(one) uuid=(ROOM#r1)>
                <Situation key=(override) uuid=(SITUATION#override) />
            </Room>
        `)
        )
        const merged = mergeAuthoritativeAcrossParticipationOrder(
            aggregatePerspectiveExplicit({
                universalKey: roomU,
                mergeParticipationOrder: [assetA, assetB],
            }),
            {
                ComponentId: roomU,
                byAssets: [
                    { AssetId: assetA, component: baseRoom },
                    { AssetId: assetB, component: overrideRoom },
                ],
            }
        ) as StandardRoom

        expect(collectSituationIdsFromMergedHost(merged)).toEqual(
            expect.arrayContaining(['SITUATION#base', 'SITUATION#override'])
        )
    })

    it('collectLensUniversalKeyFromMergedRoom reads lens ref from merged room', () => {
        const room = new StandardRoom(
            deIndentWML(`
            <Room key=(one) uuid=(ROOM#r1)>
                <Lens key=(lens) uuid=(LENS#lens1) />
            </Room>
        `)
        )
        expect(collectLensUniversalKeyFromMergedRoom(room)).toBe('LENS#lens1')
    })

    it('buildDependentsPerspectives omits host and includes lens when provided', () => {
        const perspectives = buildDependentsPerspectives({
            situationIds: ['SITUATION#a', 'SITUATION#b'],
            lensId: 'LENS#lens1' as const,
            mergeParticipationOrder: [assetA],
        })
        expect(perspectives.map((p) => p.universalKey)).toEqual([
            'SITUATION#a',
            'SITUATION#b',
            'LENS#lens1',
        ])
        expect(perspectives.map((p) => p.universalKey)).not.toContain(roomU)
    })
})
