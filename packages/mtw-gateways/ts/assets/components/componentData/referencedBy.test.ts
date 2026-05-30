import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'

import {
    buildReferencedByPatchesForAsset,
    unionReferencedByAcrossParticipation,
} from './referencedBy'

describe('referencedBy persistence helpers', () => {
    it('buildReferencedByPatchesForAsset maps Area edge referrers with Edge referenceType', () => {
        const fileAsset = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <Area uuid=(region) key=(region)>
                    <Room uuid=(highway) key=(highway) />
                    <Exit uuid=(e1)>
                        <From>ROOM#highway</From>
                        <To>ROOM#outsideRoom</To>
                        <Forward>east</Forward>
                        <Back>west</Back>
                    </Exit>
                </Area>
                <Room uuid=(outsideRoom) key=(outsideRoom) />
            </Asset>
        `))

        const patches = buildReferencedByPatchesForAsset(fileAsset)
        const highwayEntries = patches.get('ROOM#highway')
        const outsideEntries = patches.get('ROOM#outsideRoom')

        expect(highwayEntries).toEqual([
            { referrerUniversalKey: 'AREA#region', referenceType: 'Edge' },
        ])
        expect(outsideEntries).toEqual([
            { referrerUniversalKey: 'AREA#region', referenceType: 'Edge' },
        ])
    })

    it('unionReferencedByAcrossParticipation dedupes referrers across assets', () => {
        const union = unionReferencedByAcrossParticipation(
            [
                {
                    AssetId: 'ASSET#base',
                    referencedBy: [{ referrerUniversalKey: 'AREA#a1', referenceType: 'Edge' }],
                },
                {
                    AssetId: 'ASSET#overlay',
                    referencedBy: [
                        { referrerUniversalKey: 'AREA#a1', referenceType: 'Edge' },
                        { referrerUniversalKey: 'AREA#a2', referenceType: 'Edge' },
                    ],
                },
            ],
            ['ASSET#base', 'ASSET#overlay']
        )

        expect(union).toEqual([
            { referrerUniversalKey: 'AREA#a1', referenceType: 'Edge' },
            { referrerUniversalKey: 'AREA#a2', referenceType: 'Edge' },
        ])
    })
})
