import { tagRenderContents } from './tagRender'
import { printSchemaTag } from '..'
import { PrintMode } from './baseClasses'

describe('tagRenderContents', () => {
    it('should render conditionals properly', () => {
        expect(tagRenderContents({
            descriptionContext: true,
            schemaToWML: printSchemaTag,
            indent: 0,
            context: []
        })([
            { data: { tag: 'Statement', if: 'true' }, children: [{ data: { tag: 'String', value: 'true' }, children: [] }] },
            { data: { tag: 'Fallthrough' }, children: [{ data: { tag: 'String', value: 'false' }, children: [] }] }
        ])).toEqual([[
            { printMode: PrintMode.naive, output: "<If {true}>true</If><Else>false</Else>" },
            { printMode: PrintMode.nested, output: "<If {true}>true</If>\n<Else>false</Else>" }
        ]])
    })
})