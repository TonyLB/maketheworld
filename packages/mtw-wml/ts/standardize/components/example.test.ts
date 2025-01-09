import { Schema, schemaToWML } from "../../schema"
import { isSchemaString } from "../../schema/baseClasses"
import { deIndentWML } from "../../schema/utils"
import { treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { StandardExampleData } from "./dataTypes/example"
import StandardExample from './example'
import { mergeTest } from "./utils/testing"
import { StandardReplace, StandardRemove } from "./edits"

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
                <Summary><Remove><Space />Text</Remove></Summary>
                <Description><Space />Shadows cling to the corners of the room.</Description>
            </Example>`
        )).toEqual(deIndentWML(`
            <Example key=(testExample)>
                <Name>Spooky Lobby</Name>
                <Summary>Summary</Summary>
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

    it('should return condensed RenderSchema on NDJSON', () => {
        const test = new StandardExample(`
            <Example key=(testExample)>
                <Name>Lobby<If {active}><Space />(lit)</If></Name>
                <Summary>Summary</Summary>
                <Description>A plain lobby.</Description>
            </Example>
        `)
        expect(test.toNDJSON()).toEqual({
            key: 'testExample',
            tag: 'Example',
            name: ['Lobby', { data: { tag: 'If' }, children: [{ data: { tag: 'Statement', if: 'active' }, children: [{ data: { tag: 'Space' }, children: [] }, '(lit)'] }] }],
            summary: ['Summary'],
            description: ['A plain lobby.']
        })
    })

    it('should diff identical components correctly', () => {
        const testExample = new StandardExample({
            key: 'test',
            tag: 'Example',
            name: ['Name Test'],
            summary: ['Summary Test'],
            description: ['Description Test'],
        })
        expect(testExample.diff(testExample)).toBeUndefined()
    })

    it('should correctly diff removing a field', () => {
        const testExample = new StandardExample({
            key: 'test',
            tag: 'Example',
            name: ['Name Test'],
            summary: ['Summary Test'],
            description: ['Description Test'],
        })
        const testExample2 = new StandardExample({
            key: 'test',
            tag: 'Example',
            name: ['Name Test'],
            summary: ['Summary Test'],
        })
        expect(testExample.diff(testExample2)).toEqual(new StandardExample({
            key: 'test',
            tag: 'Example',
            description: [{ data: { tag: 'Remove' }, children: ['Description Test'] }],
        }))
    })

    it('should correct diff adding a field', () => {
        const testExample = new StandardExample({
            key: 'test',
            tag: 'Example',
            name: ['Name Test'],
            summary: ['Summary Test'],
        })
        const testExample2 = new StandardExample({
            key: 'test',
            tag: 'Example',
            name: ['Name Test'],
            summary: ['Summary Test'],
            description: ['Description Test'],
        })
        expect(testExample.diff(testExample2)).toEqual(new StandardExample({
            key: 'test',
            tag: 'Example',
            description: ['Description Test'],
        }))
    })

    it('should correctly diff changing a field', () => {
        const testExample = new StandardExample({
            key: 'test',
            tag: 'Example',
            name: ['Name Test'],
            summary: ['Summary Test'],
            description: ['Description', { data: { tag: 'Space' }, children: [] }, 'Test'],
        })
        const testExample2 = new StandardExample({
            key: 'test',
            tag: 'Example',
            name: ['Name Test'],
            summary: ['Summary Test'],
            description: ['Description', { data: { tag: 'Space' }, children: [] }, 'Changed'],
        })
        expect(testExample.diff(testExample2)).toEqual(new StandardExample({
            key: 'test',
            tag: 'Example',
            description: [{
                data: { tag: 'Replace' },
                children: [
                    { data: { tag: 'ReplaceMatch' }, children: ['Test'] },
                    { data: { tag: 'ReplacePayload' }, children: ['Changed'] }
                ]
            }],
        }))
    })
})