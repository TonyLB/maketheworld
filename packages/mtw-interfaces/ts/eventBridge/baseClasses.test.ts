// Tests for EventBridge base classes

import { isEventPayload, EventPayload } from './baseClasses'

describe('EventBridge baseClasses', () => {
    describe('isEventPayload', () => {
        it('should return true for object without type (consumer compatibility)', () => {
            expect(isEventPayload({ foo: 1 })).toBe(true)
        })

        it('should return true for object with valid type string', () => {
            expect(isEventPayload({ type: 'Content Update', wml: 'x' })).toBe(true)
        })

        it('should return false when type is present but not a string', () => {
            expect(isEventPayload({ type: 123 })).toBe(false)
        })

        it('should return false for null', () => {
            expect(isEventPayload(null)).toBe(false)
        })

        it('should return false for non-object', () => {
            expect(isEventPayload('string')).toBe(false)
        })
    })
})
