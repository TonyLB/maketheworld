import { deIndentWML, defaultSelected, } from '.'
import { Schema, schemaToWML } from '..'
import { GenericTree } from '../../tree/baseClasses'
import { SchemaTag } from '../baseClasses'

describe('deIndentWML', () => {
    it('should leave unindented WML unchanged', () => {
        const testWML = '<Asset key=(Test)>\n    <Room key=(ABC)>\n        <Exit to=(DEF)>Test Exit</Exit>\n    </Room>\n</Asset>'
        expect(deIndentWML(testWML)).toEqual(testWML)
    })

    it('should unindent', () => {
        expect(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(ABC)>
                    <Exit to=(DEF)>Test Exit</Exit>
                </Room>
            </Asset>
        `)).toEqual('<Asset key=(Test)>\n    <Room key=(ABC)>\n        <Exit to=(DEF)>Test Exit</Exit>\n    </Room>\n</Asset>')
    })
})

describe('defaultSelected', () => {
    const schemaTest = (wml: string): GenericTree<SchemaTag> => {
        const schema = new Schema()
        schema.loadWML(wml)
        return schema.schema
    }
    
    it('should leave WML unchanged when selected exists', () => {
        const testWML = deIndentWML(`
            <Asset key=(Test)>
                <Room key=(ABC)>
                    <If {true}><Exit to=(DEF)>Test Exit</Exit></If>
                    <ElseIf {false} selected><Exit to=(GHI)>Test Exit</Exit></ElseIf>
                </Room>
            </Asset>
        `)
        expect(schemaToWML(defaultSelected(schemaTest(testWML)))).toEqual(testWML)
    })

    it('should add default select on first statement when no fallthrough', () => {
        const testWML = deIndentWML(`
            <Asset key=(Test)>
                <Room key=(ABC)>
                    <If {true}><Exit to=(DEF)>Test Exit</Exit></If>
                    <ElseIf {false}><Exit to=(GHI)>Test Exit</Exit></ElseIf>
                </Room>
            </Asset>
        `)
        expect(schemaToWML(defaultSelected(schemaTest(testWML)))).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(ABC)>
                    <If {true} selected><Exit to=(DEF)>Test Exit</Exit></If>
                    <ElseIf {false}><Exit to=(GHI)>Test Exit</Exit></ElseIf>
                </Room>
            </Asset>
        `))
    })

    it('should add default select on fallthrough when available', () => {
        const testWML = deIndentWML(`
            <Asset key=(Test)>
                <Room key=(ABC)>
                    <If {true}><Exit to=(DEF)>Test Exit</Exit></If>
                    <Else><Exit to=(GHI)>Test Exit</Exit></Else>
                </Room>
            </Asset>
        `)
        expect(schemaToWML(defaultSelected(schemaTest(testWML)))).toEqual(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(ABC)>
                    <If {true}><Exit to=(DEF)>Test Exit</Exit></If>
                    <Else selected><Exit to=(GHI)>Test Exit</Exit></Else>
                </Room>
            </Asset>
        `))
    })

})