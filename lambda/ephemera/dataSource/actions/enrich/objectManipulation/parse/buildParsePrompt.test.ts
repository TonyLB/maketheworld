import { buildParsePrompt } from './buildParsePrompt'

describe('buildParsePrompt', () => {
    it('includes the token schema, forbidden fields, and command in the prompt parts', () => {
        const parts = buildParsePrompt({ command: 'put the bag in the box' })

        expect(parts.invariantPrefix).toContain('objectSpan')
        expect(parts.invariantPrefix).toContain('"text"')
        expect(parts.invariantPrefix).toContain('Forbidden fields')
        expect(parts.invariantPrefix).toContain('verbClass')
        expect(parts.invariantPrefix).toContain('preposition')
        expect(parts.invariantPrefix).toContain('descriptive modifier')
        expect(parts.invariantPrefix).toContain('"big bag"')
        expect(parts.invariantPrefix).toContain('"red table"')
        expect(parts.dynamicSuffix).toContain('put the bag in the box')
    })
})
