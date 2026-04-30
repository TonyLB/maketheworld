import {
    ACME_ORDER_ENRICH_MAX_AFFINITIES_PER_LINE,
    ACME_ORDER_ENRICH_MAX_LINES,
    COYOTE_AFFINITY_APTNESS_MIN,
    isAcmeOrderEnrichModelLine,
    isAcmeOrderEnrichModelResponse,
    isCoyoteAffinityPossibility,
    isCoyoteAffinityPossibilityEcho,
    normalizeAcmeOrderEnrichLine,
    normalizeAcmeOrderEnrichResponse,
} from './coyotePlanAffinities'
import { isEphemeraMetaRoomObject } from './ephemeraMeta'

describe('isCoyoteAffinityPossibility', () => {
    it('accepts flat modification tags', () => {
        expect(
            isCoyoteAffinityPossibility({
                role: 'influence-road-runner',
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

    it('accepts generative roles', () => {
        expect(isCoyoteAffinityPossibility({ role: 'prep', aptness: 0.6 })).toBe(true)
        expect(isCoyoteAffinityPossibility({ role: 'creation', aptness: 0.4 })).toBe(true)
    })

    it('rejects invalid aptness', () => {
        expect(isCoyoteAffinityPossibility({ role: 'terminal', aptness: -0.1 })).toBe(false)
        expect(isCoyoteAffinityPossibility({ role: 'terminal', aptness: 1.1 })).toBe(false)
        expect(isCoyoteAffinityPossibility({ role: 'terminal', aptness: NaN })).toBe(false)
    })

    it('rejects stale tuple-shaped role payloads', () => {
        expect(
            isCoyoteAffinityPossibility({
                role: 'entity_modification',
                aptness: 0.5,
            })
        ).toBe(false)
    })

    it('rejects tuple payload with legacy target/mode fields', () => {
        expect(
            isCoyoteAffinityPossibility({
                role: 'influence-road-runner',
                target: 'road_runner',
                mode: 'direct',
                aptness: 0.5,
            })
        ).toBe(false)
    })

    it('rejects unknown role', () => {
        expect(isCoyoteAffinityPossibility({ role: 'wizard', aptness: 0.5 } as unknown)).toBe(false)
    })
})

describe('isCoyoteAffinityPossibilityEcho', () => {
    it('accepts full CoyoteAffinityPossibility objects', () => {
        expect(isCoyoteAffinityPossibilityEcho({ role: 'terminal', aptness: 0.5 })).toBe(true)
    })

    it('accepts echoes that omit aptness', () => {
        expect(isCoyoteAffinityPossibilityEcho({ role: 'terminal' })).toBe(true)
        expect(isCoyoteAffinityPossibilityEcho({ role: 'prep' })).toBe(true)
        expect(
            isCoyoteAffinityPossibilityEcho({
                role: 'influence-road-runner',
            })
        ).toBe(true)
    })

    it('rejects invalid aptness when present', () => {
        expect(isCoyoteAffinityPossibilityEcho({ role: 'terminal', aptness: 2 })).toBe(false)
    })

    it('rejects unknown role', () => {
        expect(isCoyoteAffinityPossibilityEcho({ role: 'wizard' } as unknown)).toBe(false)
    })
})

describe('isAcmeOrderEnrichModelLine', () => {
    const validLine = {
        valid: true as const,
        name: 'Beehive',
        stableKey: 'beehive',
        affinities: [
            { role: 'influence-road-runner', aptness: 0.7 },
            { role: 'terminal', aptness: 0.5 },
        ],
    }

    it('accepts a valid line', () => {
        expect(isAcmeOrderEnrichModelLine(validLine)).toBe(true)
    })

    it('accepts valid line when legacy affinities array is omitted', () => {
        expect(
            isAcmeOrderEnrichModelLine({
                valid: true,
                name: 'Beehive',
                stableKey: 'beehive',
                tropeAffinities: [{ trope: 'Contraption', aptness: 'Good', narrowing: 'hive rig' }],
            })
        ).toBe(true)
    })

    it('accepts an invalid catalog line', () => {
        expect(
            isAcmeOrderEnrichModelLine({
                valid: false,
                name: 'Justice',
                errorType: 'Not tangible',
                affinities: [],
            })
        ).toBe(true)
    })

    it('accepts invalid catalog line when legacy affinities array is omitted', () => {
        expect(
            isAcmeOrderEnrichModelLine({
                valid: false,
                name: 'Justice',
                errorType: 'Not tangible',
            })
        ).toBe(true)
    })

    it('rejects too many affinities', () => {
        const affinities = Array.from({ length: ACME_ORDER_ENRICH_MAX_AFFINITIES_PER_LINE + 1 }, (_, i) => ({
            role: 'terminal' as const,
            aptness: 0.1,
        }))
        expect(isAcmeOrderEnrichModelLine({ ...validLine, affinities })).toBe(false)
    })

    it('rejects valid line without non-empty stableKey', () => {
        expect(isAcmeOrderEnrichModelLine({
            valid: true,
            name: 'A',
            affinities: [],
        } as any)).toBe(false)
    })

    it('accepts affinitiesFailed with empty affinities', () => {
        expect(
            isAcmeOrderEnrichModelLine({
                valid: true,
                name: 'Rope',
                stableKey: 'rope',
                affinities: [],
                affinitiesFailed: true,
            })
        ).toBe(true)
    })

    it('rejects affinitiesFailed when affinities are not empty', () => {
        expect(
            isAcmeOrderEnrichModelLine({
                valid: true,
                name: 'Rope',
                stableKey: 'rope',
                affinities: [{ role: 'terminal', aptness: 0.1 }],
                affinitiesFailed: true,
            })
        ).toBe(false)
    })

    it('accepts tropeAffinities entries with omitted or present environmentAffordances', () => {
        expect(
            isAcmeOrderEnrichModelLine({
                ...validLine,
                tropeAffinities: [{ trope: 'Contraption', aptness: 'Good', narrowing: 'launch rig' }],
            })
        ).toBe(true)
        expect(
            isAcmeOrderEnrichModelLine({
                ...validLine,
                tropeAffinities: [{
                    trope: 'Contraption',
                    aptness: 'Good',
                    narrowing: 'launch rig',
                    environmentAffordances: ['payload sling', 'spring board'],
                }],
            })
        ).toBe(true)
        expect(
            isAcmeOrderEnrichModelLine({
                ...validLine,
                tropeAffinities: [{
                    trope: 'Contraption',
                    aptness: 'Good',
                    narrowing: 'launch rig',
                    environmentAffordances: [],
                }],
            })
        ).toBe(true)
    })

    it('rejects tropeAffinities entries with invalid environmentAffordances shape', () => {
        expect(
            isAcmeOrderEnrichModelLine({
                ...validLine,
                tropeAffinities: [{
                    trope: 'Contraption',
                    aptness: 'Good',
                    narrowing: 'launch rig',
                    environmentAffordances: 'payload sling',
                }],
            } as unknown)
        ).toBe(false)
        expect(
            isAcmeOrderEnrichModelLine({
                ...validLine,
                tropeAffinities: [{
                    trope: 'Contraption',
                    aptness: 'Good',
                    narrowing: 'launch rig',
                    environmentAffordances: ['payload sling', 7],
                }],
            } as unknown)
        ).toBe(false)
    })

    it('rejects tropeAffinities entries with legacy affordances key', () => {
        expect(
            isAcmeOrderEnrichModelLine({
                ...validLine,
                tropeAffinities: [{
                    trope: 'Contraption',
                    aptness: 'Good',
                    narrowing: 'launch rig',
                    affordances: ['payload sling'],
                }],
            } as unknown)
        ).toBe(false)
    })
})

describe('normalizeAcmeOrderEnrichLine', () => {
    it('returns valid lines unchanged when a single affinity passes the aptness floor', () => {
        const line = {
            valid: true as const,
            name: 'A',
            stableKey: 'a',
            affinities: [{ role: 'terminal', aptness: 0.5 }] as const,
        }
        expect(normalizeAcmeOrderEnrichLine(line, 'fallback')).toEqual({
            ...line,
            tropeAffinities: [],
            tropeAffinitiesFailed: true,
        })
    })

    it('sorts affinities by aptness descending and drops entries below the floor', () => {
        const line = {
            valid: true as const,
            name: 'X',
            stableKey: 'x',
            affinities: [
                { role: 'terminal', aptness: 0.4 },
                {
                    role: 'influence-road-runner' as const,
                    aptness: 0.9,
                },
                { role: 'delivery', aptness: 0.15 },
            ],
        }
        expect(normalizeAcmeOrderEnrichLine(line, 'fallback')).toEqual({
            valid: true,
            name: 'X',
            stableKey: 'x',
            tropeAffinities: [],
            tropeAffinitiesFailed: true,
            affinities: [
                {
                    role: 'influence-road-runner',
                    aptness: 0.9,
                },
                { role: 'terminal', aptness: 0.4 },
            ],
        })
    })

    it('keeps aptness equal to COYOTE_AFFINITY_APTNESS_MIN', () => {
        const line = {
            valid: true as const,
            name: 'Edge',
            stableKey: 'edge',
            affinities: [
                { role: 'terminal', aptness: COYOTE_AFFINITY_APTNESS_MIN },
                { role: 'trigger', aptness: COYOTE_AFFINITY_APTNESS_MIN - 0.01 },
            ],
        }
        expect(normalizeAcmeOrderEnrichLine(line, 'fallback').affinities).toEqual([
            { role: 'terminal', aptness: COYOTE_AFFINITY_APTNESS_MIN },
        ])
    })

    it('synthesizes failure when raw is garbage', () => {
        expect(normalizeAcmeOrderEnrichLine(null, 'rope')).toEqual({
            valid: true,
            name: 'rope',
            stableKey: 'rope',
            tropeAffinities: [],
            tropeAffinitiesFailed: true,
            affinities: [],
            affinitiesFailed: true,
        })
    })

    it('uses trimmed raw name when present', () => {
        expect(normalizeAcmeOrderEnrichLine({ valid: true, name: '  catalog  ', foo: 1 }, 'rope')).toEqual({
            valid: true,
            name: 'catalog',
            stableKey: 'catalog',
            tropeAffinities: [],
            tropeAffinitiesFailed: true,
            affinities: [],
        })
    })

    it('salvages by filtering invalid affinity entries', () => {
        expect(
            normalizeAcmeOrderEnrichLine(
                {
                    valid: true,
                    name: 'X',
                    stableKey: 'x',
                    affinities: [{ role: 'terminal', aptness: 0.5 }, { bad: true }, 'nope'],
                },
                'fb'
            )
        ).toEqual({
            valid: true,
            name: 'X',
            stableKey: 'x',
            tropeAffinities: [],
            tropeAffinitiesFailed: true,
            affinities: [{ role: 'terminal', aptness: 0.5 }],
        })
    })

    it('coerces affinitiesFailed with wrong fields to empty invariants', () => {
        expect(
            normalizeAcmeOrderEnrichLine(
                {
                    valid: true,
                    name: 'X',
                    stableKey: 'x',
                    affinities: [{ role: 'terminal', aptness: 1 }],
                    affinitiesFailed: true,
                },
                'fb'
            )
        ).toEqual({
            valid: true,
            name: 'X',
            stableKey: 'x',
            tropeAffinities: [],
            tropeAffinitiesFailed: true,
            affinities: [],
            affinitiesFailed: true,
        })
    })

    it('keeps provided tropeAffinities when valid and non-empty', () => {
        expect(
            normalizeAcmeOrderEnrichLine(
                {
                    valid: true,
                    name: 'X',
                    stableKey: 'x',
                    tropeAffinities: [{ trope: 'Contraption', aptness: 'Good', narrowing: 'launch rig' }],
                    affinities: [{ role: 'terminal', aptness: 0.5 }],
                },
                'fb'
            )
        ).toEqual({
            valid: true,
            name: 'X',
            stableKey: 'x',
            tropeAffinities: [{ trope: 'Contraption', aptness: 'Good', narrowing: 'launch rig' }],
            tropeAffinitiesFailed: false,
            affinities: [{ role: 'terminal', aptness: 0.5 }],
        })
    })

    it('salvages valid line with tropeAffinities when legacy affinities are omitted', () => {
        expect(
            normalizeAcmeOrderEnrichLine(
                {
                    valid: true,
                    name: 'X',
                    stableKey: 'x',
                    tropeAffinities: [{ trope: 'Contraption', aptness: 'Good', narrowing: 'launch rig' }],
                },
                'fb'
            )
        ).toEqual({
            valid: true,
            name: 'X',
            stableKey: 'x',
            tropeAffinities: [{ trope: 'Contraption', aptness: 'Good', narrowing: 'launch rig' }],
            tropeAffinitiesFailed: false,
            affinities: [],
        })
    })
})

describe('normalizeAcmeOrderEnrichResponse', () => {
    it('drops invalid root confidence and uses explicit lines', () => {
        const r = normalizeAcmeOrderEnrichResponse({
            confidence: 9,
            lines: [
                {
                    valid: true,
                    name: 'Good',
                    stableKey: 'good',
                    affinities: [{ role: 'terminal', aptness: 0.2 }],
                },
            ],
        })
        expect(r.confidence).toBeUndefined()
        expect(r.lines).toHaveLength(1)
        expect(isAcmeOrderEnrichModelLine(r.lines[0])).toBe(true)
    })

    it('pads empty lines array with synthetic failure using emptyFallbackName', () => {
        const r = normalizeAcmeOrderEnrichResponse({ lines: [] }, { emptyFallbackName: 'custom' })
        expect(r.lines).toHaveLength(1)
        expect(r.lines[0]).toMatchObject({
            valid: true,
            name: 'custom',
            stableKey: 'custom',
            affinities: [],
            affinitiesFailed: true,
        })
    })

    it('salvages null entries in lines array', () => {
        const r = normalizeAcmeOrderEnrichResponse({
            confidence: 0.9,
            lines: [
                {
                    valid: true,
                    name: 'Good',
                    stableKey: 'good',
                    affinities: [{ role: 'terminal', aptness: 0.2 }],
                },
                null,
            ],
        })
        expect(r.confidence).toBe(0.9)
        expect(isAcmeOrderEnrichModelLine(r.lines[0])).toBe(true)
        expect(r.lines[1]).toMatchObject({
            valid: true,
            name: 'line2',
            stableKey: 'line2',
            affinities: [],
            affinitiesFailed: true,
        })
    })

    it('mixes valid and invalid lines', () => {
        const r = normalizeAcmeOrderEnrichResponse({
            lines: [
                {
                    valid: false,
                    name: 'Moon',
                    errorType: 'Too large',
                    affinities: [],
                },
                {
                    valid: true,
                    name: 'Anvil',
                    stableKey: 'anvil',
                    affinities: [{ role: 'terminal', aptness: 0.5 }],
                },
            ],
        })
        expect(r.lines[0]).toMatchObject({
            valid: false,
            name: 'Moon',
            errorType: 'Too large',
            affinities: [],
        })
        expect(r.lines[1]?.valid === true ? r.lines[1].name : '').toBe('Anvil')
    })

    it('throws when parsed is not an object', () => {
        expect(() => normalizeAcmeOrderEnrichResponse(null)).toThrow(/plain object/)
    })
})

describe('isAcmeOrderEnrichModelResponse', () => {
    it('accepts lines array', () => {
        expect(
            isAcmeOrderEnrichModelResponse({
                lines: [
                    {
                        valid: true,
                        name: 'Shovel',
                        stableKey: 'shovel',
                        affinities: [
                            {
                                role: 'connect-props',
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
            valid: true as const,
            name: `x${i}`,
            stableKey: `x${i}`,
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
                        valid: true,
                        name: 'A',
                        stableKey: 'a',
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
                lines: [{ valid: true, name: 'A', stableKey: 'a', affinities: [] }],
            })
        ).toBe(false)
    })
})

describe('isEphemeraMetaRoomObject', () => {
    it('rejects uuid + shortName without stableKey', () => {
        expect(
            isEphemeraMetaRoomObject({
                uuid: 'OBJECT#abc',
                shortName: 'anvil',
            })
        ).toBe(false)
    })

    it('accepts extended optional fields with stableKey', () => {
        expect(
            isEphemeraMetaRoomObject({
                uuid: 'OBJECT#abc',
                shortName: 'Beehive',
                stableKey: 'beehive',
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
                stableKey: 'x',
                affinities: [{ bogus: true }],
            } as unknown)
        ).toBe(true)
    })

    it('rejects wrong optional types', () => {
        expect(
            isEphemeraMetaRoomObject({
                uuid: 'OBJECT#abc',
                shortName: 'x',
                stableKey: 'x',
                affinities: {},
            } as unknown)
        ).toBe(false)
        expect(
            isEphemeraMetaRoomObject({
                uuid: 'OBJECT#abc',
                shortName: 'x',
                stableKey: 'x',
                affinitiesFailed: 'yes',
            } as unknown)
        ).toBe(false)
    })

    it('accepts required stableKey', () => {
        expect(
            isEphemeraMetaRoomObject({
                uuid: 'OBJECT#abc',
                shortName: 'Anvil',
                stableKey: 'anvil',
            })
        ).toBe(true)
    })

    it('rejects stableKey wrong type or empty after trim', () => {
        expect(
            isEphemeraMetaRoomObject({
                uuid: 'OBJECT#abc',
                shortName: 'x',
                stableKey: '',
            })
        ).toBe(false)
        expect(
            isEphemeraMetaRoomObject({
                uuid: 'OBJECT#abc',
                shortName: 'x',
                stableKey: '   ',
            })
        ).toBe(false)
        expect(
            isEphemeraMetaRoomObject({
                uuid: 'OBJECT#abc',
                shortName: 'x',
                stableKey: 1,
            } as unknown)
        ).toBe(false)
    })
})
