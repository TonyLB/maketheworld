import {
    interpretAcmeOrderEnrichBody,
    finalizeAcmeOrderFromStepB,
} from './mergeAcmeOrderEnrich'

describe('interpretAcmeOrderEnrichBody', () => {
    it('accepts valid Step B JSON', () => {
        const r = interpretAcmeOrderEnrichBody(JSON.stringify({
            lines: [{ valid: true, name: 'A', affinities: [{ role: 'terminal', aptness: 0.5 }] }],
        }))
        expect(r.success).toBe(true)
        if (r.success) {
            expect(r.response.lines).toHaveLength(1)
            expect(r.response.lines[0].valid === true && r.response.lines[0].name).toBe('A')
        }
    })

    it('returns failure on JSON parse error', () => {
        expect(interpretAcmeOrderEnrichBody('{').success).toBe(false)
    })

    it('normalizes missing lines array to single synthetic row', () => {
        const r = interpretAcmeOrderEnrichBody(JSON.stringify({ lines: 'bad' }))
        expect(r.success).toBe(true)
        if (r.success) {
            expect(r.response.lines).toHaveLength(1)
            expect(r.response.lines[0]).toMatchObject({
                valid: true,
                affinities: [],
                affinitiesFailed: true,
            })
        }
    })

    it('per-line: good line plus garbage yields salvage failure for second slot', () => {
        const r = interpretAcmeOrderEnrichBody(
            JSON.stringify({
                lines: [
                    { valid: true, name: 'Good', affinities: [{ role: 'terminal', aptness: 0.3 }] },
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
                affinities: [],
                affinitiesFailed: true,
            })
        }
    })
})

describe('finalizeAcmeOrderFromStepB', () => {
    const stepAConf = 0.8

    it('maps enrich lines to parse orders', () => {
        const merged = finalizeAcmeOrderFromStepB(
            stepAConf,
            {
                lines: [
                    {
                        valid: true,
                        name: 'rope line',
                        affinities: [{ role: 'delivery', aptness: 0.6 }],
                    },
                    {
                        valid: false,
                        name: 'moon',
                        errorType: 'Not a thing',
                        affinities: [],
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
            affinities: [{ role: 'delivery', aptness: 0.6 }],
        })
        expect(merged.orders[1]).toMatchObject({
            valid: false,
            name: 'moon',
            errorType: 'Not a thing',
            affinities: [],
        })
        expect(merged.confidence).toBeCloseTo(stepAConf * 0.5)
    })

    it('single synthetic failure when enrichInvokeFailed', () => {
        const merged = finalizeAcmeOrderFromStepB(stepAConf, null, true, 'order rope')
        expect(merged.orders).toHaveLength(1)
        expect(merged.orders[0]).toMatchObject({
            valid: true,
            name: 'order rope',
            affinities: [],
            affinitiesFailed: true,
        })
        expect(merged.confidence).toBe(stepAConf)
    })

    it('after interpret, merges good plus salvaged rows', () => {
        const parsed = interpretAcmeOrderEnrichBody(
            JSON.stringify({
                confidence: 0.9,
                lines: [
                    {
                        valid: true,
                        name: 'dyn',
                        affinities: [{ role: 'terminal', aptness: 0.5 }],
                    },
                    null,
                ],
            })
        )
        expect(parsed.success).toBe(true)
        if (!parsed.success) {
            return
        }
        const merged = finalizeAcmeOrderFromStepB(0.82, parsed.response, false, 'x')
        expect(merged.orders[0]).toMatchObject({
            valid: true,
            name: 'dyn',
            affinities: [{ role: 'terminal', aptness: 0.5 }],
        })
        expect(merged.orders[1]?.affinitiesFailed).toBe(true)
        expect(merged.confidence).toBeCloseTo(0.82 * 0.9)
    })

    it('merges multi-role enrich lines in index order', () => {
        const merged = finalizeAcmeOrderFromStepB(
            0.85,
            {
                lines: [
                    {
                        valid: true,
                        name: 'Beehive',
                        affinities: [
                            {
                                role: 'entity_modification',
                                target: 'road_runner',
                                mode: 'direct',
                                aptness: 0.7,
                            },
                            { role: 'terminal', aptness: 0.5 },
                        ],
                    },
                    {
                        valid: true,
                        name: 'Entrenching Shovel',
                        affinities: [
                            {
                                role: 'entity_modification',
                                target: 'environment',
                                mode: 'constructive',
                                aptness: 0.88,
                            },
                            { role: 'trigger', aptness: 0.42 },
                        ],
                    },
                    {
                        valid: true,
                        name: 'Climbing Rope',
                        affinities: [
                            { role: 'delivery', aptness: 0.81 },
                            { role: 'trigger', aptness: 0.55 },
                        ],
                    },
                ],
                confidence: 0.9,
            },
            false,
            'cmd'
        )
        expect(merged.orders[0]?.name).toBe('Beehive')
        expect(merged.orders[2]?.name).toBe('Climbing Rope')
        expect(merged.confidence).toBeCloseTo(0.85 * 0.9)
    })
})
