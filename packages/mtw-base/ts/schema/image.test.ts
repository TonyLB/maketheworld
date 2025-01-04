import { isSchemaImageTag } from './image'

describe('image tags', () => {
    describe('isSchemaImageTag', () => {
        it('should return true for valid SchemaImageTag with fileURL', () => {
            const schema = { tag: 'Image', key: 'imageKey', fileURL: 'http://example.com/image.png' }
            expect(isSchemaImageTag(schema)).toBe(true)
        })

        it('should return true for valid SchemaImageTag without fileURL', () => {
            const schema = { tag: 'Image', key: 'imageKey' }
            expect(isSchemaImageTag(schema)).toBe(true)
        })

        it('should return false for invalid SchemaImageTag with wrong tag', () => {
            const schema = { tag: 'Invalid', key: 'imageKey', fileURL: 'http://example.com/image.png' }
            expect(isSchemaImageTag(schema)).toBe(false)
        })

        it('should return false for SchemaImageTag missing key', () => {
            const schema = { tag: 'Image', fileURL: 'http://example.com/image.png' }
            expect(isSchemaImageTag(schema)).toBe(false)
        })

        it('should return false for SchemaImageTag missing tag', () => {
            const schema = { key: 'imageKey', fileURL: 'http://example.com/image.png' }
            expect(isSchemaImageTag(schema)).toBe(false)
        })
    })
})