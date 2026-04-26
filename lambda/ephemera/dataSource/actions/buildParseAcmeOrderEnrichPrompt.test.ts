import { COYOTE_AFFINITY_APTNESS_MIN } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { buildParseAcmeOrderEnrichPrompt } from './buildParseAcmeOrderEnrichPrompt'

describe('buildParseAcmeOrderEnrichPrompt', () => {
    it('requires chain-of-reasoning markdown then fenced json, and retains affinity contract', () => {
        const { invariantPrefix, dynamicSuffix } = buildParseAcmeOrderEnrichPrompt('order rope')
        const flatTags = [
            'influence-road-runner',
            'alter-road-runner',
            'coyote-equipment',
            'coyote-enhancement',
            'setting-addition',
            'connect-props',
            'enhance-prop',
        ]
        expect(invariantPrefix).toContain('Classify order type')
        expect(invariantPrefix).toContain('two steps with different rules')
        expect(invariantPrefix).toContain('Enhance (JSON final)')
        expect(invariantPrefix).toContain('Correctable user error')
        expect(invariantPrefix).toContain('Cartoon physics')
        expect(invariantPrefix.indexOf('Correctable user error')).toBeLessThan(invariantPrefix.indexOf('Cartoon physics modifier'))
        expect(invariantPrefix.indexOf('Cartoon physics modifier')).toBeLessThan(invariantPrefix.indexOf('Primary category'))
        expect(invariantPrefix).toContain('language tag **json**')
        for (const tag of flatTags) {
            expect(invariantPrefix).toContain(tag)
        }
        expect(invariantPrefix).toContain('autonomous_agent')
        expect(invariantPrefix).toContain('Do not emit legacy tuple fields like **`target`** or **`mode`**')
        expect(invariantPrefix).toContain('### Generative roles')
        expect(invariantPrefix).toContain('### Structural roles')
        expect(invariantPrefix).toContain(String(COYOTE_AFFINITY_APTNESS_MIN))
        expect(invariantPrefix).toContain('strictly below')
        expect(invariantPrefix).not.toContain('skill check')
        expect(invariantPrefix).toContain('stableKey')
        expect(invariantPrefix).toContain('constructed-')
        expect(invariantPrefix).toContain('Ignore the command verb itself')
        expect(invariantPrefix).toContain('order glue and springs')
        expect(invariantPrefix).toContain('exactly two lines')
        expect(dynamicSuffix).toContain('order rope')
        expect(dynamicSuffix).toContain('Player command')
        expect(dynamicSuffix).toContain('Coyote-wide stable keys already in use')
        expect(dynamicSuffix).toContain('(none)')
    })

    it('lists occupied stable keys in dynamicSuffix after dedupe and sort', () => {
        const { dynamicSuffix } = buildParseAcmeOrderEnrichPrompt('buy widget', {
            occupiedStableKeys: ['zebra', 'alpha', 'alpha', 'beta'],
        })
        expect(dynamicSuffix).toContain('- alpha')
        expect(dynamicSuffix).toContain('- beta')
        expect(dynamicSuffix).toContain('- zebra')
        expect(dynamicSuffix.indexOf('- alpha')).toBeLessThan(dynamicSuffix.indexOf('- beta'))
        expect(dynamicSuffix.indexOf('- beta')).toBeLessThan(dynamicSuffix.indexOf('- zebra'))
    })
})
