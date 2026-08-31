import { normalizeRelationSpan } from './normalizeRelationSpan'

describe('normalizeRelationSpan', () => {
    it.each([
        ['under', 'Under'],
        ['beneath', 'Under'],
        ['underneath', 'Under'],
    ] as const)('maps %s to enum %s', (relationSpan, kind) => {
        expect(normalizeRelationSpan(relationSpan)).toEqual({
            type: 'success',
            relation: { type: 'enum', kind },
        })
    })

    it.each([
        ['against', 'Against'],
        ['leaning against', 'Against'],
        ['lean against', 'Against'],
    ] as const)('maps %s to enum %s', (relationSpan, kind) => {
        expect(normalizeRelationSpan(relationSpan)).toEqual({
            type: 'success',
            relation: { type: 'enum', kind },
        })
    })

    it.each([
        'around',
        'tied to',
        'wrapped around',
        'over',
        'beside',
    ] as const)('maps %s to Custom with trimmed label', (relationSpan) => {
        expect(normalizeRelationSpan(relationSpan)).toEqual({
            type: 'success',
            relation: {
                type: 'custom',
                kind: 'Custom',
                relationLabel: relationSpan,
            },
        })
    })

    it.each(['in', 'inside', 'into'] as const)('defers containment span %s', (relationSpan) => {
        expect(normalizeRelationSpan(relationSpan)).toEqual({ type: 'nestingDefer' })
    })

    it.each(['on', 'onto', 'ON', 'on top of'] as const)('defers hosting span %s (Channel D CD2: On joins In/PartOf)', (relationSpan) => {
        expect(normalizeRelationSpan(relationSpan)).toEqual({ type: 'nestingDefer' })
    })

    it('preserves trimmed player phrase for Custom labels', () => {
        expect(normalizeRelationSpan('  tied to  ')).toEqual({
            type: 'success',
            relation: {
                type: 'custom',
                kind: 'Custom',
                relationLabel: 'tied to',
            },
        })
    })
})
