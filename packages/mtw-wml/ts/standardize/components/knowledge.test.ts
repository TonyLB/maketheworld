import { Schema, schemaToWML } from "../../schema"
import { isSchemaDescription, isSchemaName, isSchemaString } from "../../schema/baseClasses"
import { deIndentWML } from "../../schema/utils"
import { treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { StandardKnowledgeData } from "./dataTypes/knowledge"
import StandardKnowledge from './knowledge'
import { mergeTest } from "./utils/testing"
import StandardReference from "./reference"

describe('StandardKnowledge class', () => {

    it('should construct StandardKnowledge from WML', () => {
        const testSource = deIndentWML(`
            <Knowledge key=(test)><Example key=(base) /></Knowledge>
        `)
        const testKnowledge = new StandardKnowledge(testSource)
        expect(testKnowledge.key).toEqual('test')
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
    
})