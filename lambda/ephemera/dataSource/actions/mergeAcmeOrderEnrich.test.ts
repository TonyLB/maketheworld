import {
    interpretAcmeOrderEnrichBody,
    mergeAcmeOrderWithEnrich,
} from './mergeAcmeOrderEnrich'

const ctx1 = { slotCount: 1, fallbackNames: ['fallback'] }

describe('interpretAcmeOrderEnrichBody', () => {
    it('accepts valid enrich JSON', () => {
        const r = interpretAcmeOrderEnrichBody(JSON.stringify({
            lines: [{ name: 'A', description: 'd', affinities: [{ role: 'terminal', aptness: 0.5 }] }],
        }), ctx1)
        expect(r.success).toBe(true)
        if (r.success) {
            expect(r.response.lines).toHaveLength(1)
            expect(r.response.lines[0].name).toBe('A')
        }
    })

    it('returns failure on JSON parse error', () => {
        expect(interpretAcmeOrderEnrichBody('{', ctx1).success).toBe(false)
    })

    it('recovers when lines is not an array by normalizing empty slots', () => {
        const r = interpretAcmeOrderEnrichBody(JSON.stringify({ lines: 'bad' }), ctx1)
        expect(r.success).toBe(true)
        if (r.success) {
            expect(r.response.lines[0]).toMatchObject({
                name: 'fallback',
                description: '',
                affinities: [],
                affinitiesFailed: true,
            })
        }
    })

    it('per-line: one valid line and one garbage entry still succeeds', () => {
        const r = interpretAcmeOrderEnrichBody(
            JSON.stringify({
                lines: [
                    { name: 'Good', description: 'd', affinities: [{ role: 'terminal', aptness: 0.3 }] },
                    { notValid: true },
                ],
            }),
            { slotCount: 2, fallbackNames: ['stepA1', 'stepA2'] }
        )
        expect(r.success).toBe(true)
        if (r.success) {
            expect(r.response.lines[0].name).toBe('Good')
            expect(r.response.lines[1]).toMatchObject({
                name: 'stepA2',
                description: '',
                affinities: [],
                affinitiesFailed: true,
            })
        }
    })

    it('fails when slotCount exceeds max lines', () => {
        const names = Array.from({ length: 51 }, (_, i) => `n${i}`)
        const r = interpretAcmeOrderEnrichBody('{}', { slotCount: 51, fallbackNames: names })
        expect(r.success).toBe(false)
    })
})

describe('mergeAcmeOrderWithEnrich', () => {
    const stepA = {
        type: 'AcmeOrder' as const,
        orders: [
            { valid: true, name: 'rope', description: '', affinities: [] },
            {
                valid: false,
                name: 'moon',
                errorType: 'Not a thing' as const,
                description: '',
                affinities: [],
            },
        ],
        confidence: 0.8,
    }

    const stepATwoValid = {
        type: 'AcmeOrder' as const,
        orders: [
            { valid: true, name: 'dynamite', description: '', affinities: [] },
            { valid: true, name: 'spring', description: '', affinities: [] },
        ],
        confidence: 0.82,
    }

    it('maps enrich lines only to valid rows by order', () => {
        const merged = mergeAcmeOrderWithEnrich(
            stepA,
            {
                lines: [
                    {
                        name: 'rope line',
                        description: 'Cord.',
                        affinities: [{ role: 'delivery', aptness: 0.6 }],
                    },
                ],
                confidence: 0.5,
            },
            false
        )
        expect(merged.orders[0]).toMatchObject({
            valid: true,
            name: 'rope line',
            description: 'Cord.',
            affinities: [{ role: 'delivery', aptness: 0.6 }],
        })
        expect(merged.orders[1]).toEqual(stepA.orders[1])
        expect(merged.confidence).toBe(0.8 * 0.5)
    })

    it('marks valid line failed when enrich line missing', () => {
        const merged = mergeAcmeOrderWithEnrich(stepA, { lines: [], confidence: 1 }, false)
        expect(merged.orders[0]).toMatchObject({
            affinitiesFailed: true,
            description: '',
            affinities: [],
        })
        expect(merged.confidence).toBe(0.8)
    })

    it('marks all valid lines failed when enrichInvokeFailed', () => {
        const merged = mergeAcmeOrderWithEnrich(stepA, null, true)
        expect(merged.orders[0]).toMatchObject({
            affinitiesFailed: true,
            description: '',
            affinities: [],
        })
        expect(merged.orders[1]).toEqual(stepA.orders[1])
        expect(merged.confidence).toBe(0.8)
    })

    it('after interpret, merges one enriched row and one affinitiesFailed row', () => {
        const parsed = interpretAcmeOrderEnrichBody(
            JSON.stringify({
                confidence: 0.9,
                lines: [
                    {
                        name: 'dyn',
                        description: 'Cartoon explosives.',
                        affinities: [{ role: 'terminal', aptness: 0.5 }],
                    },
                    null,
                ],
            }),
            { slotCount: 2, fallbackNames: ['dynamite', 'spring'] }
        )
        expect(parsed.success).toBe(true)
        if (!parsed.success) {
            return
        }
        const merged = mergeAcmeOrderWithEnrich(stepATwoValid, parsed.response, false)
        expect(merged.orders[0]).toMatchObject({
            valid: true,
            name: 'dyn',
            description: 'Cartoon explosives.',
            affinities: [{ role: 'terminal', aptness: 0.5 }],
        })
        expect(merged.orders[1]).toMatchObject({
            valid: true,
            name: 'spring',
            description: '',
            affinities: [],
            affinitiesFailed: true,
        })
        expect(merged.confidence).toBeCloseTo(0.82 * 0.9)
    })
})
