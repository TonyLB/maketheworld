import { isSchemaImportMapping, isSchemaImportTag, isSchemaExportTag, isSchemaMetaTag } from './metaData'

describe('metaData tags', () => {
    describe('isSchemaImportMapping', () => {
        it('should return true for valid SchemaImportMapping', () => {
            const schema = { key: 'exampleKey', type: 'Room' }
            expect(isSchemaImportMapping(schema)).toBe(true)
        })

        it('should return false for invalid SchemaImportMapping', () => {
            const schema = { key: 'exampleKey', type: 'Invalid' }
            expect(isSchemaImportMapping(schema)).toBe(false)
        })
    })

    describe('isSchemaImportTag', () => {
        it('should return true for valid SchemaImportTag', () => {
            const schema = { tag: 'Import', from: 'source', mapping: { key1: { key: 'exampleKey', type: 'Room' } } }
            expect(isSchemaImportTag(schema)).toBe(true)
        })

        it('should return false for invalid SchemaImportTag', () => {
            const schema = { tag: 'Invalid', from: 'source', mapping: { key1: { key: 'exampleKey', type: 'Room' } } }
            expect(isSchemaImportTag(schema)).toBe(false)
        })

        it('should return false for SchemaImportTag with invalid mapping', () => {
            const schema = { tag: 'Import', from: 'source', mapping: { key1: { key: 'exampleKey', type: 'Invalid' } } }
            expect(isSchemaImportTag(schema)).toBe(false)
        })
    })

    describe('isSchemaExportTag', () => {
        it('should return true for valid SchemaExportTag', () => {
            const schema = { tag: 'Export', mapping: { key1: { key: 'exampleKey', type: 'Room' } } }
            expect(isSchemaExportTag(schema)).toBe(true)
        })

        it('should return false for invalid SchemaExportTag', () => {
            const schema = { tag: 'Invalid', mapping: { key1: { key: 'exampleKey', type: 'Room' } } }
            expect(isSchemaExportTag(schema)).toBe(false)
        })

        it('should return false for SchemaExportTag with invalid mapping', () => {
            const schema = { tag: 'Export', mapping: { key1: { key: 'exampleKey', type: 'Invalid' } } }
            expect(isSchemaExportTag(schema)).toBe(false)
        })
    })

    describe('isSchemaMetaTag', () => {
        it('should return true for valid SchemaMetaTag', () => {
            const schema = { tag: 'Meta', key: 'exampleKey', time: 123456789 }
            expect(isSchemaMetaTag(schema)).toBe(true)
        })

        it('should return false for invalid SchemaMetaTag', () => {
            const schema = { tag: 'Invalid', key: 'exampleKey', time: 123456789 }
            expect(isSchemaMetaTag(schema)).toBe(false)
        })

        it('should return false for SchemaMetaTag missing key', () => {
            const schema = { tag: 'Meta', time: 123456789 }
            expect(isSchemaMetaTag(schema)).toBe(false)
        })

        it('should return false for SchemaMetaTag missing time', () => {
            const schema = { tag: 'Meta', key: 'exampleKey' }
            expect(isSchemaMetaTag(schema)).toBe(false)
        })
    })
})