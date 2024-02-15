import { tagRenderContents } from './tagRender'
import { printSchemaTag } from '..'
import { PrintMode } from './baseClasses'

describe('tagRenderContents', () => {
    it('should nest items in non-description context separately', () => {
        const testValue = tagRenderContents({
            descriptionContext: true,
            schemaToWML: printSchemaTag,
            indent: 0,
            context: []
        })([
            { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'A short name' }, children: [] }] },
            { data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'An extremely long, hopefully line-breaking, lots of words, non-stop, why do you write like you\'re running out of time description' }, children: [] }] }
        ])
        expect(testValue).toEqual([
            { printMode: PrintMode.nested, output: "<Name>A short name</Name>\n<Description>\n    An extremely long, hopefully line-breaking, lots of words, non-stop, why do\n    you write like you\'re running out of time description\n</Description>" }
        ])

    })

    it('should render conditionals properly', () => {
        const testValue = tagRenderContents({
            descriptionContext: true,
            schemaToWML: printSchemaTag,
            indent: 0,
            context: []
        })([
            { data: { tag: 'Statement', if: 'true' }, children: [{ data: { tag: 'String', value: 'true' }, children: [] }] },
            { data: { tag: 'Fallthrough' }, children: [{ data: { tag: 'String', value: 'false' }, children: [] }] }
        ])
        expect(testValue).toEqual([
            { printMode: PrintMode.naive, output: "<If {true}>true</If><Else>false</Else>" },
            { printMode: PrintMode.nested, output: "<If {true}>true</If>\n<Else>false</Else>" }
        ])
    })
})