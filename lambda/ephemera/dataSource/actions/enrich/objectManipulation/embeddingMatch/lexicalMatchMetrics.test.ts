import {
    computeLexicalMatchMetrics,
    deriveFlankLengthMetrics,
    editDistanceRelevance,
    flankLengthRelevance,
    lexicalRelevanceFromMetrics,
} from './lexicalMatchMetrics'

describe('deriveFlankLengthMetrics', () => {
    it('returns zero adjoined lengths when match is separated by whitespace', () => {
        const text = 'rusty ax'
        const metrics = deriveFlankLengthMetrics(text, { start: 6, end: 8 })
        expect(metrics.adjoinedLeftLength).toBe(0)
        expect(metrics.remoteLeftLength).toBe(6)
        expect(metrics.adjoinedRightLength).toBe(0)
        expect(metrics.remoteRightLength).toBe(0)
    })

    it('counts alpha-adjoined right flank for axle matching ax', () => {
        const text = 'axle'
        const metrics = deriveFlankLengthMetrics(text, { start: 0, end: 2 })
        expect(metrics.adjoinedLeftLength).toBe(0)
        expect(metrics.remoteLeftLength).toBe(0)
        expect(metrics.adjoinedRightLength).toBe(2)
        expect(metrics.remoteRightLength).toBe(0)
    })

    it('treats long whitespace-separated prefix as remote left only', () => {
        const text = 'incredibly ornate jewel-encrusted sword'
        const start = text.indexOf('sword')
        const metrics = deriveFlankLengthMetrics(text, { start, end: text.length })
        expect(metrics.adjoinedLeftLength).toBe(0)
        expect(metrics.remoteLeftLength).toBe(start)
        expect(metrics.adjoinedRightLength).toBe(0)
        expect(metrics.remoteRightLength).toBe(0)
    })

    it('does not adjoin across hyphen when match starts after compound prefix', () => {
        const text = 'jewel-encrusted sword'
        const start = text.indexOf('encrusted sword')
        const metrics = deriveFlankLengthMetrics(text, { start, end: text.length })
        expect(metrics.adjoinedLeftLength).toBe(0)
        expect(metrics.remoteLeftLength).toBe(start)
        expect(text.slice(0, metrics.remoteLeftLength)).toBe('jewel-')
    })

    it('partitions left flank into adjoined suffix and remote prefix', () => {
        const text = 'rustyaxe'
        const metrics = deriveFlankLengthMetrics(text, { start: 5, end: 7 })
        expect(metrics.adjoinedLeftLength).toBe(5)
        expect(metrics.remoteLeftLength).toBe(0)
        expect(text.slice(metrics.remoteLeftLength, metrics.adjoinedLeftLength)).toBe('rusty')
    })
})

describe('computeLexicalMatchMetrics', () => {
    it('returns edit distance and flank length metrics together', () => {
        const candidate = 'incredibly ornate jewel-encrusted sword'
        const metrics = computeLexicalMatchMetrics('swrod', candidate)
        expect(metrics.editDistance).toBe(1)
        expect(candidate.slice(metrics.matchSpan.start, metrics.matchSpan.end)).toBe('sword')
        expect(metrics.adjoinedLeftLength).toBe(0)
        expect(metrics.remoteLeftLength).toBe(metrics.matchSpan.start)
        expect(metrics.adjoinedRightLength).toBe(0)
        expect(metrics.remoteRightLength).toBe(0)
    })

    it('reports zero edit distance with remote wrapper for exact suffix match', () => {
        const candidate = 'the broom'
        const metrics = computeLexicalMatchMetrics('broom', candidate)
        expect(metrics.editDistance).toBe(0)
        expect(metrics.adjoinedLeftLength).toBe(0)
        expect(metrics.remoteLeftLength).toBe(4)
        expect(metrics.adjoinedRightLength).toBe(0)
        expect(metrics.remoteRightLength).toBe(0)
    })

    it('reports adjoined morphology on axle vs ax', () => {
        const metrics = computeLexicalMatchMetrics('ax', 'axle')
        expect(metrics.editDistance).toBe(0)
        expect(metrics.adjoinedRightLength).toBe(2)
        expect(metrics.remoteRightLength).toBe(0)
    })
})

describe('flankLengthRelevance', () => {
    const maxDamage = 0.25
    const k = 1

    it('returns 1 at zero flank length', () => {
        expect(flankLengthRelevance(0, 5, maxDamage, k)).toBe(1)
    })

    it('approaches 1 - maxDamage as flank length grows relative to span', () => {
        expect(flankLengthRelevance(50, 5, maxDamage, k)).toBeCloseTo(1 - maxDamage, 3)
    })

    it('decays faster with larger k', () => {
        const slow = flankLengthRelevance(5, 5, maxDamage, 0.5)
        const fast = flankLengthRelevance(5, 5, maxDamage, 2)
        expect(fast).toBeLessThan(slow)
    })

    it('scales flank length by match span length', () => {
        const oneSpan = flankLengthRelevance(5, 5, maxDamage, k)
        const twoSpansSameRatio = flankLengthRelevance(10, 10, maxDamage, k)
        expect(oneSpan).toBeCloseTo(twoSpansSameRatio)
    })

    it('rejects non-finite or negative flank length', () => {
        expect(() => flankLengthRelevance(-1, 5, maxDamage, k)).toThrow(/flankLength/)
        expect(() => flankLengthRelevance(Number.NaN, 5, maxDamage, k)).toThrow(/flankLength/)
    })

    it('rejects match span length below 1', () => {
        expect(() => flankLengthRelevance(0, 0, maxDamage, k)).toThrow(/matchSpanLength/)
        expect(() => flankLengthRelevance(0, 0.5, maxDamage, k)).toThrow(/matchSpanLength/)
    })

    it('rejects maxDamage outside (0, 1)', () => {
        expect(() => flankLengthRelevance(0, 5, 0, k)).toThrow(/maxDamage/)
        expect(() => flankLengthRelevance(0, 5, 1, k)).toThrow(/maxDamage/)
        expect(() => flankLengthRelevance(0, 5, 1.5, k)).toThrow(/maxDamage/)
        expect(() => flankLengthRelevance(0, 5, -0.1, k)).toThrow(/maxDamage/)
    })

    it('rejects non-positive k', () => {
        expect(() => flankLengthRelevance(0, 5, maxDamage, 0)).toThrow(/\bk\b/)
        expect(() => flankLengthRelevance(0, 5, maxDamage, -1)).toThrow(/\bk\b/)
    })
})

describe('editDistanceRelevance', () => {
    it('returns 1 for zero edit distance', () => {
        expect(editDistanceRelevance(0, 5, 4)).toBe(1)
    })

    it('returns 0 when edit distance reaches the max of span and pattern length', () => {
        expect(editDistanceRelevance(5, 5, 3)).toBe(0)
        expect(editDistanceRelevance(4, 3, 4)).toBe(0)
    })

    it('linearly interpolates between zero edits and the veto threshold', () => {
        expect(editDistanceRelevance(1, 5, 5)).toBeCloseTo(0.8)
    })

    it('returns 0 when both span and pattern length are zero', () => {
        expect(editDistanceRelevance(0, 0, 0)).toBe(0)
    })
})

describe('lexicalRelevanceFromMetrics', () => {
    it('documents sellers alignment for paraphrase (calibration-owned separation)', () => {
        const metrics = computeLexicalMatchMetrics('broom', 'sweeping tool')
        const score = lexicalRelevanceFromMetrics(metrics, 5, 'sweeping tool'.length)
        expect(score).toBeLessThan(0.4)
        expect(metrics.editDistance).toBeGreaterThan(0)
    })

    it('combines edit gate with tanh flank score for axle vs ax', () => {
        const metrics = computeLexicalMatchMetrics('ax', 'axle')
        const score = lexicalRelevanceFromMetrics(metrics, 2, 'axle'.length)
        const editFactor = editDistanceRelevance(metrics.editDistance, 2, 2)
        expect(score).toBeLessThanOrEqual(editFactor)
        expect(score).toBeGreaterThan(0)
    })
})
