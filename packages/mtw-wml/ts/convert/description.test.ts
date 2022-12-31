import { ParseTag } from '../parser/baseClasses'
import { SchemaTaggedMessageLegalContents } from '../schema/baseClasses'
import { schemaDescriptionToWML } from './description'
import WMLConverter from './index'

describe('description schemaToWML', () => {
    const convert = new WMLConverter()
    const schemaToWML = convert.schemaToWML.bind(this)
    const fakeParse: ParseTag = {
        tag: 'Space',
        startTagToken: 0,
        endTagToken: 0
    }
    it('should properly render a non-breaking line', () => {
        expect(schemaDescriptionToWML(schemaToWML)(
            [{
                tag: 'String',
                value: 'Test'
            },
            {
                tag: 'Link',
                to: 'Test',
                text: 'Test'
            }],
            { indent: 0, padding: 0 }
        )).toEqual('Test<Link to=(Test)>Test</Link>')
    })
    it('should word wrap descriptions', () => {
        const testSchema: SchemaTaggedMessageLegalContents[] = [{
            tag: 'String',
            value: 'A short first section '
        },
        {
            tag: 'Link',
            to: 'clockTower',
            text: 'clockTower'
        },
        {
            tag: 'String',
            value: ' then a long enough second section that it will start testing the word-wrap functionality at eighty characters, which is actually quite a long line indeed, eighty characters is a lot more than you might think'
        },
        {
            tag: 'Link',
            to: 'clockTower',
            text: 'clockTower'
        },
        {
            tag: 'String',
            value: "and then a third section also snuggled up to the link, to test that wrapping functionality doesn't separate no-space connections. Then a section with two"
        },
        {
            tag: 'Link',
            to: 'clockTower',
            text: 'clockTower'
        },
        {
            tag: 'Link',
            to: 'clockTower',
            text: 'clockTower'
        },
        {
            tag: 'String',
            value: "tags directly adjacent. Finally a long text section to make sure that wrapping still works when the text is adjacent after a nested tag."
        }]
        expect(schemaDescriptionToWML(schemaToWML)(testSchema, { indent: 0, padding: 0 })).toMatchSnapshot()
    })

})