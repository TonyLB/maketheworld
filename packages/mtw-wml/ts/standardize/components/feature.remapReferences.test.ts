import { extractFromEditableData } from '@tonylb/mtw-base/ts/editable'
import { schemaToWML } from '../../schema'
import { StandardForm } from '..'
import type { StandardFacetData } from '../keys/facets/dataTypes/facet'
import type { SituationProseFacetPayloadType } from '../keys/facets/situationRoom'
import StandardFeature from './feature'

jest.mock('@tonylb/mtw-utilities/ts/uuid/index', () => {
    return {
        ...jest.requireActual('@tonylb/mtw-utilities/ts/uuid/___mocks___/index')
    }
})

describe('Feature and StandardForm remapReferences (stored data)', () => {
    it('should remap situation facet prose links to universal in Feature.toJSON path', () => {
        const form = new StandardForm(`
            <Asset uuid=(Test)>
                <Feature uuid=(feature1) key=(featOne)>
                    <Situation uuid=(base1)>
                        <Description><Link to=(featOne)>self</Link></Description>
                    </Situation>
                </Feature>
            </Asset>
        `)
        const feature = form.byUniversalId['FEATURE#feature1']
        expect(feature).toBeDefined()
        expect(feature).toBeInstanceOf(StandardFeature)
        const mappings = form._components.map((c) => c.reference)
        const remapped = (feature as StandardFeature).withMapping(mappings).remapReferences('universal')
        const situation = (remapped as StandardFeature).situations.items[0]
        const descSchema = situation.payload._description?.schema
        expect(descSchema).toBeDefined()
        expect(schemaToWML(descSchema!)).toEqual('<Link to=(FEATURE#feature1)>self</Link>')
    })

    it('should remap situation prose links to universal via StandardForm.toJSON', () => {
        const form = new StandardForm(`
            <Asset uuid=(Test)>
                <Feature uuid=(feature1) key=(featOne)>
                    <Situation uuid=(base1)>
                        <Description><Link to=(featOne)>link</Link></Description>
                    </Situation>
                </Feature>
            </Asset>
        `)
        const json = form.toJSON()
        const featureData = json.components.find((c) => c.universalKey === 'FEATURE#feature1')
        expect(featureData).toBeDefined()
        expect(featureData?.tag).toBe('Feature')
        if (featureData?.tag === 'Feature' && featureData.situations?.length) {
            const facetRows = featureData.situations.flatMap(
                extractFromEditableData<StandardFacetData<SituationProseFacetPayloadType>>
            )
            const payloadRows = extractFromEditableData<SituationProseFacetPayloadType>(facetRows[0].payload)
            const payload = payloadRows[0]
            expect(payload?.description).toBeDefined()
            const descStr = JSON.stringify(payload?.description)
            expect(descStr).toContain('FEATURE#feature1')
            expect(descStr).not.toMatch(/"to":"featOne"/)
        }
    })

})
