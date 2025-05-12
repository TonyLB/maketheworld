import { diffStandardReferenceList, StandardReference, StandardReferenceRemove } from './reference';
import { deIndentWML } from '../../schema/utils';
import { Schema, schemaToWML } from '../../schema';
import { StandardReferenceData } from './dataTypes/reference';

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

    it('should merge correctly', () => {
        expect(schemaToWML(new StandardReference('<Variable key=(test) />')?.merge(new StandardReference('<Variable key=(test) />'))?.schema ?? [])).toEqual(deIndentWML('<Variable key=(test) />'))
    })

    it('should correctly parse a StandardReferenceRemove', () => {
        const testReferenceData = {
            tag: 'Remove',
            component: {
                tag: 'Variable',
                key: 'test'
            }
        }
        const testVariableRemove = new StandardReference(testReferenceData)
        expect(testVariableRemove.tag).toEqual('Remove')
        expect(testVariableRemove._payload).toBeInstanceOf(StandardReferenceRemove)
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

    it('should retain content references with nested changes', () => {
        const base = [new StandardReference({ key: 'test1', tag: 'Variable' }), new StandardReference({ key: 'test2', tag: 'Variable' })]
        const incoming = [new StandardReference({ key: 'test1', tag: 'Variable' }), new StandardReference({ key: 'test2', tag: 'Variable' })]
        const result = diffStandardReferenceList({ base, incoming, hasDiff: (key) => (key === 'test1') })
        expect(result.map((reference) => (reference.toJSON()))).toEqual([{ key: 'test1', tag: 'Variable' }])
    })
})