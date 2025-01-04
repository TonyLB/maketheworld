import { isSchemaImportMapping, isSchemaImport, isSchemaExport, isSchemaMeta } from './metaData'

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

    describe('isSchemaImport', () => {
        it('should return true for valid SchemaImportTag', () => {
            const schema = { tag: 'Import', from: 'source', mapping: { key1: { key: 'exampleKey', type: 'Room' } } }
            expect(isSchemaImport(schema)).toBe(true)
        })

        it('should return false for invalid SchemaImportTag', () => {
            const schema = { tag: 'Invalid', from: 'source', mapping: { key1: { key: 'exampleKey', type: 'Room' } } }
            expect(isSchemaImport(schema)).toBe(false)
        })

        it('should return false for SchemaImportTag with invalid mapping', () => {
            const schema = { tag: 'Import', from: 'source', mapping: { key1: { key: 'exampleKey', type: 'Invalid' } } }
            expect(isSchemaImport(schema)).toBe(false)
        })
    })

    describe('isSchemaExport', () => {
        it('should return true for valid SchemaExportTag', () => {
            const schema = { tag: 'Export', mapping: { key1: { key: 'exampleKey', type: 'Room' } } }
            expect(isSchemaExport(schema)).toBe(true)
        })

        it('should return false for invalid SchemaExportTag', () => {
            const schema = { tag: 'Invalid', mapping: { key1: { key: 'exampleKey', type: 'Room' } } }
            expect(isSchemaExport(schema)).toBe(false)
        })

        it('should return false for SchemaExportTag with invalid mapping', () => {
            const schema = { tag: 'Export', mapping: { key1: { key: 'exampleKey', type: 'Invalid' } } }
            expect(isSchemaExport(schema)).toBe(false)
        })
    })

    describe('isSchemaMeta', () => {
        it('should return true for valid SchemaMetaTag', () => {
            const schema = { tag: 'Meta', key: 'exampleKey', time: 123456789 }
            expect(isSchemaMeta(schema)).toBe(true)
        })

        it('should return false for invalid SchemaMetaTag', () => {
            const schema = { tag: 'Invalid', key: 'exampleKey', time: 123456789 }
            expect(isSchemaMeta(schema)).toBe(false)
        })

        it('should return false for SchemaMetaTag missing key', () => {
            const schema = { tag: 'Meta', time: 123456789 }
            expect(isSchemaMeta(schema)).toBe(false)
        })

        it('should return false for SchemaMetaTag missing time', () => {
            const schema = { tag: 'Meta', key: 'exampleKey' }
            expect(isSchemaMeta(schema)).toBe(false)
        })
    })
})