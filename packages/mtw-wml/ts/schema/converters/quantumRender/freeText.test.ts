import { schemaDescriptionToWML } from './freeText'
import { printSchemaTag as schemaToWML } from '../..'
import { PrintMode, SchemaTagPrintItem } from '../baseClasses'

describe('description schemaToWML', () => {
    it('should properly render a non-breaking line', () => {
        expect(schemaDescriptionToWML(schemaToWML)(
            [{
                type: 'adjacentGroup',
                tags: [
                    { data: { tag: 'String', value: 'Test' }, children: [] },
                    { data: { tag: 'Link', to: 'Test', text: 'Test' }, children: [{ data: { tag: 'String', value: 'Test' }, children: [] }] }
                ]
            }],
            { indent: 0, padding: 0, context: [] }
        )).toEqual([
            { printMode: PrintMode.naive, output: 'Test<Link to=(Test)>Test</Link>' }
        ])
        expect(schemaDescriptionToWML(schemaToWML)([
            {
                type: 'singleFreeText',
                tag: { data: { tag: 'String', value: 'Test ' }, children: [] }
            },
            {
                type: 'singleFreeText',
                tag: { data: { tag: 'Link', to: 'Test', text: 'Test' }, children: [{ data: { tag: 'String', value: 'Test' }, children: [] }] }
            }],
            { indent: 0, padding: 0, context: [] }
        )).toEqual([
            { printMode: PrintMode.naive, output: 'Test <Link to=(Test)>Test</Link>' }
        ])
    })
    it('should word wrap descriptions', () => {
        const testSchema: SchemaTagPrintItem[] = [
            {
                type: 'singleFreeText',
                tag: { data: { tag: 'String', value: 'A short first section ' }, children: [] }
            },
            {
                type: 'singleFreeText',
                tag: { data: { tag: 'Link', to: 'clockTower', text: 'clockTower' }, children: [{ data: { tag: 'String', value: 'clockTower' }, children: [] }] }
            },
            {
                type: 'adjacentGroup',
                tags: [
                    {
                        data: {
                            tag: 'String',
                            value: ' then a long enough second section that it will start testing the word-wrap functionality at eighty characters, which is actually quite a long line indeed, eighty characters is a lot more than you might think'
                        },
                        children: []
                    },
                    { data: { tag: 'Link', to: 'clockTower', text: 'clockTower' }, children: [{ data: { tag: 'String', value: 'clockTower' }, children: [] }] },
                    {
                        data: {
                            tag: 'String',
                            value: "and then a third section also snuggled up to the link, to test that wrapping functionality doesn't separate no-space connections. Then a section with two"
                        },
                        children: []
                    },
                    { data: { tag: 'Link', to: 'clockTower', text: 'clockTower' }, children: [{ data: { tag: 'String', value: 'clockTower' }, children: [] }] },
                    { data: { tag: 'Link', to: 'clockTower', text: 'clockTower' }, children: [{ data: { tag: 'String', value: 'clockTower' }, children: [] }] },
                    {
                        data: {
                            tag: 'String',
                            value: "tags directly adjacent. Finally a long text section to make sure that wrapping still works when the text is adjacent after a nested tag."
                        },
                        children: []
                    }
                ]
            }
        ]
        expect(schemaDescriptionToWML(schemaToWML)(testSchema, { indent: 0, padding: 0, context: [] })[0].output).toMatchSnapshot()
    })

    it('should correctly handle sequential complex conditions', () => {
        const testSchema: SchemaTagPrintItem[] = [
            {
                type: 'adjacentGroup',
                tags: [
                    { data: { tag: 'String', value: 'Test' }, children: [] },
                    {
                        data: { tag: 'If' },
                        children: [{
                            data: { tag: 'Statement', if: 'testVar' },
                            children: [
                                { data: { tag: 'Space' }, children: [] },
                                { data: { tag: 'String', value: 'TestTwo' }, children: [] }
                            ]
                        }]
                    },
                    {
                        data: { tag: 'If' },
                        children: [{
                            data: { tag: 'Statement', if: '!testVar' },
                            children: [
                                { data: { tag: 'Space' }, children: [] },
                                { data: { tag: 'String', value: 'TestThree' }, children: [] }
                            ]
                        }]
                    },
                    {
                        data: {
                            tag: 'Bookmark',
                            key: 'testBookmark'
                        },
                        children: []
                    }
                ]
            }
        ]
        expect(schemaDescriptionToWML(schemaToWML)(testSchema, { indent: 0, padding: 0, context: [] })[0].output).toMatchSnapshot()
    })

})