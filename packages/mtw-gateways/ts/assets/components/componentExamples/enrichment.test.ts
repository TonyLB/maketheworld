import StandardSituation from '@tonylb/mtw-wml/ts/standardize/components/situation'
import { StandardLens } from '@tonylb/mtw-wml/ts/standardize/components/worldState'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import { getLensMarksWithDefaults } from '@tonylb/mtw-wml/ts/standardize/worldState/lensMarks'

import { situationFacetToCacheShape } from './enrichment'

describe('situationFacetToCacheShape with lens marks', () => {
    it('should scope to lens marks and apply defaults', () => {
        const lens = new StandardLens(deIndentWML(`
            <Lens key=(illumination) uuid=(LENS#lens1)>
                <Mark key=(illumination) uuid=(MARK#illumination)>
                    <Default>lighted</Default>
                </Mark>
                <Mark key=(timeofday) uuid=(MARK#timeofday)>
                    <Default>Afternoon</Default>
                </Mark>
            </Lens>
        `))
        const lensMarks = getLensMarksWithDefaults(lens)

        const situation = new StandardSituation(deIndentWML(`
            <Situation key=(s1) uuid=(SITUATION#s1)>
                <Mark key=(illumination) uuid=(MARK#illumination)>
                    <Match>dim</Match>
                </Mark>
                <Mark key=(extraneous) uuid=(MARK#other)>
                    <Match>ignored</Match>
                </Mark>
            </Situation>
        `))

        const payload = situationFacetToCacheShape(situation, {} as Parameters<typeof situationFacetToCacheShape>[1], {
            lensMarks,
        })

        expect(payload.markState.markValue).toEqual([
            { mark: 'MARK#illumination', value: 'dim' },
            { mark: 'MARK#timeofday', value: 'Afternoon' },
        ])
    })

    it('should emit no marks when lensMarks is empty even if situation has marks', () => {
        const situation = new StandardSituation(deIndentWML(`
            <Situation key=(s1) uuid=(SITUATION#s1)>
                <Mark key=(illumination) uuid=(MARK#illumination)>
                    <Match>dim</Match>
                </Mark>
            </Situation>
        `))

        const payload = situationFacetToCacheShape(situation, {} as Parameters<typeof situationFacetToCacheShape>[1], {
            lensMarks: [],
        })

        expect(payload.markState.markValue).toEqual([])
    })

    it('should preserve existing behavior when lensMarks is undefined', () => {
        const situation = new StandardSituation(deIndentWML(`
            <Situation key=(s1) uuid=(SITUATION#s1)>
                <Mark key=(illumination) uuid=(MARK#illumination)>
                    <Match>dim</Match>
                </Mark>
            </Situation>
        `))

        const payload = situationFacetToCacheShape(situation, {} as Parameters<typeof situationFacetToCacheShape>[1])

        expect(payload.markState.markValue).toEqual([
            { mark: 'MARK#illumination', value: 'dim' },
        ])
    })
})
