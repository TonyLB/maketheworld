import { COYOTE_AFFINITY_APTNESS_MIN } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { buildParseAcmeOrderEnrichPrompt } from './buildParseAcmeOrderEnrichPrompt'

describe('buildParseAcmeOrderEnrichPrompt', () => {
    it('requires chain-of-reasoning markdown then fenced json, and retains affinity contract', () => {
        const { invariantPrefix, dynamicSuffix } = buildParseAcmeOrderEnrichPrompt('order rope')
        expect(invariantPrefix).toContain('Classify order type')
        expect(invariantPrefix).toContain('two steps with different rules')
        expect(invariantPrefix).toContain('Enhance (JSON final)')
        expect(invariantPrefix).toContain('Correctable user error')
        expect(invariantPrefix).toContain('Cartoon physics')
        expect(invariantPrefix.indexOf('Correctable user error')).toBeLessThan(invariantPrefix.indexOf('Cartoon physics modifier'))
        expect(invariantPrefix.indexOf('Cartoon physics modifier')).toBeLessThan(invariantPrefix.indexOf('Primary category'))
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
