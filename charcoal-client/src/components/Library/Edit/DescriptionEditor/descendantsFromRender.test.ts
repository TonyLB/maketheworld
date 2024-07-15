import { StandardForm } from "@tonylb/mtw-wml/dist/standardize/baseClasses"
import descendantsFromRender from "./descendantsFromRender"

const stubStandard: StandardForm = { key: '', tag: 'Asset', byId: {}, metaData: [] }

describe('descendantsFromRender', () => {
    it('should return an empty paragraph from empty list', () => {
        expect(descendantsFromRender([], { standard: stubStandard })).toEqual([{ type: 'paragraph', children: [{ text: '' }]}])
    })

    it('should return a text description', () => {
        expect(descendantsFromRender([
            { data: { tag: 'String', value: 'This is a test ' }, children: [], id: '' },
            { data: { tag: 'Link', to: 'testFeature', text: 'with a link' }, children: [{ data: { tag: 'String', value: 'with a link' }, children: [], id: '' }], id: '' },
            { data: { tag: 'String', value: ' and more text.' }, children: [], id: '' },
        ], {
            standard: {
                key: '',
                tag: 'Asset',
                byId: {
                    testFeature: {
                        tag: 'Feature',
                        key: 'testFeature',
                        id: '',
                        name: { data: { tag: 'Name' }, children: [], id: '' },
                        description: { data: { tag: 'Description' }, children: [], id: '' }
                    }
                },
                metaData: []
            }
        })).toMatchSnapshot()
    })

    it('should break paragraphs at LineBreak tags', () => {
        expect(descendantsFromRender([
            { data: { tag: 'String', value: 'This is a test.' }, children: [], id: '' },
            { data: { tag: 'br' }, children: [], id: '' },
            { data: { tag: 'String', value: 'With two paragraphs.' }, children: [], id: '' }
        ], { standard: stubStandard })).toMatchSnapshot()
    })

    it('should render a single-level condition', () => {
        expect(descendantsFromRender([
            { data: { tag: 'String', value: 'This is a test ' }, children: [], id: '' },
            {
                data: { tag: 'If' },
                children: [{
                    data: {
                        tag: 'Statement',
                        if: 'testVariable'
                    },
                    children: [{ data: { tag: 'String', value: 'with an If'}, children: [], id: '' }],
                    id: ''
                },
                {
                    data: { tag: 'Fallthrough' },
                    children: [{ data: { tag: 'String', value: 'and an Else'}, children: [], id: '' }],
                    id: ''
                }],
                id: 'ABC'
            },
            { data: { tag: 'String', value: ' and more text.' }, children: [], id: '' }
        ], { standard: stubStandard })).toMatchSnapshot()
    })

    it('should join a space element to text element', () => {
        expect(descendantsFromRender([
            { data: { tag: 'String', value: 'Test' }, children: [], id: '' },
            { data: { tag: 'Space' }, children: [], id: '' }
        ], { standard: stubStandard })).toMatchSnapshot()
    })

    it('should render a space after a link in a second paragraph', () => {
        expect(descendantsFromRender([
            { data: { tag: 'String', value: 'Test' }, children: [], id: '' },
            { data: { tag: 'br' }, children: [], id: '' },
            { data: { tag: 'String', value: 'Another ' }, children: [], id: '' },
            { data: { tag: 'Link', to: 'testFeature', text: 'test' }, children: [{ data: { tag: 'String', value: 'test' }, children: [], id: ''}], id: '' },
            { data: { tag: 'Space' },  children: [], id: '' }
        ], {
            standard: {
                key: '',
                tag: 'Asset',
                byId: {
                    testFeature: {
                        tag: 'Feature',
                        key: 'testFeature',
                        id: '',
                        name: { data: { tag: 'Name' }, children: [], id: '' },
                        description: { data: { tag: 'Description' }, children: [], id: '' }
                    }
                },
                metaData: []
            }
        })).toMatchSnapshot()
    })
})