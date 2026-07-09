import { sellersApproximateSubstringMatch } from './sellersApproximateSubstringMatch'

describe('sellersApproximateSubstringMatch', () => {
    it('returns zero distance for exact substring token in candidate text', () => {
        const result = sellersApproximateSubstringMatch('broom', 'the broom')
        expect(result.distance).toBe(0)
        expect(result.matchSpan).toEqual({ start: 4, end: 9 })
        expect(result.leftFlank).toBe('the ')
        expect(result.rightFlank).toBe('')
    })

    it('recovers span and flanks for exact token at end of long name', () => {
        const candidate = 'incredibly ornate jewel-encrusted sword'
        const result = sellersApproximateSubstringMatch('sword', candidate)
        expect(result.distance).toBe(0)
        expect(result.matchSpan.start).toBe(candidate.indexOf('sword'))
        expect(result.matchSpan.end).toBe(candidate.length)
        expect(result.leftFlank).toBe('incredibly ornate jewel-encrusted ')
        expect(result.rightFlank).toBe('')
        expect(candidate.slice(result.matchSpan.start, result.matchSpan.end)).toBe('sword')
    })

    it('uses OSA transposition for swrod vs sword', () => {
        const result = sellersApproximateSubstringMatch('swrod', 'sword')
        expect(result.distance).toBe(1)
        expect(result.matchSpan).toEqual({ start: 0, end: 5 })
        expect(result.leftFlank).toBe('')
        expect(result.rightFlank).toBe('')
    })

    it('finds transposed token inside long candidate with flanks', () => {
        const candidate = 'incredibly ornate jewel-encrusted sword'
        const result = sellersApproximateSubstringMatch('swrod', candidate)
        expect(result.distance).toBe(1)
        expect(candidate.slice(result.matchSpan.start, result.matchSpan.end)).toBe('sword')
        expect(result.leftFlank).toBe('incredibly ornate jewel-encrusted ')
        expect(result.rightFlank).toBe('')
    })

    it('tolerates one edit typo and prefers longest matching span on ties', () => {
        const result = sellersApproximateSubstringMatch('sord', 'rusty sword')
        expect(result.distance).toBe(1)
        // Among equal-distance alignments, prefer the longer span in T.
        expect(result.matchSpan.end - result.matchSpan.start).toBeGreaterThanOrEqual(4)
    })

    it('prefers longer span when multiple alignments share minimum distance', () => {
        const result = sellersApproximateSubstringMatch('ab', 'zzabzzab')
        expect(result.distance).toBe(0)
        expect(result.matchSpan).toEqual({ start: 6, end: 8 })
    })

    it('returns high distance when token does not approximately match', () => {
        const result = sellersApproximateSubstringMatch('broom', 'incredibly ornate anvil')
        expect(result.distance).toBeGreaterThan(2)
    })

    it('handles empty pattern token', () => {
        const result = sellersApproximateSubstringMatch('', 'broom')
        expect(result.distance).toBe(0)
        expect(result.matchSpan).toEqual({ start: 0, end: 0 })
        expect(result.leftFlank).toBe('broom')
        expect(result.rightFlank).toBe('')
    })

    it('handles empty candidate text', () => {
        const result = sellersApproximateSubstringMatch('broom', '')
        expect(result.distance).toBe(5)
        expect(result.matchSpan).toEqual({ start: 0, end: 0 })
        expect(result.leftFlank).toBe('')
        expect(result.rightFlank).toBe('')
    })
})
