import { computeLexicalMatchMetrics, deriveFlankLengthMetrics } from './lexicalMatchMetrics'

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
