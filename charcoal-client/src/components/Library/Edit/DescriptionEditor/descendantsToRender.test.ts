import descendantsToRender from "./descendantsToRender"

describe('descendantsToRender', () => {
    it('should return an empty list from empty paragraph', () => {
        expect(descendantsToRender([{ type: 'paragraph', children: [{ text: '' }]}])).toEqual([])
    })

    it('should return a text description', () => {
        expect(descendantsToRender([{
            type: 'paragraph',
            children: [{
                text: 'This is a test ',
            },
            {
                type: 'featureLink',
                to: 'testFeature',
                children: [{ text: 'with a link' }]
            },
            {
                text: ' and more text.'
            }]
        }])).toEqual([
            { tag: 'String', value: 'This is a test ' },
            { tag: 'Link', to: 'testFeature', targetTag: 'Feature', text: 'with a link' },
            { tag: 'String', value: ' and more text.' }
        ])
    })

    it('should replace paragraph breaks with LineBreak tags', () => {
        expect(descendantsToRender([{
            type: 'paragraph',
            children: [{ text: 'This is a test.' }]
        },
        {
            type: 'paragraph',
            children: [{ text: 'With two paragraphs.' }]
        }])).toEqual([
            { tag: 'String', value: 'This is a test.' },
            { tag: 'LineBreak' },
            { tag: 'String', value: 'With two paragraphs.' }
        ])
    })

    it('should decode a single-level condition', () => {
        expect(descendantsToRender([{
            type: 'paragraph',
            children: [{ text: 'This is a test ' }]
        },
        {
            type: 'ifBase',
            source: 'testVariable',
            children: [{
                type: 'paragraph',
                children: [{ text: 'with an If' }]
            }]
        },
        {
            type: 'else',
            children: [{
                type: 'paragraph',
                children: [{ text: 'and an Else' }]
            }]
        },
        {
            type: 'paragraph',
            children: [{ text: ' and more text.' }]
        }])).toEqual([
            { tag: 'String', value: 'This is a test ' },
            { tag: 'Condition', conditions: [{ if: 'testVariable', dependencies: ['testVariable'] }], contents: [
                { tag: 'String', value: 'with an If'}
            ] },
            { tag: 'Condition', conditions: [{ if: 'testVariable', dependencies: ['testVariable'], not: true }], contents: [
                { tag: 'String', value: 'and an Else'}
            ] },
            { tag: 'String', value: ' and more text.' }
        ])
    })
})