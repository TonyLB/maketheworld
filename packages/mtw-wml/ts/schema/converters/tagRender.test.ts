import { tagRenderContents } from './tagRender'
import { printSchemaTag } from '..'

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
            "<If {true}>true</If><Else>false</Else>",
            "<If {true}>true</If>\n<Else>false</Else>"
        ]])
    })
})