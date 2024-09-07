import { StandardForm } from "@tonylb/mtw-wml/dist/standardize/baseClasses"
import descendantsFromRender from "./descendantsFromRender"

const stubStandard: StandardForm = { key: '', tag: 'Asset', byId: {}, metaData: [] }

describe('descendantsFromRender', () => {
    it('should return an empty paragraph from empty list', () => {
        expect(descendantsFromRender([], { standard: stubStandard })).toEqual([{ type: 'paragraph', children: [{ text: '' }]}])
    })

    it('should return a text description', () => {
        expect(descendantsFromRender([
            { data: { tag: 'String', value: 'This is a test ' }, children: [] },
            { data: { tag: 'Link', to: 'testFeature', text: 'with a link' }, children: [{ data: { tag: 'String', value: 'with a link' }, children: [] }] },
            { data: { tag: 'String', value: ' and more text.' }, children: [] },
        ], {
            standard: {
                key: '',
                tag: 'Asset',
                byId: {
                    testFeature: {
                        tag: 'Feature',
                        key: 'testFeature',
                        name: { data: { tag: 'Name' }, children: [] },
                        description: { data: { tag: 'Description' }, children: [] }
                    }
                },
                metaData: []
            }
        })).toMatchSnapshot()
    })

    it('should break paragraphs at LineBreak tags', () => {
        expect(descendantsFromRender([
            { data: { tag: 'String', value: 'This is a test.' }, children: [] },
            { data: { tag: 'br' }, children: [] },
            { data: { tag: 'String', value: 'With two paragraphs.' }, children: [] }
        ], { standard: stubStandard })).toMatchSnapshot()
    })

    it('should render a single-level condition', () => {
        expect(descendantsFromRender([
            { data: { tag: 'String', value: 'This is a test ' }, children: [] },
            {
                data: { tag: 'If' },
                children: [{
                    data: {
                        tag: 'Statement',
                        if: 'testVariable'
                    },
                    children: [{ data: { tag: 'String', value: 'with an If'}, children: [] }]
                },
                {
                    data: { tag: 'Fallthrough' },
                    children: [{ data: { tag: 'String', value: 'and an Else'}, children: [] }]
                }]
            },
            { data: { tag: 'String', value: ' and more text.' }, children: [] }
        ], { standard: stubStandard })).toMatchSnapshot()
    })

    it('should join a space element to text element', () => {
        expect(descendantsFromRender([
            { data: { tag: 'String', value: 'Test' }, children: [] },
            { data: { tag: 'Space' }, children: [] }
        ], { standard: stubStandard })).toMatchSnapshot()
    })

    it('should render a space after a link in a second paragraph', () => {
        expect(descendantsFromRender([
            { data: { tag: 'String', value: 'Test' }, children: [] },
            { data: { tag: 'br' }, children: [] },
            { data: { tag: 'String', value: 'Another ' }, children: [] },
            { data: { tag: 'Link', to: 'testFeature', text: 'test' }, children: [{ data: { tag: 'String', value: 'test' }, children: [] }] },
            { data: { tag: 'Space' },  children: [] }
        ], {
            standard: {
                key: '',
                tag: 'Asset',
                byId: {
                    testFeature: {
                        tag: 'Feature',
                        key: 'testFeature',
                        name: { data: { tag: 'Name' }, children: [] },
                        description: { data: { tag: 'Description' }, children: [] }
                    }
                },
                metaData: []
            }
        })).toMatchSnapshot()
    })
})