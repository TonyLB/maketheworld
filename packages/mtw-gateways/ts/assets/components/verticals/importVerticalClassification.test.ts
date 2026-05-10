import { aggregateMisalignmentStatuses, classifyImportVerticalSets } from './importVerticalClassification'

describe('classifyImportVerticalSets', () => {
    it('returns aligned when sets match', () => {
        const s = new Set(['Meta::Import::parentA::childB'])
        expect(classifyImportVerticalSets(s, s)).toBe('aligned')
    })

    it('returns missing when expected row absent', () => {
        expect(classifyImportVerticalSets(new Set(['Meta::Import::a::b']), new Set())).toBe('missing')
    })

    it('returns orphan when extra index row', () => {
        expect(classifyImportVerticalSets(new Set(), new Set(['Meta::Import::a::b']))).toBe('orphan')
    })

    it('returns stale when both missing and orphan hops', () => {
        expect(classifyImportVerticalSets(new Set(['Meta::Import::p1::c']), new Set(['Meta::Import::p2::c']))).toBe(
            'stale'
        )
    })
})

describe('aggregateMisalignmentStatuses', () => {
    it('returns null when all aligned', () => {
        expect(aggregateMisalignmentStatuses(['aligned', 'aligned'])).toBeNull()
    })

    it('prefers stale over orphan over missing', () => {
        expect(aggregateMisalignmentStatuses(['aligned', 'missing', 'orphan', 'stale'])).toBe('stale')
        expect(aggregateMisalignmentStatuses(['aligned', 'missing', 'orphan'])).toBe('orphan')
        expect(aggregateMisalignmentStatuses(['aligned', 'missing'])).toBe('missing')
    })
})
