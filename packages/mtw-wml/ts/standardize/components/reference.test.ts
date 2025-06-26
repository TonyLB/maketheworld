import { diffStandardReferenceList, StandardKey, StandardReference, StandardReferenceRemove } from './reference';
import { deIndentWML } from '../../schema/utils';
import { Schema, schemaToWML } from '../../schema';
import { StandardReferenceData } from './dataTypes/reference';

describe('StandardKey', () => {
    it('should return a clone for format "both"', () => {
        const refData: StandardReferenceData = { key: 'test', tag: 'Variable', universalKey: 'VARIABLE#1234' }
        const key = new StandardKey(refData)
        const clone = key.toFormat('both')
        expect(clone).not.toBe(key)
        expect(clone.toJSON()).toEqual(key.toJSON())
    })

    it('should strip universalKey for format "key"', () => {
        const refData: StandardReferenceData = { key: 'test', tag: 'Variable', universalKey: 'VARIABLE#1234' }
        const key = new StandardKey(refData)
        const formatted = key.toFormat('key')
        expect(formatted.key).toBe('test')
        expect(formatted.universalKey).toBeUndefined()
        expect(formatted._tag).toBe('Variable')
    })

    it('should strip key for format "universalKey"', () => {
        const refData: StandardReferenceData = { key: 'test', tag: 'Variable', universalKey: 'VARIABLE#1234' }
        const key = new StandardKey(refData)
        const formatted = key.toFormat('universal')
        expect(formatted.key).toBeUndefined()
        expect(formatted.universalKey).toBe('VARIABLE#1234')
        expect(formatted._tag).toBeUndefined()
    })

    it('should not throw if key is missing for format "key"', () => {
        const refData: StandardReferenceData = 'VARIABLE#1234'
        const key = new StandardKey(refData)
        const formatted = key.toFormat('key')
        expect(formatted.key).toBeUndefined()
        expect(formatted.universalKey).toBe('VARIABLE#1234')
    })

    it('should not throw if universalKey is missing for format "universalKey"', () => {
        const refData: StandardReferenceData = { tag: 'Variable', key: 'test' }
        const key = new StandardKey(refData)
        const formatted = key.toFormat('universal')
        expect(formatted.key).toBe('test')
        expect(formatted.tag).toBe('Variable')
        expect(formatted.universalKey).toBeUndefined()
    })
})

describe('StandardReference', () => {
    it('should construct StandardReference from WML', () => {
        const testSource = deIndentWML(`
            <Variable key=(test) />
        `)
        const testVariable = new StandardReference(testSource)
        expect(testVariable.key).toEqual('test')
        expect(testVariable.tag).toEqual('Variable')
        expect(schemaToWML(testVariable.schema)).toEqual(testSource)
    })

    it('should construct StandardReference from schema', () => {
        const schema = new Schema()
        const testSource = deIndentWML(`
            <Variable key=(test) />
        `)
        schema.loadWML(testSource)
        const testVariable = new StandardReference(schema.schema)
        expect(testVariable.key).toEqual('test')
        expect(testVariable.tag).toEqual('Variable')
        expect(schemaToWML(testVariable.schema)).toEqual(testSource)
    })

    it('should construct StandardReference from StandardReferenceData', () => {
        const testReferenceData: StandardReferenceData = {
            key: 'test',
            tag: 'Variable'
        }
        const testVariable = new StandardReference(testReferenceData)
        expect(testVariable.toJSON()).toEqual(testReferenceData)
    })

    it('should correctly return schema for universalKey-only references', () => {
        const testVariable = new StandardReference('EXAMPLE#1234')
        expect(schemaToWML(testVariable.schema)).toEqual(deIndentWML(`
            <Example uuid=(1234) />
        `))
    })

    it('should merge correctly', () => {
        expect(schemaToWML(new StandardReference('<Variable key=(test) />')?.merge(new StandardReference('<Variable key=(test) />'))?.schema ?? [])).toEqual(deIndentWML('<Variable key=(test) />'))
    })

    it('should correctly parse a StandardReferenceRemove', () => {
        const testReferenceData = {
            tag: 'Remove',
            match: {
                tag: 'Variable',
                key: 'test'
            }
        }
        const testVariableRemove = new StandardReference(testReferenceData)
        expect(testVariableRemove.tag).toEqual('Variable')
        expect(testVariableRemove._payload).toBeInstanceOf(StandardReferenceRemove)
    })

    it('should correctly judge equality when only key specified', () => {
        const testReferenceData = {
            tag: 'Variable',
            key: 'test',
            universalKey: 'VARIABLE#1234'
        }
        const testReference = new StandardReference(testReferenceData)
        expect(testReference.equal(new StandardReference({ tag: 'Variable', key: 'test' }))).toBe(true)
    })

    it('should correctly judge equality when only universalKey specified', () => {
        const testReferenceData = {
            tag: 'Variable',
            key: 'test',
            universalKey: 'VARIABLE#1234'
        }
        const testReference = new StandardReference(testReferenceData)
        expect(testReference.equal(new StandardReference({ tag: 'Variable', universalKey: 'VARIABLE#1234' }))).toBe(true)
    })

    it('should correct judge inequality when key differs', () => {
        const testReferenceData = {
            tag: 'Variable',
            key: 'test',
            universalKey: 'VARIABLE#1234'
        }
        const testReference = new StandardReference(testReferenceData)
        expect(testReference.equal(new StandardReference({ tag: 'Variable', key: 'test2', universalKey: 'VARIABLE#1234' }))).toBe(false)
    })

    it('should correct judge inequality when universalKey differs', () => {
        const testReferenceData = {
            tag: 'Variable',
            key: 'test',
            universalKey: 'VARIABLE#1234'
        }
        const testReference = new StandardReference(testReferenceData)
        expect(testReference.equal(new StandardReference({ tag: 'Variable', key: 'test', universalKey: 'VARIABLE#5678' }))).toBe(false)
    })

    it('should correctly judge inequality when tags differ', () => {
        const testReferenceData = {
            tag: 'Variable',
            key: 'test',
            universalKey: 'VARIABLE#1234'
        }
        const testReference = new StandardReference(testReferenceData)
        expect(testReference.equal(new StandardReference({ key: 'test', tag: 'Example' }))).toBe(false)
    })

})

describe('diffStandardReferenceList', () => {
    it('should return empty array when both lists are empty', () => {
        const base: StandardReference[] = []
        const incoming: StandardReference[] = []
        const result = diffStandardReferenceList({ base, incoming })
        expect(result).toEqual([])
    })

    it('should return all removes when incoming list is empty', () => {
        const base = [new StandardReference({ key: 'test1', tag: 'Variable' }), new StandardReference({ key: 'test2', tag: 'Variable' })]
        const incoming: StandardReference[] = []
        const result = diffStandardReferenceList({ base, incoming })
        expect(result.map((reference) => (reference.toJSON()))).toEqual([
            { tag: 'Remove', match: { key: 'test1', tag: 'Variable' } },
            { tag: 'Remove', match: { key: 'test2', tag: 'Variable' } }
        ])
    })

    it('should return all adds when base list is empty', () => {
        const base: StandardReference[] = []
        const incoming = [new StandardReference({ key: 'test1', tag: 'Variable' }), new StandardReference({ key: 'test2', tag: 'Variable' })]
        const result = diffStandardReferenceList({ base, incoming })
        expect(result).toEqual(incoming)
    })

    it('should return correct diff when lists have different elements', () => {
        const base = [new StandardReference({ key: 'test1', tag: 'Variable' }), new StandardReference({ key: 'test2', tag: 'Variable' })]
        const incoming = [new StandardReference({ key: 'test2', tag: 'Variable' }), new StandardReference({ key: 'test3', tag: 'Variable' })]
        const result = diffStandardReferenceList({ base, incoming })
        expect(result.map((reference) => (reference.toJSON()))).toEqual([{ tag: 'Remove', match: { tag: 'Variable', key: 'test1' } }, { tag: 'Variable', key: 'test3'}])
    })

    it('should return empty array when lists are identical', () => {
        const base = [new StandardReference({ key: 'test1', tag: 'Variable' }), new StandardReference({ key: 'test2', tag: 'Variable' })]
        const incoming = [new StandardReference({ key: 'test1', tag: 'Variable' }), new StandardReference({ key: 'test2', tag: 'Variable' })]
        const result = diffStandardReferenceList({ base, incoming })
        expect(result).toEqual([])
    })

})