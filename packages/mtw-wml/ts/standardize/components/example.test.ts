import { Schema, schemaToWML } from "../../schema"
import { isSchemaDescription, isSchemaName, isSchemaString } from "../../schema/baseClasses"
import { deIndentWML } from "../../schema/utils"
import { treeNodeTypeguard } from "../../tree/baseClasses"
import { StandardExampleData } from "./dataTypes/example"
import StandardExample from './example'
import { mergeTest } from "./utils/testing"

describe('StandardExample class', () => {

    it('should construct StandardExample from WML', () => {
        const testSource = deIndentWML(`
            <Example key=(test)>
                <Name>Name Test</Name>
                <Summary>Summary Test</Summary>
                <Description>Description Test</Description>
            </Example>
        `)
        const testExample = new StandardExample(testSource)
        expect(testExample.key).toEqual('test')
        expect(testExample.name).toEqual([{ data: { tag: 'String', value: 'Name Test' }, children: [] }])
        expect(testExample.summary).toEqual([{ data: { tag: 'String', value: 'Summary Test' }, children: [] }])
        expect(testExample.description).toEqual([{ data: { tag: 'String', value: 'Description Test' }, children: [] }])
        expect(schemaToWML([testExample.schema])).toEqual(testSource)
    })

    it('should construct StandardExample from schema', () => {
        const schema = new Schema()
        const testSource = deIndentWML(`
            <Example key=(test)>
                <Name>Name Test</Name>
                <Summary>Summary Test</Summary>
                <Description>Description Test</Description>
            </Example>
        `)
        schema.loadWML(testSource)
        const testExample = new StandardExample(schema.schema[0])
        expect(testExample.key).toEqual('test')
        expect(testExample.name).toEqual([{ data: { tag: 'String', value: 'Name Test' }, children: [] }])
        expect(testExample.summary).toEqual([{ data: { tag: 'String', value: 'Summary Test' }, children: [] }])
        expect(testExample.description).toEqual([{ data: { tag: 'String', value: 'Description Test' }, children: [] }])
        expect(schemaToWML([testExample.schema])).toEqual(testSource)
    })

    it('should construct StandardExample from StandardExampleData', () => {
        const testExampleData: StandardExampleData = {
            key: 'test',
            tag: 'Example',
            name: [{ data: { tag: 'String', value: 'Name Test' }, children: [] }],
            summary: [{ data: { tag: 'String', value: 'Summary Test' }, children: [] }],
            description: [{ data: { tag: 'String', value: 'Description Test' }, children: [] }],
        }
        const testExample = new StandardExample(testExampleData)
        expect(testExample.key).toEqual('test')
        expect(testExample.name).toEqual([{ data: { tag: 'String', value: 'Name Test' }, children: [] }])
        expect(testExample.summary).toEqual([{ data: { tag: 'String', value: 'Summary Test' }, children: [] }])
        expect(testExample.description).toEqual([{ data: { tag: 'String', value: 'Description Test' }, children: [] }])
        expect(testExample.toJSON()).toEqual(testExampleData)
    })

    it('should merge correctly', () => {
        expect(mergeTest(
            `<Example key=(testExample)>
                <Name>Lobby</Name>
                <Summary>Summary Text</Summary>
                <Description>A plain lobby.</Description>
            </Example>`,
            StandardExample,
            `<Example key=(testExample)>
                <Replace><Name>Lobby</Name></Replace><With><Name>Spooky Lobby</Name></With>
                <Summary><Remove>Text</Remove></Summary>
                <Description><Space />Shadows cling to the corners of the room.</Description>
            </Example>`
        )).toEqual(deIndentWML(`
            <Example key=(testExample)>
                <Name>Spooky Lobby</Name>
                <Summary>Summary </Summary>
                <Description>
                    A plain lobby. Shadows cling to the corners of the room.
                </Description>
            </Example>
        `))
    })

    it('should map contents correctly', () => {
        const test = new StandardExample(`
            <Example key=(testExample)>
                <Name>Lobby</Name>
                <Summary>Summary</Summary>
                <Description>A plain lobby.</Description>
            </Example>
        `)
        const callback = (tree) => {
            return tree.map((node) => {
                if (treeNodeTypeguard(isSchemaString)(node)) {
                    return { data: { tag: 'String', value: `${node.data.value}Narf!` }, children: [] }
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
            <Example key=(testExample)>
                <Name>LobbyNarf!</Name>
                <Summary>SummaryNarf!</Summary>
                <Description>A plain lobby.Narf!</Description>
            </Example>
        `))
    })
})