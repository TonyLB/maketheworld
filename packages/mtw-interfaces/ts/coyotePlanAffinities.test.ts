import {
    ACME_ORDER_ENRICH_MAX_AFFINITIES_PER_LINE,
    ACME_ORDER_ENRICH_MAX_LINES,
    isAcmeOrderEnrichModelLine,
    isAcmeOrderEnrichModelResponse,
    isCoyoteAffinityPossibility,
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
