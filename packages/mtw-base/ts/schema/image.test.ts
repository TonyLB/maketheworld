import { isSchemaImage } from './image'

describe('image tags', () => {
    describe('isSchemaImage', () => {
        it('should return true for valid SchemaImageTag with fileURL', () => {
            const schema = { tag: 'Image', key: 'imageKey', fileURL: 'http://example.com/image.png' }
            expect(isSchemaImage(schema)).toBe(true)
        })

        it('should return true for valid SchemaImageTag without fileURL', () => {
            const schema = { tag: 'Image', key: 'imageKey' }
            expect(isSchemaImage(schema)).toBe(true)
        })

        it('should return true for valid SchemaImageTag with origin', () => {
            const schema = { tag: 'Image', key: 'imageKey', origin: ['ASSET#123', 'ASSET#456'] }
            expect(isSchemaImage(schema)).toBe(true)
        })

        it('should return true for valid SchemaImageTag with empty origin array', () => {
            const schema = { tag: 'Image', key: 'imageKey', origin: [] }
            expect(isSchemaImage(schema)).toBe(true)
        })

        it('should return false for invalid SchemaImageTag with wrong tag', () => {
            const schema = { tag: 'Invalid', key: 'imageKey', fileURL: 'http://example.com/image.png' }
            expect(isSchemaImage(schema)).toBe(false)
        })

        it('should return false for SchemaImageTag missing key', () => {
            const schema = { tag: 'Image', fileURL: 'http://example.com/image.png' }
            expect(isSchemaImage(schema)).toBe(false)
        })

        it('should return false for SchemaImageTag missing tag', () => {
            const schema = { key: 'imageKey', fileURL: 'http://example.com/image.png' }
            expect(isSchemaImage(schema)).toBe(false)
        })
    })
})