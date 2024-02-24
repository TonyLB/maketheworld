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
            { data: { tag: 'String', value: 'This is a test ' }, children: [] },
            { data: { tag: 'Link', to: 'testFeature', text: 'with a link' }, children: [] },
            { data: { tag: 'String', value: ' and more text.' }, children: [] }
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
            { data: { tag: 'String', value: 'This is a test.' }, children: [] },
            { data: { tag: 'br' }, children: [] },
            { data: { tag: 'String', value: 'With two paragraphs.' }, children: [] }
        ])
    })

    it('should replace space at end of last line (only) with Space tag', () => {
        expect(descendantsToRender([{
            type: 'paragraph',
            children: [{ text: 'This is a test. ' }]
        },
        {
            type: 'paragraph',
            children: [
                { text: 'With ' },
                {
                    children: [{ text: "link"}],
                    to: "testFeature",
                    type: "featureLink"
                },
                { text: ' ' }
            ]
        }])).toEqual([
            { data: { tag: 'String', value: 'This is a test.' }, children: [] },
            { data: { tag: 'br' }, children: [] },
            { data: { tag: 'String', value: 'With ' }, children: [] },
            { data: { tag: 'Link', to: 'testFeature', text: 'link' }, children: [] },
            { data: { tag: 'Space' }, children: [] }
        ])
    })

    it('should decode a single-level condition', () => {
        expect(descendantsToRender([{
            type: 'paragraph',
            children: [
                { text: 'This is a test ' },
                {
                    type: 'ifWrapper',
                    tree: [
                        { data: { tag: 'Statement', if: 'testVariable' }, children: [{ data: { tag: 'String', value: 'with an If'}, children: [], id: '' }], id: '' },
                        { data: { tag: 'Fallthrough' }, children: [{ data: { tag: 'String', value: ' and an Else' }, children: [], id: '' }], id: '' }
                    ]
                }
            ]
        },
        {
            type: 'paragraph',
            children: [{ text: ' and more text.' }]
        }])).toEqual([
            { data: { tag: 'String', value: 'This is a test ' }, children: [] },
            {
                data: { tag: 'If' },
                children: [
                    { data: { tag: 'Statement', if: 'testVariable' }, children: [{ data: { tag: 'String', value: 'with an If'}, children: [] }] },
                    { data: { tag: 'Fallthrough' }, children: [{ data: { tag: 'String', value: ' and an Else' }, children: [] }] }
                ]
            },
            { data: { tag: 'String', value: ' and more text.' }, children: [] }
        ])
    })
})