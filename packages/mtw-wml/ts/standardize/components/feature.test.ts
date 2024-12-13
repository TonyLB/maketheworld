import { Schema, schemaToWML } from "../../schema"
import { isSchemaDescription, isSchemaName } from "../../schema/baseClasses"
import { deIndentWML } from "../../schema/utils"
import { treeNodeTypeguard } from "../../tree/baseClasses"
import { StandardFeatureData } from "./dataTypes/feature"
import StandardFeature from './feature'
import { mergeTest } from "./utils/testing"

describe('StandardFeature class', () => {

    it('should construct StandardFeature from WML', () => {
        const testSource = deIndentWML(`
            <Feature key=(test)>
                <Name>Name Test</Name>
                <Description>Description Test</Description>
            </Feature>
        `)
        const testFeature = new StandardFeature(testSource)
        expect(testFeature.key).toEqual('test')
        expect(testFeature.name).toEqual({ data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name Test' }, children: [] }] })
        expect(testFeature.description).toEqual({ data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Description Test' }, children: [] }] })
        expect(schemaToWML([testFeature.schema])).toEqual(testSource)
    })

    it('should construct StandardFeature from schema', () => {
        const schema = new Schema()
        const testSource = deIndentWML(`
            <Feature key=(test)>
                <Name>Name Test</Name>
                <Description>Description Test</Description>
            </Feature>
        `)
        schema.loadWML(testSource)
        const testFeature = new StandardFeature(schema.schema[0])
        expect(testFeature.key).toEqual('test')
        expect(testFeature.name).toEqual({ data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name Test' }, children: [] }] })
        expect(testFeature.description).toEqual({ data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Description Test' }, children: [] }] })
        expect(schemaToWML([testFeature.schema])).toEqual(testSource)
    })

    it('should construct StandardFeature from StandardFeatureData', () => {
        const testFeatureData: StandardFeatureData = {
            key: 'test',
            tag: 'Feature',
            name: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name Test' }, children: [] }] },
            description: { data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Description Test' }, children: [] }] },
        }
        const testFeature = new StandardFeature(testFeatureData)
        expect(testFeature.key).toEqual('test')
        expect(testFeature.name).toEqual({ data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Name Test' }, children: [] }] })
        expect(testFeature.description).toEqual({ data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Description Test' }, children: [] }] })
        expect(testFeature.toJSON()).toEqual(testFeatureData)
    })

    it('should merge correctly', () => {
        expect(mergeTest(
            `<Feature key=(testFeature)>
                <Name>Lobby</Name>
                <Description>A plain lobby.</Description>
            </Feature>`,
            StandardFeature,
            `<Feature key=(testFeature)>
                <Replace><Name>Lobby</Name></Replace><With><Name>Spooky Lobby</Name></With>
                <Description><Space />Shadows cling to the corners of the room.</Description>
            </Feature>`
        )).toEqual(deIndentWML(`
            <Feature key=(testFeature)>
                <Name>Spooky Lobby</Name>
                <Description>
                    A plain lobby.<Space />Shadows cling to the corners of the room.
                </Description>
            </Feature>
        `))
    })

    it('should map contents correctly', () => {
        const test = new StandardFeature(`
            <Feature key=(testFeature)>
                <Name>Lobby</Name>
                <Description>A plain lobby.</Description>
            </Feature>
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
            <Feature key=(testFeature)>
                <Name>LobbyNarf!</Name>
                <Description>A plain lobby.Narf!</Description>
            </Feature>
        `))
    })
})