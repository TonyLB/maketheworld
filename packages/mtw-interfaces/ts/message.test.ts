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

    it('should correctly ignore failing conditional trees', async () => {
        expect(await flattenTaggedMessageContent([
            { tag: 'String', value: 'Show,' },
            { tag: 'Space' },
            { tag: 'Condition',
                conditions: [{
                    if: 'check',
                    dependencies: [{ key: 'check', EphemeraId: 'VARIABLE#Test' }]
                }],
                contents: [
                    { tag: 'String', value: `Don't show` },
                    { tag: 'Condition',
                        conditions: [{
                            if: 'check',
                            dependencies: [{ key: 'check', EphemeraId: 'VARIABLE#Test' }]
                        }],
                        contents: [
                            { tag: 'String', value: `Definitely don't show` },
                        ]
                    }
                ]
            },
            { tag: 'String', value: 'Also Show' }
        ])).toMatchSnapshot()
    })

    it('should correctly evaluate conditionals', async () => {
        const evaluator = jest.fn().mockImplementation(async (src) => {
            switch(src) {
                case 'checkOne': return true
                case 'checkTwo': return false
            }
        })
        const output = await flattenTaggedMessageContent([
            { tag: 'String', value: 'Show this, ' },
            {
                tag: 'Condition',
                conditions: [{
                    if: 'checkOne',
                    dependencies: [{ key: 'checkOne', EphemeraId: 'VARIABLE#Test' }]
                }],
                contents: [
                    { tag: 'String', value: 'and this, ' },
                    {
                        tag: 'Condition',
                        conditions: [{
                            if: 'checkOne',
                            dependencies: [{ key: 'checkOne', EphemeraId: 'VARIABLE#Test' }]
                        }],
                        contents: [
                            { tag: 'String', value: `and also this` },
                        ]
                    },
                    {
                        tag: 'Condition',
                        conditions: [{
                            if: 'checkTwo',
                            dependencies: [{ key: 'checkTwo', EphemeraId: 'VARIABLE#Test' }]
                        }],
                        contents: [
                            { tag: 'String', value: `but not this` },
                        ]
                    }
                ]
            },
            {
                tag: 'Condition',
                conditions: [{
                    if: 'checkTwo',
                    dependencies: [{ key: 'checkTwo', EphemeraId: 'VARIABLE#Test' }]
                }],
                contents: [
                    { tag: 'String', value: `and not this` },
                ]
            },
            { tag: 'String', value: '.' }
        ], { evaluateConditional: evaluator })
        expect(evaluator).toHaveBeenCalledTimes(4)
        expect(output).toMatchSnapshot()
    })
})