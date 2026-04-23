import {
    isPositionPayload,
    isMarkFacetPayload,
    isExitPayload,
    isStandardFacetData,
    isStandardFacetEnvelopeWithOptionalPayload,
    PositionPayload,
    MarkFacetPayload,
    ExitPayload,
    StandardFacetData
} from './facet'
import { StandardReferenceData } from '../../dataTypes/reference'

describe('isPositionPayload', () => {
    it('should accept valid PositionPayload with x and y fields', () => {
        const payload: PositionPayload = {
            x: 10,
            y: 20
        }
        expect(isPositionPayload(payload)).toBe(true)
    })

    it('should reject missing x field', () => {
        const payload = {
            y: 20
        }
        expect(isPositionPayload(payload)).toBe(false)
    })

    it('should reject missing y field', () => {
        const payload = {
            x: 10
        }
        expect(isPositionPayload(payload)).toBe(false)
    })

    it('should reject wrong type for x', () => {
        const payload = {
            x: '10',
            y: 20
        }
        expect(isPositionPayload(payload)).toBe(false)
    })

    it('should reject wrong type for y', () => {
        const payload = {
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
    it('should accept valid string payload', () => {
        const payload: MarkFacetPayload = 'A dark room'
        expect(isMarkFacetPayload(payload)).toBe(true)
    })

    it('should accept empty string', () => {
        const payload: MarkFacetPayload = ''
        expect(isMarkFacetPayload(payload)).toBe(true)
    })

    it('should reject null', () => {
        expect(isMarkFacetPayload(null)).toBe(false)
    })

    it('should reject undefined', () => {
        expect(isMarkFacetPayload(undefined)).toBe(false)
    })

    it('should reject object', () => {
        expect(isMarkFacetPayload({ narrative: 'A dark room' })).toBe(false)
    })

    it('should reject number', () => {
        expect(isMarkFacetPayload(42)).toBe(false)
    })
})

describe('isExitPayload', () => {
    it('should accept valid string payload', () => {
        const payload: ExitPayload = 'A wooden door'
        expect(isExitPayload(payload)).toBe(true)
    })

    it('should accept undefined (omitted description)', () => {
        const payload: ExitPayload = undefined
        expect(isExitPayload(payload)).toBe(true)
    })

    it('should accept empty string', () => {
        const payload: ExitPayload = ''
        expect(isExitPayload(payload)).toBe(true)
    })

    it('should reject null', () => {
        expect(isExitPayload(null)).toBe(false)
    })

    it('should reject object', () => {
        expect(isExitPayload({ description: 'A wooden door' })).toBe(false)
    })

    it('should reject number', () => {
        expect(isExitPayload(42)).toBe(false)
    })
})

// isStandardFacetPayload removed - no longer needed since types are inferred from context

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
                x: 10,
                y: 20
            }
        }
        expect(isStandardFacetData(facetData)).toBe(true)
    })

    it('should accept valid StandardFacetData with MarkFacetPayload', () => {
        const facetData: StandardFacetData<MarkFacetPayload> = {
            reference: validReference,
            payload: 'A dark room'
        }
        expect(isStandardFacetData(facetData)).toBe(true)
    })

    it('should accept valid StandardFacetData with ExitPayload (string)', () => {
        const facetData: StandardFacetData<ExitPayload> = {
            reference: validReference,
            payload: 'A wooden door'
        }
        expect(isStandardFacetData(facetData)).toBe(true)
    })

    it('should accept valid StandardFacetData with ExitPayload (undefined)', () => {
        const facetData: StandardFacetData<ExitPayload> = {
            reference: validReference,
            payload: undefined
        }
        expect(isStandardFacetData(facetData)).toBe(true)
    })

    it('should accept valid StandardFacetData with ComponentUUID string reference', () => {
        const facetData: StandardFacetData<PositionPayload> = {
            reference: 'ROOM#room1',
            payload: {
                x: 10,
                y: 20
            }
        }
        expect(isStandardFacetData(facetData)).toBe(true)
    })

    it('should reject missing reference field', () => {
        const facetData = {
            payload: {
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

    it('should accept valid payload (PositionPayload format)', () => {
        const facetData = {
            reference: validReference,
            payload: {
                x: 10,
                y: 20
            }
        }
        expect(isStandardFacetData(facetData)).toBe(true)
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

describe('isStandardFacetEnvelopeWithOptionalPayload', () => {
    const validReference: StandardReferenceData = {
        key: 'room1',
        tag: 'Room',
        ref: 1
    }

    it('should accept reference with payload', () => {
        expect(isStandardFacetEnvelopeWithOptionalPayload({
            reference: validReference,
            payload: { x: 10, y: 20 }
        })).toBe(true)
    })

    it('should accept reference without payload', () => {
        expect(isStandardFacetEnvelopeWithOptionalPayload({
            reference: validReference
        })).toBe(true)
    })

    it('should reject missing reference', () => {
        expect(isStandardFacetEnvelopeWithOptionalPayload({
            payload: 'test'
        })).toBe(false)
    })
})
