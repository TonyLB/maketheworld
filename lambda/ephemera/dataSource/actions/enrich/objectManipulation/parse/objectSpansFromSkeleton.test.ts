import { objectSpansFromSkeleton } from './objectSpansFromSkeleton'

describe('objectSpansFromSkeleton', () => {
    it('extracts object span text, in order, discarding text tokens and stableRefKey', () => {
        expect(objectSpansFromSkeleton([
            { type: 'text', text: 'put' },
            { type: 'objectSpan', span: 'bag', stableRefKey: 'bagRef' },
            { type: 'text', text: 'in' },
            { type: 'objectSpan', span: 'box', stableRefKey: 'boxRef' },
        ])).toEqual(['bag', 'box'])
    })

    it('returns an empty array for a zero-referent (all-text) skeleton', () => {
        expect(objectSpansFromSkeleton([{ type: 'text', text: 'look' }])).toEqual([])
    })

    it('extracts a single span', () => {
        expect(objectSpansFromSkeleton([
            { type: 'text', text: 'take' },
            { type: 'objectSpan', span: 'broom', stableRefKey: 'broomRef' },
        ])).toEqual(['broom'])
    })
})
