import { Schema, schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { StandardFeatureData } from "./dataTypes/feature"
import StandardFeature from './feature'
import { mergeTest } from "./utils/testing"
import StandardReference from "../keys/reference"
import { StandardKey } from "../keys/key"

describe('StandardFeature class', () => {

    it('should construct StandardFeature from WML', () => {
        const testSource = deIndentWML(`
            <Feature key=(test)><Example key=(base) /></Feature>
        `)
        const testFeature = new StandardFeature(testSource)
        expect(testFeature.key).toEqual('test')
        expect(schemaToWML([testFeature.schema])).toEqual(testSource)
    })

    it('should construct StandardFeature from WML with ShortName', () => {
        const testSource = deIndentWML(`
            <Feature key=(test)>
                <ShortName>Test Feature</ShortName>
                <Example key=(base) />
            </Feature>
        `)
        const testFeature = new StandardFeature(testSource)
        expect(testFeature.key).toEqual('test')
        expect(testFeature.shortName?.toJSON()).toEqual('Test Feature')
        expect(schemaToWML([testFeature.schema])).toEqual(testSource)
    })

    it('should construct StandardFeature from schema', () => {
        const schema = new Schema()
        const testSource = deIndentWML(`
            <Feature key=(test)><Example key=(base) /></Feature>
        `)
        schema.loadWML(testSource)
        const testFeature = new StandardFeature(schema.schema[0])
        expect(testFeature.key).toEqual('test')
        expect(schemaToWML([testFeature.schema])).toEqual(testSource)
    })

    it('should construct StandardFeature from StandardFeatureData', () => {
        const testFeatureData: StandardFeatureData = {
            key: 'test',
            tag: 'Feature',
            examples: [{ key: 'Example1', tag: 'Example' }]
        }
        const testFeature = new StandardFeature(testFeatureData)
        expect(testFeature.key).toEqual('test')
        expect(testFeature.toJSON()).toEqual(testFeatureData)
    })

    it('should construct StandardFeature from StandardFeatureData with shortName', () => {
        const testFeatureData: StandardFeatureData = {
            key: 'test',
            tag: 'Feature',
            shortName: 'Test Feature',
            examples: [{ key: 'Example1', tag: 'Example' }]
        }
        const testFeature = new StandardFeature(testFeatureData)
        expect(testFeature.key).toEqual('test')
        expect(testFeature.shortName?.toJSON()).toEqual('Test Feature')
        expect(testFeature.toJSON()).toEqual(testFeatureData)
    })

    it('should merge correctly', () => {
        expect(mergeTest(
            `<Feature key=(testFeature)>
                <Example key=(Example1) />
            </Feature>`,
            StandardFeature,
            `<Feature key=(testFeature)>
                <Example key=(Example2) />
            </Feature>`
        )).toEqual(deIndentWML(`
            <Feature key=(testFeature)>
                <Example key=(Example1) />
                <Example key=(Example2) />
            </Feature>
        `))
    })

    it('should merge shortName correctly', () => {
        expect(mergeTest(
            `<Feature key=(testFeature)>
                <ShortName>Original</ShortName>
            </Feature>`,
            StandardFeature,
            `<Feature key=(testFeature)>
                <Replace><ShortName>Original</ShortName></Replace>
                <With><ShortName>Updated</ShortName></With>
            </Feature>`
        )).toEqual(deIndentWML(`
            <Feature key=(testFeature)><ShortName>Updated</ShortName></Feature>
        `))
    })

    it('should treat undefined and empty shortName as equal', () => {
        const withoutShortName = new StandardFeature({
            tag: 'Feature',
            key: 'test',
            examples: [{ tag: 'Example', key: 'ex1' }]
        })
        const withEmptyShortName = new StandardFeature({
            tag: 'Feature',
            key: 'test',
            shortName: '',
            examples: [{ tag: 'Example', key: 'ex1' }]
        })

        expect(withoutShortName.equals(withEmptyShortName)).toBe(true)
        expect(withEmptyShortName.equals(withoutShortName)).toBe(true)
    })

    it('should throw on unconsumed child tags', () => {
        const testSource = deIndentWML(`
            <Feature key=(testFeature)>
                <Example key=(Example1) />
                <Map />
            </Feature>
        `)
        expect(() => new StandardFeature(testSource)).toThrow(/Unconsumed child tags:/)
        expect(() => new StandardFeature(testSource)).toThrow(/Map/)
    })


    it('should correctly add an example reference to a feature', () => {
        const test = new StandardFeature(`
            <Feature key=(testFeature)>
                <Example uuid=(Example1) />
            </Feature>
        `)
        const example = new StandardKey("EXAMPLE#Example2")
        const added = test.withChild(new StandardReference(example))
        expect(schemaToWML([added.schema])).toEqual(deIndentWML(`
            <Feature key=(testFeature)>
                <Example uuid=(Example1) />
                <Example uuid=(Example2) />
            </Feature>
        `))
    })

    it('should diff shortName correctly', () => {
        const testFeature = new StandardFeature(`
            <Feature key=(test)>
                <ShortName>Original</ShortName>
            </Feature>
        `)
        const testFeature2 = new StandardFeature(`
            <Feature key=(test)>
                <ShortName>Updated</ShortName>
            </Feature>
        `)
        const diff = testFeature.diff(testFeature2)
        expect(diff).toBeDefined()
        expect(schemaToWML([diff!.schema])).toEqual(deIndentWML(`
            <Feature key=(test)>
                <Replace><ShortName>Original</ShortName></Replace>
                <With><ShortName>Updated</ShortName></With>
            </Feature>
        `))
    })

    describe('assureReferences method', () => {
        it('should return unchanged feature when children array is empty', () => {
            const feature = new StandardFeature({ tag: 'Feature', key: 'test' })
            const { payload: result, inlineRemainder } = feature._payload.assureReferences([])
            
            expect(result.examples.payload.length).toBe(0)
            expect(inlineRemainder).toEqual([])
            // Verify it's a clone (original unchanged)
            expect(feature._payload.examples.payload.length).toBe(0)
        })
        
        it('should add children with ref={0} when they do not exist', () => {
            const feature = new StandardFeature({ tag: 'Feature', key: 'test' })
            const exampleRef = new StandardReference({ tag: 'Example', key: 'ex1' })
            
            const { payload: result } = feature._payload.assureReferences([exampleRef])
            
            // Verify reference was added with ref={0}
            expect(result.examples.payload.length).toBe(1)
            expect(result.examples.payload[0].ref).toBe(0)
            expect(result.examples.payload[0].sameKey(exampleRef)).toBe(true)
        })
        
        it('should leave existing references with non-zero ref unchanged', () => {
            const feature = new StandardFeature(deIndentWML(`
                <Feature key=(test)>
                    <Example key=(ex1) />
                </Feature>
            `))
            const exampleRef = new StandardReference({ tag: 'Example', key: 'ex1' })
            
            const { payload: result } = feature._payload.assureReferences([exampleRef])
            
            // Verify existing reference was left unchanged
            expect(result.examples.payload.length).toBe(1)
            expect(result.examples.payload[0].ref).toBe(1) // Original ref value (default)
        })
        
        it('should handle mixed scenarios (some exist, some do not)', () => {
            const feature = new StandardFeature(deIndentWML(`
                <Feature key=(test)>
                    <Example key=(existingEx) />
                </Feature>
            `))
            const existingExample = new StandardReference({ tag: 'Example', key: 'existingEx' })
            const newExample = new StandardReference({ tag: 'Example', key: 'newEx' })
            
            const { payload: result } = feature._payload.assureReferences([existingExample, newExample])
            
            // Existing example should be unchanged
            expect(result.examples.payload.length).toBe(2)
            const existingExInResult = result.examples.payload.find(ref => ref.sameKey(existingExample))
            expect(existingExInResult?.ref).toBe(1) // Original ref value
            
            // New example should be added with ref={0}
            const newExInResult = result.examples.payload.find(ref => ref.sameKey(newExample))
            expect(newExInResult?.ref).toBe(0)
        })
        
        it('should return a clone without mutating the original', () => {
            const feature = new StandardFeature({ tag: 'Feature', key: 'test' })
            const originalExamplesLength = feature._payload.examples.payload.length
            const exampleRef = new StandardReference({ tag: 'Example', key: 'ex1' })
            
            const { payload: result } = feature._payload.assureReferences([exampleRef])
            
            // Original should be unchanged
            expect(feature._payload.examples.payload.length).toBe(originalExamplesLength)
            // Result should have the new reference
            expect(result.examples.payload.length).toBe(1)
            // They should be different objects
            expect(result).not.toBe(feature._payload)
        })
        
        it('should be idempotent (calling multiple times with same children produces same result)', () => {
            const feature = new StandardFeature({ tag: 'Feature', key: 'test' })
            const exampleRef = new StandardReference({ tag: 'Example', key: 'ex1' })
            
            const { payload: firstPayload } = feature._payload.assureReferences([exampleRef])
            const { payload: secondPayload } = firstPayload.assureReferences([exampleRef])
            
            // Both calls should produce the same result
            expect(firstPayload.examples.payload.length).toBe(1)
            expect(secondPayload.examples.payload.length).toBe(1)
            expect(firstPayload.examples.payload[0].sameKey(secondPayload.examples.payload[0])).toBe(true)
            expect(firstPayload.examples.payload[0].ref).toBe(0)
            expect(secondPayload.examples.payload[0].ref).toBe(0)
        })
        
        it('should dispatch children to correct bucket based on tag', () => {
            const feature = new StandardFeature({ tag: 'Feature', key: 'test' })
            const exampleRef = new StandardReference({ tag: 'Example', key: 'ex1' })
            
            const { payload: result } = feature._payload.assureReferences([exampleRef])
            
            // Verify reference went to the correct bucket
            expect(result.examples.payload.length).toBe(1)
            expect(result.examples.payload[0].sameKey(exampleRef)).toBe(true)
        })
        
        it('should put non-bucket children in inlineRemainder', () => {
            const feature = new StandardFeature({ tag: 'Feature', key: 'test' })
            const lensRef = new StandardReference({ tag: 'Lens', key: 'lens1' })
            const exampleRef = new StandardReference({ tag: 'Example', key: 'ex1' })
            
            const { payload: result, inlineRemainder } = feature._payload.assureReferences([lensRef, exampleRef])
            
            // Example goes to bucket
            expect(result.examples.payload.length).toBe(1)
            expect(result.examples.payload[0].sameKey(exampleRef)).toBe(true)
            // Lens goes to remainder
            expect(inlineRemainder.length).toBe(1)
            expect(inlineRemainder[0].tag).toBe('Lens')
            expect(inlineRemainder[0].sameKey(lensRef)).toBe(true)
            expect(inlineRemainder[0].ref).toBe(0)
        })
    })

    describe('removeReferences method', () => {
        it('should remove matching references from examples bucket', () => {
            const feature = new StandardFeature(deIndentWML(`
                <Feature key=(test)>
                    <Example key=(ex1) />
                    <Example key=(ex2) />
                </Feature>
            `))
            const exampleRef = new StandardReference({ tag: 'Example', key: 'ex1' })
            
            const result = feature._payload.removeReferences([exampleRef])
            
            // Verify matching reference was removed
            expect(result.examples.payload.length).toBe(1)
            expect(result.examples.payload[0].sameKey(new StandardReference({ tag: 'Example', key: 'ex2' }))).toBe(true)
        })
        
        it('should return a clone without mutating the original', () => {
            const feature = new StandardFeature(deIndentWML(`
                <Feature key=(test)>
                    <Example key=(ex1) />
                </Feature>
            `))
            const originalExamplesLength = feature._payload.examples.payload.length
            const exampleRef = new StandardReference({ tag: 'Example', key: 'ex1' })
            
            const result = feature._payload.removeReferences([exampleRef])
            
            // Original should be unchanged
            expect(feature._payload.examples.payload.length).toBe(originalExamplesLength)
            // Result should have the reference removed
            expect(result.examples.payload.length).toBe(0)
            // They should be different objects
            expect(result).not.toBe(feature._payload)
        })
    })
    
})