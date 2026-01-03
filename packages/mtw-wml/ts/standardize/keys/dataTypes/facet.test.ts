import {
    isPositionPayload,
    isMarkFacetPayload,
    isExitPayload,
    isStandardFacetPayload,
    isStandardFacetData,
    PositionPayload,
    MarkFacetPayload,
    ExitPayload,
    StandardFacetData
} from './facet'
import { StandardReferenceData } from './reference'

describe('isPositionPayload', () => {
    it('should accept valid PositionPayload with required fields', () => {
        const payload: PositionPayload = {
            type: 'PositionFacet',
            x: 10,
            y: 20
        }
        expect(isPositionPayload(payload)).toBe(true)
    })

    it('should reject missing type field', () => {
        const payload = {
            x: 10,
            y: 20
        }
        expect(isPositionPayload(payload)).toBe(false)
    })

    it('should reject wrong type value', () => {
        const payload = {
            type: 'MarkFacet',
            x: 10,
            y: 20
        }
        expect(isPositionPayload(payload)).toBe(false)
    })

    it('should reject missing x field', () => {
        const payload = {
            type: 'PositionFacet',
            y: 20
        }
        expect(isPositionPayload(payload)).toBe(false)
    })

    it('should reject missing y field', () => {
        const payload = {
            type: 'PositionFacet',
            x: 10
        }
        expect(isPositionPayload(payload)).toBe(false)
    })

    it('should reject wrong type for x', () => {
        const payload = {
            type: 'PositionFacet',
            x: '10',
            y: 20
        }
        expect(isPositionPayload(payload)).toBe(false)
    })

    it('should reject wrong type for y', () => {
        const payload = {
            type: 'PositionFacet',
            x: 10,
            y: '20'
        }
        expect(isPositionPayload(payload)).toBe(false)
    })

    it('should reject null', () => {
        expect(isPositionPayload(null)).toBe(false)
    })

    it('should reject undefined', () => {
        expect(isPositionPayload(undefined)).toBe(false)
    })

    it('should reject string', () => {
        expect(isPositionPayload('not an object')).toBe(false)
    })

    it('should reject number', () => {
        expect(isPositionPayload(42)).toBe(false)
    })
})

describe('isMarkFacetPayload', () => {
    it('should accept valid MarkFacetPayload with required fields', () => {
        const payload: MarkFacetPayload = {
            type: 'MarkFacet',
            narrative: 'A dark room'
        }
        expect(isMarkFacetPayload(payload)).toBe(true)
    })

    it('should reject missing type field', () => {
        const payload = {
            narrative: 'A dark room'
        }
        expect(isMarkFacetPayload(payload)).toBe(false)
    })

    it('should reject wrong type value', () => {
        const payload = {
            type: 'PositionFacet',
            narrative: 'A dark room'
        }
        expect(isMarkFacetPayload(payload)).toBe(false)
    })

    it('should reject missing narrative field', () => {
        const payload = {
            type: 'MarkFacet'
        }
        expect(isMarkFacetPayload(payload)).toBe(false)
    })

    it('should reject wrong type for narrative', () => {
        const payload = {
            type: 'MarkFacet',
            narrative: 123
        }
        expect(isMarkFacetPayload(payload)).toBe(false)
    })

    it('should reject null', () => {
        expect(isMarkFacetPayload(null)).toBe(false)
    })

    it('should reject undefined', () => {
        expect(isMarkFacetPayload(undefined)).toBe(false)
    })

    it('should reject string', () => {
        expect(isMarkFacetPayload('not an object')).toBe(false)
    })

    it('should reject number', () => {
        expect(isMarkFacetPayload(42)).toBe(false)
    })
})

describe('isExitPayload', () => {
    it('should accept valid ExitPayload with required fields only', () => {
        const payload: ExitPayload = {
            type: 'ExitFacet'
        }
        expect(isExitPayload(payload)).toBe(true)
    })

    it('should accept valid ExitPayload with optional description', () => {
        const payload: ExitPayload = {
            type: 'ExitFacet',
            description: 'A wooden door'
        }
        expect(isExitPayload(payload)).toBe(true)
    })

    it('should reject missing type field', () => {
        const payload = {
            description: 'A wooden door'
        }
        expect(isExitPayload(payload)).toBe(false)
    })

    it('should reject wrong type value', () => {
        const payload = {
            type: 'PositionFacet',
            description: 'A wooden door'
        }
        expect(isExitPayload(payload)).toBe(false)
    })

    it('should reject wrong type for description', () => {
        const payload = {
            type: 'ExitFacet',
            description: 123
        }
        expect(isExitPayload(payload)).toBe(false)
    })

    it('should reject null', () => {
        expect(isExitPayload(null)).toBe(false)
    })

    it('should reject undefined', () => {
        expect(isExitPayload(undefined)).toBe(false)
    })

    it('should reject string', () => {
        expect(isExitPayload('not an object')).toBe(false)
    })

    it('should reject number', () => {
        expect(isExitPayload(42)).toBe(false)
    })
})

describe('isStandardFacetPayload', () => {
    it('should accept valid PositionPayload', () => {
        const payload: PositionPayload = {
            type: 'PositionFacet',
            x: 10,
            y: 20
        }
        expect(isStandardFacetPayload(payload)).toBe(true)
    })

    it('should accept valid MarkFacetPayload', () => {
        const payload: MarkFacetPayload = {
            type: 'MarkFacet',
            narrative: 'A dark room'
        }
        expect(isStandardFacetPayload(payload)).toBe(true)
    })

    it('should accept valid ExitPayload', () => {
        const payload: ExitPayload = {
            type: 'ExitFacet',
            description: 'A wooden door'
        }
        expect(isStandardFacetPayload(payload)).toBe(true)
    })

    it('should reject object without recognized type', () => {
        const payload = {
            type: 'UnknownFacet',
            someField: 'value'
        }
        expect(isStandardFacetPayload(payload)).toBe(false)
    })

    it('should reject object without type field', () => {
        const payload = {
            someField: 'value'
        }
        expect(isStandardFacetPayload(payload)).toBe(false)
    })

    it('should reject null', () => {
        expect(isStandardFacetPayload(null)).toBe(false)
    })

    it('should reject undefined', () => {
        expect(isStandardFacetPayload(undefined)).toBe(false)
    })

    it('should reject string', () => {
        expect(isStandardFacetPayload('not an object')).toBe(false)
    })

    it('should reject number', () => {
        expect(isStandardFacetPayload(42)).toBe(false)
    })
})

describe('isStandardFacetData', () => {
    const validReference: StandardReferenceData = {
        key: 'room1',
        tag: 'Room',
        ref: 1
    }

    it('should accept valid StandardFacetData with PositionPayload', () => {
        const facetData: StandardFacetData<PositionPayload> = {
            reference: validReference,
            payload: {
                type: 'PositionFacet',
                x: 10,
                y: 20
            }
        }
        expect(isStandardFacetData(facetData)).toBe(true)
    })

    it('should accept valid StandardFacetData with MarkFacetPayload', () => {
        const facetData: StandardFacetData<MarkFacetPayload> = {
            reference: validReference,
            payload: {
                type: 'MarkFacet',
                narrative: 'A dark room'
            }
        }
        expect(isStandardFacetData(facetData)).toBe(true)
    })

    it('should accept valid StandardFacetData with ExitPayload', () => {
        const facetData: StandardFacetData<ExitPayload> = {
            reference: validReference,
            payload: {
                type: 'ExitFacet',
                description: 'A wooden door'
            }
        }
        expect(isStandardFacetData(facetData)).toBe(true)
    })

    it('should accept valid StandardFacetData with ComponentUUID string reference', () => {
        const facetData: StandardFacetData = {
            reference: 'ROOM#room1',
            payload: {
                type: 'PositionFacet',
                x: 10,
                y: 20
            }
        }
        expect(isStandardFacetData(facetData)).toBe(true)
    })

    it('should reject missing reference field', () => {
        const facetData = {
            payload: {
                type: 'PositionFacet',
                x: 10,
                y: 20
            }
        }
        expect(isStandardFacetData(facetData)).toBe(false)
    })

    it('should reject invalid reference (not StandardReferenceData)', () => {
        const facetData = {
            reference: { invalid: 'reference' },
            payload: {
                type: 'PositionFacet',
                x: 10,
                y: 20
            }
        }
        expect(isStandardFacetData(facetData)).toBe(false)
    })

    it('should reject missing payload field', () => {
        const facetData = {
            reference: validReference
        }
        expect(isStandardFacetData(facetData)).toBe(false)
    })

    it('should reject invalid payload (not StandardFacetPayload)', () => {
        const facetData = {
            reference: validReference,
            payload: {
                type: 'UnknownFacet',
                someField: 'value'
            }
        }
        expect(isStandardFacetData(facetData)).toBe(false)
    })

    it('should reject payload without type field', () => {
        const facetData = {
            reference: validReference,
            payload: {
                x: 10,
                y: 20
            }
        }
        expect(isStandardFacetData(facetData)).toBe(false)
    })

    it('should reject null', () => {
        expect(isStandardFacetData(null)).toBe(false)
    })

    it('should reject undefined', () => {
        expect(isStandardFacetData(undefined)).toBe(false)
    })

    it('should reject string', () => {
        expect(isStandardFacetData('not an object')).toBe(false)
    })

    it('should reject number', () => {
        expect(isStandardFacetData(42)).toBe(false)
    })
})
