import { SchemaTaggedMessageLegalContents } from '../../baseClasses'
import { schemaDescriptionToWML } from './freeText'
import { printSchemaTag as schemaToWML } from '../..'

describe('description schemaToWML', () => {
    //
    // TODO: Create a test schemaToWML in PrintMapEntry format, in order to be able to run unit tests
    //
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
            { indent: 0, padding: 0, context: [] }
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
        expect(schemaDescriptionToWML(schemaToWML)(testSchema, { indent: 0, padding: 0, context: [] })).toMatchSnapshot()
    })

    it('should correctly handle sequential complex conditions', () => {
        const testSchema: SchemaTaggedMessageLegalContents[] = [{
            tag: 'String',
            value: 'Test'
        },
        {
            tag: 'If',
            contextTag: 'Description',
            conditions: [{ if: 'testVar', dependencies: ['testVar'] }],
            contents: [
                { tag: 'Space' },
                { tag: 'String', value: 'TestTwo' }
            ]
        },
        {
            tag: 'If',
            contextTag: 'Description',
            conditions: [{ if: '!testVar', dependencies: ['testVar'] }],
            contents: [
                { tag: 'Space' },
                { tag: 'String', value: 'TestThree' }
            ]
        },
        {
            tag: 'Bookmark',
            key: 'testBookmark',
            contents: []
        }]
        expect(schemaDescriptionToWML(schemaToWML)(testSchema, { indent: 0, padding: 0, context: [] })).toMatchSnapshot()
    })

})