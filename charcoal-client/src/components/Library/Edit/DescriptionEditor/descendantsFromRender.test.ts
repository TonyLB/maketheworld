import descendantsFromRender from "./descendantsFromRender"

describe('descendantsFromRender', () => {
    it('should return an empty paragraph from empty list', () => {
        expect(descendantsFromRender([])).toEqual([{ type: 'paragraph', children: [{ text: '' }]}])
    })

    it('should return a text description', () => {
        expect(descendantsFromRender([
            { tag: 'String', value: 'This is a test ' },
            { tag: 'Link', to: 'testFeature', targetTag: 'Feature', text: 'with a link' },
            { tag: 'String', value: ' and more text.' }
        ])).toMatchSnapshot()
    })

    it('should break paragraphs at LineBreak tags', () => {
        expect(descendantsFromRender([
            { tag: 'String', value: 'This is a test.' },
            { tag: 'LineBreak' },
            { tag: 'String', value: 'With two paragraphs.' }
        ])).toMatchSnapshot()
    })

    it('should render a single-level condition', () => {
        expect(descendantsFromRender([
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

    it('should join a space element to text element', () => {
        expect(descendantsFromRender([
            { tag: 'String', value: 'Test' },
            { tag: 'Space' }
        ])).toMatchSnapshot()
    })

    it('should render a space after a link in a second paragraph', () => {
        expect(descendantsFromRender([
            { tag: 'String', value: 'Test' },
            { tag: 'LineBreak' },
            { tag: 'String', value: 'Another ' },
            { tag: 'Link', to: 'testFeature', targetTag: 'Feature', text: 'test' },
            { tag: 'Space' }
        ])).toMatchSnapshot()
    })
})