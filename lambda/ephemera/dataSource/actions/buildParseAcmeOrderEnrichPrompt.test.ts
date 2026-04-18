import { COYOTE_AFFINITY_APTNESS_MIN } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { buildParseAcmeOrderEnrichPrompt } from './buildParseAcmeOrderEnrichPrompt'

describe('buildParseAcmeOrderEnrichPrompt', () => {
    it('includes role vocabulary, anti-RPG guidance, and the aptness floor constant', () => {
        const { invariantPrefix, dynamicSuffix } = buildParseAcmeOrderEnrichPrompt(
            'order rope',
            ['rope']
        )
        expect(invariantPrefix).toContain('entity_modification')
        expect(invariantPrefix).toContain('autonomous_agent')
        expect(invariantPrefix).toContain('skill check')
        expect(invariantPrefix).toContain(String(COYOTE_AFFINITY_APTNESS_MIN))
        expect(invariantPrefix).toContain('strictly below')
        expect(dynamicSuffix).toContain('order rope')
        expect(dynamicSuffix).toContain('1. rope')
    })
})
