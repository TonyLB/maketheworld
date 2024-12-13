import { Schema, schemaToWML } from "../../schema"
import { isSchemaDescription, isSchemaName } from "../../schema/baseClasses"
import { deIndentWML } from "../../schema/utils"
import { treeNodeTypeguard } from "../../tree/baseClasses"
import { StandardKnowledgeData } from "./dataTypes/knowledge"
import StandardKnowledge from './knowledge'
import { mergeTest } from "./utils/testing"

describe('StandardKnowledge class', () => {

    it('should construct StandardKnowledge from WML', () => {
        const testSource = deIndentWML(`
            <Knowledge key=(test)>
                <Name>Name Test</Name>
                <Description>Description Test</Description>
            </Knowledge>
        `)
        const testKnowledge = new StandardKnowledge(testSource)
        expect(testKnowledge.key).toEqual('test')
        expect(testKnowledge.name).toEqual({ data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name Test' }, children: [] }] })
        expect(testKnowledge.description).toEqual({ data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Description Test' }, children: [] }] })
        expect(schemaToWML([testKnowledge.schema])).toEqual(testSource)
    })

    it('should construct StandardKnowledge from schema', () => {
        const schema = new Schema()
        const testSource = deIndentWML(`
            <Knowledge key=(test)>
                <Name>Name Test</Name>
                <Description>Description Test</Description>
            </Knowledge>
        `)
        schema.loadWML(testSource)
        const testKnowledge = new StandardKnowledge(schema.schema[0])
        expect(testKnowledge.key).toEqual('test')
        expect(testKnowledge.name).toEqual({ data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name Test' }, children: [] }] })
        expect(testKnowledge.description).toEqual({ data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Description Test' }, children: [] }] })
        expect(schemaToWML([testKnowledge.schema])).toEqual(testSource)
    })

    it('should construct StandardKnowledge from StandardKnowledgeData', () => {
        const testKnowledgeData: StandardKnowledgeData = {
            key: 'test',
            tag: 'Knowledge',
            name: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name Test' }, children: [] }] },
            description: { data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Description Test' }, children: [] }] },
        }
        const testKnowledge = new StandardKnowledge(testKnowledgeData)
        expect(testKnowledge.key).toEqual('test')
        expect(testKnowledge.name).toEqual({ data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name Test' }, children: [] }] })
        expect(testKnowledge.description).toEqual({ data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Description Test' }, children: [] }] })
        expect(testKnowledge.toJSON()).toEqual(testKnowledgeData)
    })

    it('should merge correctly', () => {
        expect(mergeTest(
            `<Knowledge key=(testKnowledge)>
                <Name>Lobby</Name>
                <Description>A plain lobby.</Description>
            </Knowledge>`,
            StandardKnowledge,
            `<Knowledge key=(testKnowledge)>
                <Replace><Name>Lobby</Name></Replace><With><Name>Spooky Lobby</Name></With>
                <Description><Space />Shadows cling to the corners of the room.</Description>
            </Knowledge>`
        )).toEqual(deIndentWML(`
            <Knowledge key=(testKnowledge)>
                <Name>Spooky Lobby</Name>
                <Description>
                    A plain lobby.<Space />Shadows cling to the corners of the room.
                </Description>
            </Knowledge>
        `))
    })

    it('should map contents correctly', () => {
        const test = new StandardKnowledge(`
            <Knowledge key=(testKnowledge)>
                <Name>Religion</Name>
                <Description>A set of beliefs about the divine.</Description>
            </Knowledge>
        `)
        const callback = (tree) => {
            return tree.map((node) => {
                if (treeNodeTypeguard(isSchemaDescription)(node) || treeNodeTypeguard(isSchemaName)(node)) {
                    return {
                        ...node,
                        children: [...node.children, { data: { tag: 'String', value: 'Narf!' }, children: [] }]
                    }
                }
                else {
                    return {
                        ...node,
                        children: callback(node.children)
                    }
                }
            })
        }
        expect(schemaToWML([test.mapContents(callback).schema])).toEqual(deIndentWML(`
            <Knowledge key=(testKnowledge)>
                <Name>ReligionNarf!</Name>
                <Description>A set of beliefs about the divine.Narf!</Description>
            </Knowledge>
        `))
    })
    
})