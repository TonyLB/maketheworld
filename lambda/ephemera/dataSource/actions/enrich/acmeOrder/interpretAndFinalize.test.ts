import {
    interpretAcmeOrderEnrichBody,
    finalizeAcmeOrderFromEnrich,
} from './interpretAndFinalize'

describe('interpretAcmeOrderEnrichBody', () => {
    it('accepts valid Acme order enrich JSON', () => {
        const r = interpretAcmeOrderEnrichBody(JSON.stringify({
            lines: [{
                valid: true,
                name: 'A',
                stableKey: 'a',
            }],
        }))
        expect(r.success).toBe(true)
        if (r.success) {
            expect(r.response.lines).toHaveLength(1)
            expect(r.response.lines[0]).toMatchObject({
                valid: true,
                name: 'A',
                stableKey: 'a',
            })
            expect(r.reasoningMarkdown).toBe('')
        }
    })

    it('returns failure on JSON parse error', () => {
        expect(interpretAcmeOrderEnrichBody('{').success).toBe(false)
    })

    it('strips leading chain-of-reasoning and parses trailing fenced json', () => {
        const payload = JSON.stringify({
            lines: [{
                valid: true,
                name: 'Beehive',
                stableKey: 'beehive',
            }],
            confidence: 1,
        })
        const body = `## Item 1
- **Valid**: beehive is catalog-orderable.

\`\`\`json
${payload}
\`\`\``
        const r = interpretAcmeOrderEnrichBody(body)
        expect(r.success).toBe(true)
        if (r.success) {
            expect(r.response.lines).toHaveLength(1)
            expect(r.response.lines[0].valid === true && r.response.lines[0].name).toBe('Beehive')
            expect(r.reasoningMarkdown).toContain('Item 1')
        }
    })

    it('accepts prose plus raw JSON without a trailing fence (brace fallback)', () => {
        const json = '{"lines":[{"valid":true,"name":"X","stableKey":"x"}]}'
        const body = `Notes here.\n\n${json}`
        const r = interpretAcmeOrderEnrichBody(body)
        expect(r.success).toBe(true)
        if (r.success) {
            expect(r.response.lines[0].valid === true && r.response.lines[0].name).toBe('X')
            expect(r.reasoningMarkdown).toBe('Notes here.')
        }
    })

    it('normalizes missing lines array to single synthetic row', () => {
        const r = interpretAcmeOrderEnrichBody(JSON.stringify({ lines: 'bad' }))
        expect(r.success).toBe(true)
        if (r.success) {
            expect(r.response.lines).toHaveLength(1)
            expect(r.response.lines[0]).toMatchObject({
                valid: true,
                stableKey: 'order',
                tropeAffinities: [],
                tropeAffinitiesFailed: true,
            })
            expect(r.reasoningMarkdown).toBe('')
        }
    })

    it('per-line: good line plus garbage yields salvage failure for second slot', () => {
        const r = interpretAcmeOrderEnrichBody(
            JSON.stringify({
                lines: [
                    {
                        valid: true,
                        name: 'Good',
                        stableKey: 'good',
                    },
                    { notValid: true },
                ],
            })
        )
        expect(r.success).toBe(true)
        if (r.success) {
            expect(r.response.lines[0].valid === true ? r.response.lines[0].name : '').toBe('Good')
            expect(r.response.lines[1]).toMatchObject({
                valid: true,
                name: 'line2',
                stableKey: 'line2',
                tropeAffinities: [],
                tropeAffinitiesFailed: true,
            })
            expect(r.reasoningMarkdown).toBe('')
        }
    })

})

describe('finalizeAcmeOrderFromEnrich', () => {
    const intentConf = 0.8

    it('maps enrich lines to parse orders', () => {
        const merged = finalizeAcmeOrderFromEnrich(
            intentConf,
            {
                lines: [
                    {
                        valid: true,
                        name: 'rope line',
                        stableKey: 'rope-line',
                    },
                    {
                        valid: false,
                        name: 'moon',
                        errorType: 'Not a thing',
                    },
                ],
                confidence: 0.5,
            },
            false,
            'fallback'
        )
        expect(merged.orders[0]).toMatchObject({
            valid: true,
            name: 'rope line',
            stableKey: 'rope-line',
            tropeAffinities: [],
            tropeAffinitiesFailed: true,
        })
        expect(merged.orders[1]).toMatchObject({
            valid: false,
            name: 'moon',
            errorType: 'Not a thing',
        })
        expect(merged.confidence).toBeCloseTo(intentConf * 0.5)
    })

    it('threads defaultSituation prose through to the parse order, and marks defaultSituationFailed absent', () => {
        const merged = finalizeAcmeOrderFromEnrich(
            intentConf,
            {
                lines: [
                    {
                        valid: true,
                        name: 'anvil',
                        stableKey: 'anvil',
                        defaultSituation: { description: 'A cast-iron anvil sits here.' },
                    },
                    {
                        valid: true,
                        name: 'glue',
                        stableKey: 'glue',
                    },
                ],
            },
            false,
            'fallback'
        )
        expect(merged.orders[0]).toMatchObject({
            valid: true,
            name: 'anvil',
            defaultSituation: { description: 'A cast-iron anvil sits here.' },
            defaultSituationFailed: false,
        })
        expect(merged.orders[1]).toMatchObject({
            valid: true,
            name: 'glue',
            defaultSituationFailed: true,
        })
        expect((merged.orders[1] as { defaultSituation?: unknown }).defaultSituation).toBeUndefined()
    })

    it('single synthetic failure when enrichInvokeFailed', () => {
        const merged = finalizeAcmeOrderFromEnrich(intentConf, null, true, 'order rope')
        expect(merged.orders).toHaveLength(1)
        expect(merged.orders[0]).toMatchObject({
            valid: true,
            name: 'order rope',
            stableKey: 'order-rope',
            tropeAffinities: [],
            tropeAffinitiesFailed: true,
        })
        expect(merged.confidence).toBe(intentConf)
    })

    it('after interpret, merges good plus salvaged rows', () => {
        const parsed = interpretAcmeOrderEnrichBody(
            JSON.stringify({
                confidence: 0.9,
                lines: [
                    {
                        valid: true,
                        name: 'dyn',
                        stableKey: 'dyn',
                    },
                    null,
                ],
            })
        )
        expect(parsed.success).toBe(true)
        if (!parsed.success) {
            return
        }
        const merged = finalizeAcmeOrderFromEnrich(0.82, parsed.response, false, 'x')
        expect(merged.orders[0]).toMatchObject({
            valid: true,
            name: 'dyn',
            stableKey: 'dyn',
            tropeAffinities: [],
            tropeAffinitiesFailed: true,
        })
        expect(merged.orders[1]).toMatchObject({ valid: true, tropeAffinitiesFailed: true })
        expect(merged.confidence).toBeCloseTo(0.82 * 0.9)
    })

    it('merges multi-role enrich lines in index order', () => {
        const merged = finalizeAcmeOrderFromEnrich(
            0.85,
            {
                lines: [
                    {
                        valid: true,
                        name: 'Beehive',
                        stableKey: 'beehive',
                    },
                    {
                        valid: true,
                        name: 'Entrenching Shovel',
                        stableKey: 'entrenching-shovel',
                    },
                    {
                        valid: true,
                        name: 'Climbing Rope',
                        stableKey: 'climbing-rope',
                    },
                ],
                confidence: 0.9,
            },
            false,
            'cmd'
        )
        expect(merged.orders[0]?.name).toBe('Beehive')
        expect(merged.orders[2]?.name).toBe('Climbing Rope')
        expect(merged.orders[0]).toMatchObject({ stableKey: 'beehive' })
        expect(merged.orders[1]).toMatchObject({ stableKey: 'entrenching-shovel' })
        expect(merged.orders[2]).toMatchObject({ stableKey: 'climbing-rope' })
        expect(merged.confidence).toBeCloseTo(0.85 * 0.9)
    })
})
