import { StandardReference } from './reference';
import { StandardReferenceData } from './dataTypes';
import { deIndentWML } from '../../schema/utils';
import { Schema, schemaToWML } from '../../schema';

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
});