import { NormalForm } from "@tonylb/mtw-wml/dist/normalize/baseClasses"
import descendantsFromRender from "./descendantsFromRender"

describe('descendantsFromRender', () => {
    const testNormalForm: NormalForm = {
        testAsset: {
            key: 'testAsset',
            tag: 'Asset',
            appearances: [{
                contextStack: [],
                contents: [
                    { key: 'testFeature', tag: 'Feature', index: 0 },
                    { key: 'testVariable', tag: 'Variable', index: 0 }
                ]
            }]
        },
        testFeature: {
            key: 'testFeature',
            tag: 'Feature',
            appearances: [{
                contextStack: [{ key: 'testAsset', tag: 'Asset', index: 0 }],
                name: [],
                render: [],
                contents: []
            }]
        },
        testVariable: {
            key: 'testVariable',
            tag: 'Variable',
            default: 'false',
            appearances: [{
                contextStack: [{ key: 'testAsset', tag: 'Asset', index: 0 }],
                contents: []
            }]
        }
    }

    it('should return an empty paragraph from empty list', () => {
        expect(descendantsFromRender(testNormalForm)([])).toEqual([{ type: 'paragraph', children: [{ text: '' }]}])
    })

    it('should return a text description', () => {
        expect(descendantsFromRender(testNormalForm)([
            { tag: 'String', value: 'This is a test ' },
            { tag: 'Link', to: 'testFeature', targetTag: 'Feature', text: 'with a link' },
            { tag: 'String', value: ' and more text.' }
        ])).toMatchSnapshot()
    })

    it('should break paragraphs at LineBreak tags', () => {
        expect(descendantsFromRender(testNormalForm)([
            { tag: 'String', value: 'This is a test.' },
            { tag: 'LineBreak' },
            { tag: 'String', value: 'With two paragraphs.' }
        ])).toMatchSnapshot()
    })

    it('should render a single-level condition', () => {
        expect(descendantsFromRender(testNormalForm)([
            { tag: 'String', value: 'This is a test ' },
            { tag: 'Condition', conditions: [{ if: 'testVariable', dependencies: ['testVariable'] }], contents: [
                { tag: 'String', value: 'with an If'}
            ] },
            { tag: 'Condition', conditions: [{ if: 'testVariable', dependencies: ['testVariable'], not: true }], contents: [
                { tag: 'String', value: 'and an Else'}
            ] },
            { tag: 'String', value: ' and more text.' }
        ])).toMatchSnapshot()
    })
})