import { Schema, schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { StandardKnowledgeData } from "./dataTypes/knowledge"
import StandardKnowledge from './knowledge'
import { mergeTest } from "./utils/testing"
import StandardReference, { StandardKey } from "./reference"

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
    
})