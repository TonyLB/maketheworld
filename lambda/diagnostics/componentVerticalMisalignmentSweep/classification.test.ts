import { aggregateMisalignmentStatuses } from './classification'

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
