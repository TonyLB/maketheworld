import descendantsFromRender from "./descendantsFromRender"

describe('descendantsFromRender', () => {
    it('should return an empty paragraph from empty list', () => {
        expect(descendantsFromRender([], { normal: {} })).toEqual([{ type: 'paragraph', children: [{ text: '' }]}])
    })

    it('should return a text description', () => {
        expect(descendantsFromRender([
            { data: { tag: 'String', value: 'This is a test ' }, children: [], id: '' },
            { data: { tag: 'Link', to: 'testFeature', text: 'with a link' }, children: [], id: '' },
            { data: { tag: 'String', value: ' and more text.' }, children: [], id: '' },
        ], { normal: { testFeature: { tag: 'Feature', key: 'testFeature', appearances: [] }}})).toMatchSnapshot()
    })

    it('should break paragraphs at LineBreak tags', () => {
        expect(descendantsFromRender([
            { data: { tag: 'String', value: 'This is a test.' }, children: [], id: '' },
            { data: { tag: 'br' }, children: [], id: '' },
            { data: { tag: 'String', value: 'With two paragraphs.' }, children: [], id: '' }
        ], { normal: {} })).toMatchSnapshot()
    })

    it('should render a single-level condition', () => {
        expect(descendantsFromRender([
            { data: { tag: 'String', value: 'This is a test ' }, children: [], id: '' },
            {
                data: { tag: 'If', conditions: [{ if: 'testVariable', dependencies: [] }] },
                children: [{ data: { tag: 'String', value: 'with an If'}, children: [], id: '' }],
                id: ''
            },
            {
                data: { tag: 'If', conditions: [{ if: 'testVariable', dependencies: [], not: true }] },
                children: [{ data: { tag: 'String', value: 'and an Else'}, children: [], id: '' }],
                id: ''
            },
            { data: { tag: 'String', value: ' and more text.' }, children: [], id: '' }
        ], { normal: {} })).toMatchSnapshot()
    })

    it('should join a space element to text element', () => {
        expect(descendantsFromRender([
            { data: { tag: 'String', value: 'Test' }, children: [], id: '' },
            { data: { tag: 'Space' }, children: [], id: '' }
        ], { normal: {} })).toMatchSnapshot()
    })

    it('should render a space after a link in a second paragraph', () => {
        expect(descendantsFromRender([
            { data: { tag: 'String', value: 'Test' }, children: [], id: '' },
            { data: { tag: 'br' }, children: [], id: '' },
            { data: { tag: 'String', value: 'Another ' }, children: [], id: '' },
            { data: { tag: 'Link', to: 'testFeature', text: 'test' }, children: [], id: '' },
            { data: { tag: 'Space' },  children: [], id: '' }
        ], { normal: { testFeature: { tag: 'Feature', key: 'testFeature', appearances: [] } } })).toMatchSnapshot()
    })
})