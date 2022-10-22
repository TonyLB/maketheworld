import { flattenTaggedMessageContent } from './messages'

describe('flattenTaggedMessageContent', () => {
    it('should correctly combine strings, links and line breaks', async () => {
        expect(await flattenTaggedMessageContent([
            { tag: 'String', value: 'One' },
            { tag: 'String', value: 'Two' },
            { tag: 'Link', to: 'FEATURE#Test', text: 'Three' },
            { tag: 'String', value: 'Four' },
            { tag: 'LineBreak' },
            { tag: 'String', value: 'Five' }
        ])).toMatchSnapshot()
    })

    it('should correctly handle spacer between strings', async () => {
        expect(await flattenTaggedMessageContent([
            { tag: 'String', value: 'One' },
            { tag: 'Space' },
            { tag: 'String', value: 'Two' },
            { tag: 'Link', to: 'FEATURE#Test', text: 'Three' },
            { tag: 'String', value: 'Four' },
            { tag: 'LineBreak' },
            { tag: 'String', value: 'Five' }
        ])).toMatchSnapshot()
    })

    it('should correctly handle spacer between links', async () => {
        expect(await flattenTaggedMessageContent([
            { tag: 'String', value: 'One' },
            { tag: 'String', value: 'Two' },
            { tag: 'Link', to: 'FEATURE#Test', text: 'Three' },
            { tag: 'Space' },
            { tag: 'Link', to: 'FEATURE#Test', text: 'Four' },
            { tag: 'LineBreak' },
            { tag: 'String', value: 'Five' }
        ])).toMatchSnapshot()
    })

    it('should correctly handle spacer adjoining linebreak', async () => {
        expect(await flattenTaggedMessageContent([
            { tag: 'String', value: 'One' },
            { tag: 'String', value: 'Two' },
            { tag: 'Link', to: 'FEATURE#Test', text: 'Three' },
            { tag: 'String', value: 'Four' },
            { tag: 'Space' },
            { tag: 'LineBreak' },
            { tag: 'Space' },
            { tag: 'String', value: 'Five' }
        ])).toMatchSnapshot()
    })

    it('should correctly handle spacer at end of message', async () => {
        expect(await flattenTaggedMessageContent([
            { tag: 'String', value: 'One' },
            { tag: 'String', value: 'Two' },
            { tag: 'Link', to: 'FEATURE#Test', text: 'Three' },
            { tag: 'String', value: 'Four' },
            { tag: 'LineBreak' },
            { tag: 'String', value: 'Five' },
            { tag: 'Space' }
        ])).toMatchSnapshot()
    })

    it('should correctly handle spacer at beginning of message', async () => {
        expect(await flattenTaggedMessageContent([
            { tag: 'Space' },
            { tag: 'String', value: 'One' },
            { tag: 'String', value: 'Two' },
            { tag: 'Link', to: 'FEATURE#Test', text: 'Three' },
            { tag: 'String', value: 'Four' },
            { tag: 'LineBreak' },
            { tag: 'String', value: 'Five' }
        ])).toMatchSnapshot()
    })
})