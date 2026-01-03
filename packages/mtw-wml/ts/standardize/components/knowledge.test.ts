import { Schema, schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { StandardKnowledgeData } from "./dataTypes/knowledge"
import StandardKnowledge from './knowledge'
import { mergeTest } from "./utils/testing"
import StandardReference from "./reference"
import { StandardKey } from "../keys/key"

describe('StandardKnowledge class', () => {

    it('should construct StandardKnowledge from WML', () => {
        const testSource = deIndentWML(`
            <Knowledge uuid=(001) key=(test)><Example key=(base) /></Knowledge>
        `)
        const testKnowledge = new StandardKnowledge(testSource)
        expect(testKnowledge.key).toEqual('test')
        expect(schemaToWML([testKnowledge.schema])).toEqual(testSource)
    })

    it('should construct StandardKnowledge from WML with ShortName', () => {
        const testSource = deIndentWML(`
            <Knowledge key=(test)>
                <ShortName>Test Knowledge</ShortName>
                <Example key=(base) />
            </Knowledge>
        `)
        const testKnowledge = new StandardKnowledge(testSource)
        expect(testKnowledge.key).toEqual('test')
        expect(testKnowledge.shortName?.toJSON()).toEqual('Test Knowledge')
        expect(schemaToWML([testKnowledge.schema])).toEqual(testSource)
    })

    it('should construct StandardKnowledge from schema', () => {
        const schema = new Schema()
        const testSource = deIndentWML(`
            <Knowledge key=(test)><Example key=(base) /></Knowledge>
        `)
        schema.loadWML(testSource)
        const testKnowledge = new StandardKnowledge(schema.schema[0])
        expect(testKnowledge.key).toEqual('test')
        expect(schemaToWML([testKnowledge.schema])).toEqual(testSource)
    })

    it('should construct StandardKnowledge from StandardKnowledgeData', () => {
        const testKnowledgeData: StandardKnowledgeData = {
            key: 'test',
            tag: 'Knowledge',
            examples: [{ key: 'base', tag: 'Example' }]
        }
        const testKnowledge = new StandardKnowledge(testKnowledgeData)
        expect(testKnowledge.key).toEqual('test')
        expect(testKnowledge.toJSON()).toEqual(testKnowledgeData)
    })

    it('should construct StandardKnowledge from StandardKnowledgeData with shortName', () => {
        const testKnowledgeData: StandardKnowledgeData = {
            key: 'test',
            tag: 'Knowledge',
            shortName: 'Test Knowledge',
            examples: [{ key: 'base', tag: 'Example' }]
        }
        const testKnowledge = new StandardKnowledge(testKnowledgeData)
        expect(testKnowledge.key).toEqual('test')
        expect(testKnowledge.shortName?.toJSON()).toEqual('Test Knowledge')
        expect(testKnowledge.toJSON()).toEqual(testKnowledgeData)
    })

    it('should merge correctly', () => {
        expect(mergeTest(
            `<Knowledge key=(testKnowledge)>
                <Example key=(Example1) />
            </Knowledge>`,
            StandardKnowledge,
            `<Knowledge key=(testKnowledge)>
                <Example key=(Example2) />
            </Knowledge>`
        )).toEqual(deIndentWML(`
            <Knowledge key=(testKnowledge)>
                <Example key=(Example1) />
                <Example key=(Example2) />
            </Knowledge>
        `))
    })

    it('should merge shortName correctly', () => {
        expect(mergeTest(
            `<Knowledge key=(testKnowledge)>
                <ShortName>Original</ShortName>
            </Knowledge>`,
            StandardKnowledge,
            `<Knowledge key=(testKnowledge)>
                <Replace><ShortName>Original</ShortName></Replace>
                <With><ShortName>Updated</ShortName></With>
            </Knowledge>`
        )).toEqual(deIndentWML(`
            <Knowledge key=(testKnowledge)><ShortName>Updated</ShortName></Knowledge>
        `))
    })

    it('should correctly add an example reference to knowledge', () => {
        const test = new StandardKnowledge(`
            <Knowledge key=(testKnowledge)>
                <Example uuid=(Example1) />
            </Knowledge>
        `)
        const example = new StandardKey("EXAMPLE#Example2")
        const added = test.withChild(new StandardReference(example))
        expect(schemaToWML([added.schema])).toEqual(deIndentWML(`
            <Knowledge key=(testKnowledge)>
                <Example uuid=(Example1) />
                <Example uuid=(Example2) />
            </Knowledge>
        `))
    })

    it('should diff shortName correctly', () => {
        const testKnowledge = new StandardKnowledge(`
            <Knowledge key=(test)>
                <ShortName>Original</ShortName>
            </Knowledge>
        `)
        const testKnowledge2 = new StandardKnowledge(`
            <Knowledge key=(test)>
                <ShortName>Updated</ShortName>
            </Knowledge>
        `)
        const diff = testKnowledge.diff(testKnowledge2)
        expect(diff).toBeDefined()
        expect(schemaToWML([diff!.schema])).toEqual(deIndentWML(`
            <Knowledge key=(test)>
                <Replace><ShortName>Original</ShortName></Replace>
                <With><ShortName>Updated</ShortName></With>
            </Knowledge>
        `))
    })

    describe('assureReferences method', () => {
        it('should return unchanged knowledge when children array is empty', () => {
            const knowledge = new StandardKnowledge({ tag: 'Knowledge', key: 'test' })
            const result = knowledge._payload.assureReferences([])
            
            expect(result.examples.payload.length).toBe(0)
            // Verify it's a clone (original unchanged)
            expect(knowledge._payload.examples.payload.length).toBe(0)
        })
        
        it('should add children with ref={0} when they do not exist', () => {
            const knowledge = new StandardKnowledge({ tag: 'Knowledge', key: 'test' })
            const exampleRef = new StandardReference({ tag: 'Example', key: 'ex1' })
            
            const result = knowledge._payload.assureReferences([exampleRef])
            
            // Verify reference was added with ref={0}
            expect(result.examples.payload.length).toBe(1)
            expect(result.examples.payload[0].ref).toBe(0)
            expect(result.examples.payload[0].sameKey(exampleRef)).toBe(true)
        })
        
        it('should leave existing references with non-zero ref unchanged', () => {
            const knowledge = new StandardKnowledge(deIndentWML(`
                <Knowledge key=(test)>
                    <Example key=(ex1) />
                </Knowledge>
            `))
            const exampleRef = new StandardReference({ tag: 'Example', key: 'ex1' })
            
            const result = knowledge._payload.assureReferences([exampleRef])
            
            // Verify existing reference was left unchanged
            expect(result.examples.payload.length).toBe(1)
            expect(result.examples.payload[0].ref).toBe(1) // Original ref value (default)
        })
        
        it('should handle mixed scenarios (some exist, some do not)', () => {
            const knowledge = new StandardKnowledge(deIndentWML(`
                <Knowledge key=(test)>
                    <Example key=(existingEx) />
                </Knowledge>
            `))
            const existingExample = new StandardReference({ tag: 'Example', key: 'existingEx' })
            const newExample = new StandardReference({ tag: 'Example', key: 'newEx' })
            
            const result = knowledge._payload.assureReferences([existingExample, newExample])
            
            // Existing example should be unchanged
            expect(result.examples.payload.length).toBe(2)
            const existingExInResult = result.examples.payload.find(ref => ref.sameKey(existingExample))
            expect(existingExInResult?.ref).toBe(1) // Original ref value
            
            // New example should be added with ref={0}
            const newExInResult = result.examples.payload.find(ref => ref.sameKey(newExample))
            expect(newExInResult?.ref).toBe(0)
        })
        
        it('should return a clone without mutating the original', () => {
            const knowledge = new StandardKnowledge({ tag: 'Knowledge', key: 'test' })
            const originalExamplesLength = knowledge._payload.examples.payload.length
            const exampleRef = new StandardReference({ tag: 'Example', key: 'ex1' })
            
            const result = knowledge._payload.assureReferences([exampleRef])
            
            // Original should be unchanged
            expect(knowledge._payload.examples.payload.length).toBe(originalExamplesLength)
            // Result should have the new reference
            expect(result.examples.payload.length).toBe(1)
            // They should be different objects
            expect(result).not.toBe(knowledge._payload)
        })
        
        it('should be idempotent (calling multiple times with same children produces same result)', () => {
            const knowledge = new StandardKnowledge({ tag: 'Knowledge', key: 'test' })
            const exampleRef = new StandardReference({ tag: 'Example', key: 'ex1' })
            
            const firstCall = knowledge._payload.assureReferences([exampleRef])
            const secondCall = firstCall.assureReferences([exampleRef])
            
            // Both calls should produce the same result
            expect(firstCall.examples.payload.length).toBe(1)
            expect(secondCall.examples.payload.length).toBe(1)
            expect(firstCall.examples.payload[0].sameKey(secondCall.examples.payload[0])).toBe(true)
            expect(firstCall.examples.payload[0].ref).toBe(0)
            expect(secondCall.examples.payload[0].ref).toBe(0)
        })
        
        it('should dispatch children to correct bucket based on tag', () => {
            const knowledge = new StandardKnowledge({ tag: 'Knowledge', key: 'test' })
            const exampleRef = new StandardReference({ tag: 'Example', key: 'ex1' })
            
            const result = knowledge._payload.assureReferences([exampleRef])
            
            // Verify reference went to the correct bucket
            expect(result.examples.payload.length).toBe(1)
            expect(result.examples.payload[0].sameKey(exampleRef)).toBe(true)
        })
        
        it('should ignore children with incorrect tag', () => {
            const knowledge = new StandardKnowledge({ tag: 'Knowledge', key: 'test' })
            const featureRef = new StandardReference({ tag: 'Feature', key: 'feat1' })
            const exampleRef = new StandardReference({ tag: 'Example', key: 'ex1' })
            
            const result = knowledge._payload.assureReferences([featureRef, exampleRef])
            
            // Only Example should be added
            expect(result.examples.payload.length).toBe(1)
            expect(result.examples.payload[0].sameKey(exampleRef)).toBe(true)
        })
    })

    describe('removeReferences method', () => {
        it('should remove matching references from examples bucket', () => {
            const knowledge = new StandardKnowledge(deIndentWML(`
                <Knowledge key=(test)>
                    <Example key=(ex1) />
                    <Example key=(ex2) />
                </Knowledge>
            `))
            const exampleRef = new StandardReference({ tag: 'Example', key: 'ex1' })
            
            const result = knowledge._payload.removeReferences([exampleRef])
            
            // Verify matching reference was removed
            expect(result.examples.payload.length).toBe(1)
            expect(result.examples.payload[0].sameKey(new StandardReference({ tag: 'Example', key: 'ex2' }))).toBe(true)
        })
        
        it('should return a clone without mutating the original', () => {
            const knowledge = new StandardKnowledge(deIndentWML(`
                <Knowledge key=(test)>
                    <Example key=(ex1) />
                </Knowledge>
            `))
            const originalExamplesLength = knowledge._payload.examples.payload.length
            const exampleRef = new StandardReference({ tag: 'Example', key: 'ex1' })
            
            const result = knowledge._payload.removeReferences([exampleRef])
            
            // Original should be unchanged
            expect(knowledge._payload.examples.payload.length).toBe(originalExamplesLength)
            // Result should have the reference removed
            expect(result.examples.payload.length).toBe(0)
            // They should be different objects
            expect(result).not.toBe(knowledge._payload)
        })
    })
    
})