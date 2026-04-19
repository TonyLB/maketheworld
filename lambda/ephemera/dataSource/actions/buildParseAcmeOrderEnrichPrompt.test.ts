import { COYOTE_AFFINITY_APTNESS_MIN } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { buildParseAcmeOrderEnrichPrompt } from './buildParseAcmeOrderEnrichPrompt'

describe('buildParseAcmeOrderEnrichPrompt', () => {
    it('requires chain-of-reasoning markdown then fenced json, and retains affinity contract', () => {
        const { invariantPrefix, dynamicSuffix } = buildParseAcmeOrderEnrichPrompt('order rope')
        expect(invariantPrefix).toContain('Chain-of-reason')
        expect(invariantPrefix).toContain('two parts')
        expect(invariantPrefix).toContain('Final JSON')
        expect(invariantPrefix).toContain('language tag **json**')
        expect(invariantPrefix).toContain('entity_modification')
        expect(invariantPrefix).toContain('autonomous_agent')
        expect(invariantPrefix).toContain(String(COYOTE_AFFINITY_APTNESS_MIN))
        expect(invariantPrefix).toContain('strictly below')
        expect(invariantPrefix).not.toContain('skill check')
        expect(dynamicSuffix).toContain('order rope')
        expect(dynamicSuffix).toContain('Player command')
    })
})
