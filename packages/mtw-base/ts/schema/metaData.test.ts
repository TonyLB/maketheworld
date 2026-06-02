import { isSchemaImportMapping, isSchemaImport } from './metaData'

describe('metaData tags', () => {
    describe('isSchemaImportMapping', () => {
        it('should return true for valid SchemaImportMapping', () => {
            const schema = { key: 'exampleKey', type: 'Room' }
            expect(isSchemaImportMapping(schema)).toBe(true)
        })

        it('should return true for Area SchemaImportMapping', () => {
            const schema = { key: 'world', type: 'Area' }
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

    })
})