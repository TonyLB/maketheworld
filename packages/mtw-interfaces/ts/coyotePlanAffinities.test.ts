import {
    ACME_ORDER_ENRICH_MAX_AFFINITIES_PER_LINE,
    ACME_ORDER_ENRICH_MAX_LINES,
    isAcmeOrderEnrichModelLine,
    isAcmeOrderEnrichModelResponse,
    isCoyoteAffinityPossibility,
    normalizeAcmeOrderEnrichLine,
    normalizeAcmeOrderEnrichResponse,
} from './coyotePlanAffinities'
import { isEphemeraMetaRoomObject } from './ephemeraMeta'

describe('isCoyoteAffinityPossibility', () => {
    it('accepts entity_modification', () => {
        expect(
            isCoyoteAffinityPossibility({
                role: 'entity_modification',
                target: 'road_runner',
                mode: 'direct',
                aptness: 0.7,
            })
        ).toBe(true)
    })

    it('accepts structural roles', () => {
        expect(isCoyoteAffinityPossibility({ role: 'terminal', aptness: 0.5 })).toBe(true)
        expect(isCoyoteAffinityPossibility({ role: 'trigger', aptness: 0 })).toBe(true)
        expect(isCoyoteAffinityPossibility({ role: 'delivery', aptness: 1 })).toBe(true)
        expect(isCoyoteAffinityPossibility({ role: 'autonomous_agent', aptness: 0.3 })).toBe(true)
    })

    it('rejects invalid aptness', () => {
        expect(isCoyoteAffinityPossibility({ role: 'terminal', aptness: -0.1 })).toBe(false)
        expect(isCoyoteAffinityPossibility({ role: 'terminal', aptness: 1.1 })).toBe(false)
        expect(isCoyoteAffinityPossibility({ role: 'terminal', aptness: NaN })).toBe(false)
    })

    it('rejects entity_modification without target/mode', () => {
        expect(
            isCoyoteAffinityPossibility({
                role: 'entity_modification',
                aptness: 0.5,
            })
        ).toBe(false)
    })

    it('rejects unknown role', () => {
        expect(isCoyoteAffinityPossibility({ role: 'wizard', aptness: 0.5 } as unknown)).toBe(false)
    })
})

describe('isAcmeOrderEnrichModelLine', () => {
    const validLine = {
        name: 'Beehive',
        description: 'Standard Acme beehive.',
        affinities: [
            { role: 'entity_modification', target: 'road_runner', mode: 'direct', aptness: 0.7 },
            { role: 'terminal', aptness: 0.5 },
        ],
    }

    it('accepts a valid line', () => {
        expect(isAcmeOrderEnrichModelLine(validLine)).toBe(true)
    })

    it('rejects too many affinities', () => {
        const affinities = Array.from({ length: ACME_ORDER_ENRICH_MAX_AFFINITIES_PER_LINE + 1 }, (_, i) => ({
            role: 'terminal' as const,
            aptness: 0.1,
        }))
        expect(isAcmeOrderEnrichModelLine({ ...validLine, affinities })).toBe(false)
    })

    it('accepts affinitiesFailed with required empty description and affinities', () => {
        expect(
            isAcmeOrderEnrichModelLine({
                name: 'Rope',
                description: '',
                affinities: [],
                affinitiesFailed: true,
            })
        ).toBe(true)
    })

    it('rejects affinitiesFailed when description or affinities are not empty', () => {
        expect(
            isAcmeOrderEnrichModelLine({
                name: 'Rope',
                description: 'x',
                affinities: [],
                affinitiesFailed: true,
            })
        ).toBe(false)
        expect(
            isAcmeOrderEnrichModelLine({
                name: 'Rope',
                description: '',
                affinities: [{ role: 'terminal', aptness: 0.1 }],
                affinitiesFailed: true,
            })
        ).toBe(false)
    })
})

describe('normalizeAcmeOrderEnrichLine', () => {
    it('returns valid lines unchanged', () => {
        const line = {
            name: 'A',
            description: 'd',
            affinities: [{ role: 'terminal', aptness: 0.5 }] as const,
        }
        expect(normalizeAcmeOrderEnrichLine(line, 'fallback')).toEqual(line)
    })

    it('synthesizes failure when raw is garbage', () => {
        expect(normalizeAcmeOrderEnrichLine(null, 'rope')).toEqual({
            name: 'rope',
            description: '',
            affinities: [],
            affinitiesFailed: true,
        })
    })

    it('uses trimmed raw name when present', () => {
        expect(normalizeAcmeOrderEnrichLine({ name: '  catalog  ', foo: 1 }, 'rope')).toEqual({
            name: 'catalog',
            description: '',
            affinities: [],
            affinitiesFailed: true,
        })
    })

    it('salvages by filtering invalid affinity entries', () => {
        expect(
            normalizeAcmeOrderEnrichLine(
                {
                    name: 'X',
                    description: 'y',
                    affinities: [{ role: 'terminal', aptness: 0.5 }, { bad: true }, 'nope'],
                },
                'fb'
            )
        ).toEqual({
            name: 'X',
            description: 'y',
            affinities: [{ role: 'terminal', aptness: 0.5 }],
        })
    })

    it('coerces affinitiesFailed with wrong fields to empty invariants', () => {
        expect(
            normalizeAcmeOrderEnrichLine(
                {
                    name: 'X',
                    description: 'should drop',
                    affinities: [{ role: 'terminal', aptness: 1 }],
                    affinitiesFailed: true,
                },
                'fb'
            )
        ).toEqual({
            name: 'X',
            description: '',
            affinities: [],
            affinitiesFailed: true,
        })
    })
})

describe('normalizeAcmeOrderEnrichResponse', () => {
    it('pads missing slots with synthetic failures and drops invalid root confidence', () => {
        const r = normalizeAcmeOrderEnrichResponse(
            { confidence: 9, lines: 'not-array' },
            2,
            ['a', 'b']
        )
        expect(r.confidence).toBeUndefined()
        expect(r.lines).toHaveLength(2)
        expect(r.lines[0]).toMatchObject({
            name: 'a',
            description: '',
            affinities: [],
            affinitiesFailed: true,
        })
        expect(r.lines[1]).toMatchObject({
            name: 'b',
            description: '',
            affinities: [],
            affinitiesFailed: true,
        })
    })

    it('passes valid root confidence and mixes good and bad lines', () => {
        const r = normalizeAcmeOrderEnrichResponse(
            {
                confidence: 0.9,
                lines: [
                    { name: 'Good', description: 'd', affinities: [{ role: 'terminal', aptness: 0.2 }] },
                    null,
                ],
            },
            2,
            ['stepA1', 'stepA2']
        )
        expect(r.confidence).toBe(0.9)
        expect(isAcmeOrderEnrichModelLine(r.lines[0])).toBe(true)
        expect(r.lines[1]).toEqual({
            name: 'stepA2',
            description: '',
            affinities: [],
            affinitiesFailed: true,
        })
    })

    it('throws when fallbackNames length disagrees with slotCount', () => {
        expect(() => normalizeAcmeOrderEnrichResponse({ lines: [] }, 2, ['only'])).toThrow(
            /fallbackNames length must equal slotCount/
        )
    })
})

describe('isAcmeOrderEnrichModelResponse', () => {
    it('accepts lines array', () => {
        expect(
            isAcmeOrderEnrichModelResponse({
                lines: [
                    {
                        name: 'Shovel',
                        description: 'Entrenching shovel.',
                        affinities: [
                            {
                                role: 'entity_modification',
                                target: 'environment',
                                mode: 'constructive',
                                aptness: 0.9,
                            },
                        ],
                    },
                ],
            })
        ).toBe(true)
    })

    it('rejects too many lines', () => {
        const lines = Array.from({ length: ACME_ORDER_ENRICH_MAX_LINES + 1 }, (_, i) => ({
            name: `x${i}`,
            description: 'd',
            affinities: [] as [],
        }))
        expect(isAcmeOrderEnrichModelResponse({ lines })).toBe(false)
    })

    it('accepts optional root confidence in 0 to 1', () => {
        expect(
            isAcmeOrderEnrichModelResponse({
                confidence: 0.88,
                lines: [
                    {
                        name: 'A',
                        description: 'd',
                        affinities: [{ role: 'terminal', aptness: 0.2 }],
                    },
                ],
            })
        ).toBe(true)
    })

    it('rejects root confidence out of range', () => {
        expect(
            isAcmeOrderEnrichModelResponse({
                confidence: 1.2,
                lines: [{ name: 'A', description: 'd', affinities: [] }],
            })
        ).toBe(false)
    })
})

describe('isEphemeraMetaRoomObject', () => {
    it('accepts legacy uuid + shortName only', () => {
        expect(
            isEphemeraMetaRoomObject({
                uuid: 'OBJECT#abc',
                shortName: 'anvil',
            })
        ).toBe(true)
    })

    it('accepts extended optional fields', () => {
        expect(
            isEphemeraMetaRoomObject({
                uuid: 'OBJECT#abc',
                shortName: 'Beehive',
                description: 'Bees.',
                affinities: [{ role: 'terminal', aptness: 0.5 }],
                affinitiesFailed: false,
            })
        ).toBe(true)
    })

    it('does not validate affinities entries deeply', () => {
        expect(
            isEphemeraMetaRoomObject({
                uuid: 'OBJECT#abc',
                shortName: 'x',
                affinities: [{ bogus: true }],
            } as unknown)
        ).toBe(true)
    })

    it('rejects wrong optional types', () => {
        expect(
            isEphemeraMetaRoomObject({
                uuid: 'OBJECT#abc',
                shortName: 'x',
                description: 1,
            } as unknown)
        ).toBe(false)
        expect(
            isEphemeraMetaRoomObject({
                uuid: 'OBJECT#abc',
                shortName: 'x',
                affinities: {},
            } as unknown)
        ).toBe(false)
        expect(
            isEphemeraMetaRoomObject({
                uuid: 'OBJECT#abc',
                shortName: 'x',
                affinitiesFailed: 'yes',
            } as unknown)
        ).toBe(false)
    })
})
