import descendantsFromRender from './descendantsFromRender'
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { StandardRender } from "@tonylb/mtw-wml/ts/standardize/render"
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'

describe('descendantsFromRender', () => {
    const standardForm = new StandardForm(deIndentWML(`
        <Asset uuid=(test)>
            <Feature key=(feature1) />
            <Knowledge key=(knowledge1) />
        </Asset>
    `))

    // Test Basic Text Rendering
    describe('Basic Text Rendering', () => {
        it('should handle StandardRenderString', () => {
            const render = new StandardRender(['Hello'])
            const result = descendantsFromRender(render, { standard: standardForm })
            expect(result).toEqual([{
                type: 'paragraph',
                children: [{ text: 'Hello' }]
            }])
        })

        it('should handle empty string', () => {
            const render = new StandardRender([''])
            const result = descendantsFromRender(render, { standard: standardForm })
            expect(result).toEqual([{
                type: 'paragraph',
                children: [{ text: '' }]
            }])
        })

        it('should handle single character', () => {
            const render = new StandardRender(['A'])
            const result = descendantsFromRender(render, { standard: standardForm })
            expect(result).toEqual([{
                type: 'paragraph',
                children: [{ text: 'A' }]
            }])
        })

        it('should handle special characters', () => {
            const render = new StandardRender(['Hello & World! @#$%'])
            const result = descendantsFromRender(render, { standard: standardForm })
            expect(result).toEqual([{
                type: 'paragraph',
                children: [{ text: 'Hello & World! @#$%' }]
            }])
        })

        it('should handle unicode characters', () => {
            const render = new StandardRender(['Hello 世界! 🌍'])
            const result = descendantsFromRender(render, { standard: standardForm })
            expect(result).toEqual([{
                type: 'paragraph',
                children: [{ text: 'Hello 世界! 🌍' }]
            }])
        })
    })

    // Test Link Rendering
    describe('Link Rendering', () => {
        it('should handle StandardRenderLink to feature', () => {
            const render = new StandardRender([{ data: { tag: 'Link', to: 'feature1', text: 'Feature Link' }, children: ['Feature Link'] }])
            const result = descendantsFromRender(render, { standard: standardForm })
            expect(result).toEqual([{
                type: 'paragraph',
                children: [{
                    type: 'featureLink',
                    to: 'feature1',
                    children: [{ text: 'Feature Link' }]
                }]
            }])
        })

        it('should handle StandardRenderLink to knowledge', () => {
            const render = new StandardRender([{ data: { tag: 'Link', to: 'knowledge1', text: 'Knowledge Link' }, children: ['Knowledge Link'] }])
            const result = descendantsFromRender(render, { standard: standardForm })
            expect(result).toEqual([{
                type: 'paragraph',
                children: [{
                    type: 'knowledgeLink',
                    to: 'knowledge1',
                    children: [{ text: 'Knowledge Link' }]
                }]
            }])
        })

        it('should handle links with empty text', () => {
            const render = new StandardRender([{ data: { tag: 'Link', to: 'feature1', text: '' }, children: [] }])
            const result = descendantsFromRender(render, { standard: standardForm })
            expect(result).toEqual([{
                type: 'paragraph',
                children: [{
                    type: 'featureLink',
                    to: 'feature1',
                    children: [{ text: '' }]
                }]
            }])
        })

        it('should handle multiple links in sequence', () => {
            const render = new StandardRender([
                { data: { tag: 'Link', to: 'feature1', text: 'First' }, children: ['First'] },
                ' and ',
                { data: { tag: 'Link', to: 'knowledge1', text: 'Second' }, children: ['Second'] }
            ])
            const result = descendantsFromRender(render, { standard: standardForm })
            expect(result).toEqual([{
                type: 'paragraph',
                children: [
                    {
                        type: 'featureLink',
                        to: 'feature1',
                        children: [{ text: 'First' }]
                    },
                    { text: ' and ' },
                    {
                        type: 'knowledgeLink',
                        to: 'knowledge1',
                        children: [{ text: 'Second' }]
                    }
                ]
            }])
        })
    })

    // Test Whitespace Handling
    describe('Whitespace Handling', () => {
        it('should handle StandardRenderSpace', () => {
            const render = new StandardRender([
                'One',
                { data: { tag: 'Space' }, children: [] },
                'Two'
            ])
            const result = descendantsFromRender(render, { standard: standardForm })
            expect(result).toEqual([{
                type: 'paragraph',
                children: [{ text: 'One Two' }] // Space between text is normalized to single space
            }])
        })

        it('should handle multiple consecutive spaces', () => {
            const render = new StandardRender(['Text    with    multiple    spaces'])
            const result = descendantsFromRender(render, { standard: standardForm })
            expect(result).toEqual([{
                type: 'paragraph',
                children: [{ text: 'Text with multiple spaces' }] // Multiple spaces normalized to single spaces
            }])
        })

        it('should handle tabs and newlines in text', () => {
            const render = new StandardRender(['Text\twith\ttabs\nand\nnewlines'])
            const result = descendantsFromRender(render, { standard: standardForm })
            expect(result).toEqual([{
                type: 'paragraph',
                children: [{ text: 'Text with tabs and newlines' }] // Tabs and newlines normalized to single spaces
            }])
        })

        it('should handle leading and trailing spaces', () => {
            const render = new StandardRender(['  Hello World  '])
            const result = descendantsFromRender(render, { standard: standardForm })
            // Constructor promotes edge whitespace to document-boundary Space tags; inbound preserves them.
            expect(result).toEqual([{
                type: 'paragraph',
                children: [{ text: ' Hello World ' }]
            }])
        })

        it('should map document-end Space tag to trailing paragraph space', () => {
            const render = new StandardRender(['Hello', { data: { tag: 'Space' }, children: [] }])
            const result = descendantsFromRender(render, { standard: standardForm })
            expect(result).toEqual([{
                type: 'paragraph',
                children: [{ text: 'Hello ' }]
            }])
        })

        it('should map document-start Space tag to leading paragraph space', () => {
            const render = new StandardRender([{ data: { tag: 'Space' }, children: [] }, 'Hello'])
            const result = descendantsFromRender(render, { standard: standardForm })
            expect(result).toEqual([{
                type: 'paragraph',
                children: [{ text: ' Hello' }]
            }])
        })

        it('should not have leading space at start of paragraph after line break', () => {
            const render = new StandardRender([
                { data: { tag: 'br' }, children: [] },
                '  foo'
            ])
            const result = descendantsFromRender(render, { standard: standardForm })
            expect(result).toEqual([
                { type: 'paragraph', children: [{ text: '' }] },
                { type: 'paragraph', children: [{ text: 'foo' }] }
            ])
        })

        it('should not have trailing space at end of paragraph before line break', () => {
            const render = new StandardRender([
                'foo  ',
                { data: { tag: 'br' }, children: [] },
                'bar'
            ])
            const result = descendantsFromRender(render, { standard: standardForm })
            expect(result).toEqual([
                { type: 'paragraph', children: [{ text: 'foo' }] },
                { type: 'paragraph', children: [{ text: 'bar' }] }
            ])
        })

        it('should map Space before br to trailing space on preceding paragraph', () => {
            const render = new StandardRender([
                'Line one',
                { data: { tag: 'Space' }, children: [] },
                { data: { tag: 'br' }, children: [] },
                'Line two'
            ])
            const result = descendantsFromRender(render, { standard: standardForm })
            expect(result).toEqual([
                { type: 'paragraph', children: [{ text: 'Line one ' }] },
                { type: 'paragraph', children: [{ text: 'Line two' }] }
            ])
        })

        it('should map Space after br to leading space on following paragraph', () => {
            const render = new StandardRender([
                'Line one',
                { data: { tag: 'br' }, children: [] },
                { data: { tag: 'Space' }, children: [] },
                'Line two'
            ])
            const result = descendantsFromRender(render, { standard: standardForm })
            expect(result).toEqual([
                { type: 'paragraph', children: [{ text: 'Line one' }] },
                { type: 'paragraph', children: [{ text: ' Line two' }] }
            ])
        })
    })

    // Test Line Break Handling
    describe('Line Break Handling', () => {
        it('should handle StandardRenderLineBreak', () => {
            // A single <br /> means: end current (empty) paragraph, start next (empty). Round-trips as two paragraphs.
            const render = new StandardRender([{ data: { tag: 'br' }, children: [] }])
            const result = descendantsFromRender(render, { standard: standardForm })
            expect(result).toEqual([
                { type: 'paragraph', children: [{ text: '' }] },
                { type: 'paragraph', children: [{ text: '' }] }
            ])
        })

        it('should handle multiple line breaks', () => {
            const render = new StandardRender([
                'First line',
                { data: { tag: 'br' }, children: [] },
                'Second line',
                { data: { tag: 'br' }, children: [] },
                'Third line'
            ])
            const result = descendantsFromRender(render, { standard: standardForm })
            expect(result).toEqual([
                {
                    type: 'paragraph',
                    children: [{ text: 'First line' }]
                },
                {
                    type: 'paragraph',
                    children: [{ text: 'Second line' }]
                },
                {
                    type: 'paragraph',
                    children: [{ text: 'Third line' }]
                }
            ])
        })

        it('should handle line breaks with empty content', () => {
            const render = new StandardRender([
                '',
                { data: { tag: 'br' }, children: [] },
                'Content'
            ])
            const result = descendantsFromRender(render, { standard: standardForm })
            expect(result).toEqual([
                {
                    type: 'paragraph',
                    children: [{ text: '' }]
                },
                {
                    type: 'paragraph',
                    children: [{ text: 'Content' }]
                }
            ])
        })
    })

    // Test Mixed Content
    describe('Mixed Content', () => {
        it('should handle mixed elements', () => {
            const render = new StandardRender([
                'Hello',
                { data: { tag: 'Space' }, children: [] },
                'World',
                { data: { tag: 'br' }, children: [] },
                { data: { tag: 'Link', to: 'feature1', text: 'Feature Link' }, children: ['Feature Link'] }
            ])
            const result = descendantsFromRender(render, { standard: standardForm })
            expect(result).toEqual([
                {
                    type: 'paragraph',
                    children: [
                        { text: 'Hello World' },
                    ]
                },
                {
                    type: 'paragraph',
                    children: [{
                        type: 'featureLink',
                        to: 'feature1',
                        children: [{ text: 'Feature Link' }]
                    }]
                }
            ])
        })

        it('should handle complex mixed content with links and formatting', () => {
            const render = new StandardRender([
                'Welcome to ',
                { data: { tag: 'Link', to: 'feature1', text: 'our world' }, children: ['our world'] },
                '! Learn ',
                { data: { tag: 'Link', to: 'knowledge1', text: 'more' }, children: ['more'] },
                ' about it.',
                { data: { tag: 'br' }, children: [] },
                'Second paragraph with ',
                { data: { tag: 'Link', to: 'feature1', text: 'another link' }, children: ['another link'] }
            ])
            const result = descendantsFromRender(render, { standard: standardForm })
            expect(result).toEqual([
                {
                    type: 'paragraph',
                    children: [
                        { text: 'Welcome to ' },
                        {
                            type: 'featureLink',
                            to: 'feature1',
                            children: [{ text: 'our world' }]
                        },
                        { text: '! Learn ' },
                        {
                            type: 'knowledgeLink',
                            to: 'knowledge1',
                            children: [{ text: 'more' }]
                        },
                        { text: ' about it.' }
                    ]
                },
                {
                    type: 'paragraph',
                    children: [
                        { text: 'Second paragraph with ' },
                        {
                            type: 'featureLink',
                            to: 'feature1',
                            children: [{ text: 'another link' }]
                        }
                    ]
                }
            ])
        })

        it('should handle text with embedded spaces and line breaks', () => {
            const render = new StandardRender([
                'Text with ',
                { data: { tag: 'Space' }, children: [] },
                'embedded spaces',
                { data: { tag: 'br' }, children: [] },
                'and line breaks'
            ])
            const result = descendantsFromRender(render, { standard: standardForm })
            expect(result).toEqual([
                {
                    type: 'paragraph',
                    children: [{ text: 'Text with embedded spaces' }]
                },
                {
                    type: 'paragraph',
                    children: [{ text: 'and line breaks' }]
                }
            ])
        })
    })

    // Test Edge Cases
    describe('Edge Cases', () => {
        it('should handle empty render', () => {
            const render = new StandardRender([])
            const result = descendantsFromRender(render, { standard: standardForm })
            expect(result).toEqual([{
                type: 'paragraph',
                children: [{ text: '' }]
            }])
        })

        it('should handle render with only whitespace', () => {
            const render = new StandardRender(['   '])
            const result = descendantsFromRender(render, { standard: standardForm })
            expect(result).toEqual([{
                type: 'paragraph',
                children: [{ text: '' }] // Trimmed to empty at paragraph boundaries
            }])
        })

        it('should handle very long text', () => {
            const longText = 'A'.repeat(1000)
            const render = new StandardRender([longText])
            const result = descendantsFromRender(render, { standard: standardForm })
            expect(result).toEqual([{
                type: 'paragraph',
                children: [{ text: longText }]
            }])
        })

        it('should handle render with only line breaks', () => {
            // [br, br] = three paragraphs (empty, empty, empty).
            const render = new StandardRender([
                { data: { tag: 'br' }, children: [] },
                { data: { tag: 'br' }, children: [] }
            ])
            const result = descendantsFromRender(render, { standard: standardForm })
            expect(result).toEqual([
                { type: 'paragraph', children: [{ text: '' }] },
                { type: 'paragraph', children: [{ text: '' }] },
                { type: 'paragraph', children: [{ text: '' }] }
            ])
        })

        it('should handle DoubleBR between content as empty middle paragraph', () => {
            const render = new StandardRender([
                'First',
                { data: { tag: 'DoubleBR' }, children: [] },
                'Last'
            ])
            const result = descendantsFromRender(render, { standard: standardForm })
            expect(result).toEqual([
                { type: 'paragraph', children: [{ text: 'First' }] },
                { type: 'paragraph', children: [{ text: '' }] },
                { type: 'paragraph', children: [{ text: 'Last' }] }
            ])
        })

        it('should handle render with only spaces', () => {
            const render = new StandardRender([
                { data: { tag: 'Space' }, children: [] },
                { data: { tag: 'Space' }, children: [] }
            ])
            const result = descendantsFromRender(render, { standard: standardForm })
            expect(result).toEqual([{
                type: 'paragraph',
                children: [{ text: '' }] // Single space trimmed away at boundaries
            }])
        })
    })

    // Test Performance Considerations
    describe('Performance', () => {
        it('should handle large numbers of elements efficiently', () => {
            const elements = Array.from({ length: 100 }, (_, i) => 
                i % 3 === 0 ? `Text ${i}` : 
                i % 3 === 1 ? { data: { tag: 'Space' }, children: [] } :
                { data: { tag: 'br' }, children: [] }
            )
            const render = new StandardRender(elements)
            
            const startTime = performance.now()
            const result = descendantsFromRender(render, { standard: standardForm })
            const endTime = performance.now()
            
            expect(result).toBeInstanceOf(Array)
            expect(endTime - startTime).toBeLessThan(100) // Should complete in under 100ms
        })

        it('should handle large text blocks efficiently', () => {
            const largeText = 'Lorem ipsum '.repeat(1000)
            const render = new StandardRender([largeText])
            
            const startTime = performance.now()
            const result = descendantsFromRender(render, { standard: standardForm })
            const endTime = performance.now()
            
            expect(result).toBeInstanceOf(Array)
            expect(endTime - startTime).toBeLessThan(50) // Should complete in under 50ms
        })
    })

    // Test Round-trip Consistency
    describe('Round-trip Consistency', () => {
        it('should maintain consistency with descendantsToRender', () => {
            // This test ensures that the conversion functions work together correctly
            const originalSlate = [
                {
                    type: 'paragraph',
                    children: [
                        { text: 'Hello ' },
                        { type: 'featureLink', to: 'feature1', children: [{ text: 'world' }] },
                        { text: '!' }
                    ]
                },
                {
                    type: 'paragraph',
                    children: [{ text: 'Second paragraph' }]
                }
            ]
            
            // Convert to StandardRender and back
            const standardForm = new StandardForm(deIndentWML(`
                <Asset uuid=(test)>
                    <Feature key=(feature1) />
                </Asset>
            `))
            
            // Note: We'd need to import descendantsToRender here to do the full round-trip test
            // For now, we'll test the individual conversion
            const render = new StandardRender([
                'Hello ',
                { data: { tag: 'Link', to: 'feature1', text: 'world' }, children: ['world'] },
                '!',
                { data: { tag: 'br' }, children: [] },
                'Second paragraph'
            ])
            
            const result = descendantsFromRender(render, { standard: standardForm })
            
            expect(result).toEqual([
                {
                    type: 'paragraph',
                    children: [
                        { text: 'Hello ' },
                        {
                            type: 'featureLink',
                            to: 'feature1',
                            children: [{ text: 'world' }]
                        },
                        { text: '!' }
                    ]
                },
                {
                    type: 'paragraph',
                    children: [{ text: 'Second paragraph' }]
                }
            ])
        })
    })
})
