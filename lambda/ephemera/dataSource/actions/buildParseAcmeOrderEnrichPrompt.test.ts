import { COYOTE_AFFINITY_APTNESS_MIN } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { buildParseAcmeOrderEnrichPrompt } from './buildParseAcmeOrderEnrichPrompt'

describe('buildParseAcmeOrderEnrichPrompt', () => {
    it.skip('includes role vocabulary, anti-RPG guidance, and the aptness floor constant', () => {
        const { invariantPrefix, dynamicSuffix } = buildParseAcmeOrderEnrichPrompt(
            'order rope'
        )
        expect(invariantPrefix).toContain('entity_modification')
        expect(invariantPrefix).toContain('autonomous_agent')
        expect(invariantPrefix).toContain('skill check')
        expect(invariantPrefix).toContain(String(COYOTE_AFFINITY_APTNESS_MIN))
        expect(invariantPrefix).toContain('strictly below')
        expect(invariantPrefix).not.toContain('description')
        expect(dynamicSuffix).toContain('order rope')
        expect(dynamicSuffix).toContain('Player command')
    })
})
