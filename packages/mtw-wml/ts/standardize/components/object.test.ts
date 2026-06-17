import { Schema, schemaToWML } from "../../schema"
import { deIndentWML } from "../../schema/utils"
import { defaultComponentFromTag } from "../baseClasses"
import { StandardObjectData } from "./dataTypes/object"
import StandardObject from "./object"
import { standardComponentFactory } from "../componentFactory"

jest.mock('@tonylb/mtw-utilities/ts/uuid/index', () => {
    return {
        ...jest.requireActual('@tonylb/mtw-utilities/ts/uuid/___mocks___/index')
    }
})

describe('StandardObject class', () => {
    it('constructs from JSON data', () => {
        const data: StandardObjectData = {
            tag: 'Object',
            universalKey: 'OBJECT#skates',
        }
        const object = new StandardObject(data)
        expect(object.universalKey).toBe('OBJECT#skates')
        expect(object.shortName).toBeUndefined()
    })

    it('constructs from JSON data with shortName', () => {
        const data: StandardObjectData = {
            tag: 'Object',
            universalKey: 'OBJECT#skates',
            shortName: 'roller skates',
        }
        const object = new StandardObject(data)
        expect(object.shortName?._payload?.plain?.toJSON()).toBe('roller skates')
    })

    it('constructs from schema node', () => {
        const schema = new Schema()
        const testSource = deIndentWML(`
            <Asset uuid=(Test)>
                <Object uuid=(skates)>
                    <ShortName>roller skates</ShortName>
                </Object>
            </Asset>
        `)
        schema.loadWML(testSource)
        const objectNode = schema.schema[0].children[0]
        const object = new StandardObject(objectNode)
        expect(object.shortName?._payload?.plain?.toJSON()).toBe('roller skates')
        const printed = schemaToWML([object.schema])
        expect(printed).toContain('Object uuid=(skates)')
        expect(printed).toContain('<ShortName>roller skates</ShortName>')
    })

    it('serializes to JSON with omission-over-empty', () => {
        const empty = new StandardObject({ tag: 'Object', universalKey: 'OBJECT#skates' })
        const emptyJSON = empty.toJSON()
        expect(emptyJSON.tag).toBe('Object')
        expect('shortName' in emptyJSON).toBe(false)
    })

    it('round-trips JSON to Component to JSON', () => {
        const original: StandardObjectData = {
            tag: 'Object',
            universalKey: 'OBJECT#skates',
            shortName: 'roller skates',
        }
        const object = new StandardObject(original)
        const json = object.toJSON()
        const object2 = new StandardObject({ ...json, universalKey: 'OBJECT#skates' } as StandardObjectData)
        expect(object2.toJSON()).toEqual(json)
    })

    it('merges shortName from incoming overlay', () => {
        const base = new StandardObject({
            tag: 'Object',
            universalKey: 'OBJECT#skates',
        })
        const incoming = new StandardObject({
            tag: 'Object',
            universalKey: 'OBJECT#skates',
            shortName: 'roller skates',
        })
        const merged = base.merge(incoming) as StandardObject
        expect(merged.shortName?._payload?.plain?.toJSON()).toBe('roller skates')
    })

    it('merges default stub with improvisation shortName', () => {
        const stubData = defaultComponentFromTag('Object', undefined, 'OBJECT#skates')
        const { component: stub } = standardComponentFactory(stubData)
        const improvisation = new StandardObject({
            tag: 'Object',
            universalKey: 'OBJECT#skates',
            shortName: 'roller skates',
        })
        const merged = (stub as StandardObject).merge(improvisation) as StandardObject
        expect(merged.shortName?._payload?.plain?.toJSON()).toBe('roller skates')
    })
})
