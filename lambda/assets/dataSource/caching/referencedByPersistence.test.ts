import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import { buildReferencedByPatchesForAsset } from '@tonylb/mtw-gateways/ts/assets/components/componentData/referencedBy'

describe('referencedByPersistence helpers', () => {
    it('buildReferencedByPatchesForAsset includes edge targets with AREA referrers', () => {
        const fileAsset = new StandardForm(deIndentWML(`
            <Asset uuid=(test)>
                <Area uuid=(region) key=(region)>
                    <Room uuid=(highway) key=(highway) />
                    <Exit uuid=(e1)>
                        <From>ROOM#highway</From>
                        <To>ROOM#outsideRoom</To>
                    </Exit>
                </Area>
                <Room uuid=(outsideRoom) key=(outsideRoom) />
            </Asset>
        `))
        const patches = buildReferencedByPatchesForAsset(fileAsset)
        const entries = [...patches.entries()].filter(([, list]) => list.length > 0)
        expect(entries.length).toBeGreaterThan(0)
        expect(entries.some(([, list]) =>
            list.some((entry) => entry.referrerUniversalKey === 'AREA#region' && entry.referenceType === 'Edge')
        )).toBe(true)
    })
})
