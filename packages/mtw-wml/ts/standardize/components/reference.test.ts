import { diffStandardReferenceList, StandardReference } from './reference';
import { StandardReferenceData } from './dataTypes';
import { deIndentWML } from '../../schema/utils';
import { Schema, schemaToWML } from '../../schema';
import { StandardRemove } from './edits';

describe('StandardReference', () => {
    it('should construct StandardReference from WML', () => {
        const testSource = deIndentWML(`
            <Variable key=(test) />
        `)
        const testVariable = new StandardReference(testSource)
        expect(testVariable.key).toEqual('test')
        expect(testVariable.tag).toEqual('Variable')
        expect(schemaToWML([testVariable.schema])).toEqual(testSource)
    })

    it('should construct StandardReference from schema', () => {
        const schema = new Schema()
        const testSource = deIndentWML(`
            <Variable key=(test) />
        `)
        schema.loadWML(testSource)
        const testVariable = new StandardReference(schema.schema[0])
        expect(testVariable.key).toEqual('test')
        expect(testVariable.tag).toEqual('Variable')
        expect(schemaToWML([testVariable.schema])).toEqual(testSource)
    })

    it('should construct StandardReference from StandardReferenceData', () => {
        const testReferenceData: StandardReferenceData = {
            key: 'test',
            tag: 'Variable'
        }
        const testVariable = new StandardReference(testReferenceData)
        expect(testVariable.toJSON()).toEqual(testReferenceData)
    })

    it('should merge correctly', () => {
        expect(schemaToWML([new StandardReference('<Variable key=(test) />').merge(new StandardReference('<Variable key=(test) />')).schema])).toEqual(deIndentWML('<Variable key=(test) />'))
    })
})

describe('diffStandardReferenceList', () => {
    it('should return empty array when both lists are empty', () => {
        const base: StandardReference[] = []
        const incoming: StandardReference[] = []
        const result = diffStandardReferenceList(base, incoming)
        expect(result).toEqual([])
    })

    it('should return all removes when incoming list is empty', () => {
        const base = [new StandardReference({ key: 'test1', tag: 'Variable' }), new StandardReference({ key: 'test2', tag: 'Variable' })]
        const incoming: StandardReference[] = []
        const result = diffStandardReferenceList(base, incoming)
        expect(result).toEqual([new StandardRemove(base[0]), new StandardRemove(base[1])])
    })

    it('should return all adds when base list is empty', () => {
        const base: StandardReference[] = []
        const incoming = [new StandardReference({ key: 'test1', tag: 'Variable' }), new StandardReference({ key: 'test2', tag: 'Variable' })]
        const result = diffStandardReferenceList(base, incoming)
        expect(result).toEqual(incoming)
    })

    it('should return correct diff when lists have different elements', () => {
        const base = [new StandardReference({ key: 'test1', tag: 'Variable' }), new StandardReference({ key: 'test2', tag: 'Variable' })]
        const incoming = [new StandardReference({ key: 'test2', tag: 'Variable' }), new StandardReference({ key: 'test3', tag: 'Variable' })]
        const result = diffStandardReferenceList(base, incoming)
        expect(result).toEqual([new StandardRemove(base[0]), incoming[1]])
    })

    it('should return empty array when lists are identical', () => {
        const base = [new StandardReference({ key: 'test1', tag: 'Variable' }), new StandardReference({ key: 'test2', tag: 'Variable' })]
        const incoming = [new StandardReference({ key: 'test1', tag: 'Variable' }), new StandardReference({ key: 'test2', tag: 'Variable' })]
        const result = diffStandardReferenceList(base, incoming)
        expect(result).toEqual([])
    })
})