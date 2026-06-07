import descendantsToRender from "./descendantsToRender"
import { Descendant } from "slate"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { StandardRender } from "@tonylb/mtw-wml/ts/standardize/render"

describe('descendantsToRender', () => {
    // Test Basic Text Rendering
    describe('Basic Text Rendering', () => {
        it('should return an empty StandardRender from empty paragraph', () => {
            const standard = new StandardForm('<Asset uuid=(base) />')
            const items: Descendant[] = [{ type: 'paragraph', children: [{ text: '' }]}]
            expect(descendantsToRender(standard)(items).toJSON()).toEqual([])
        })

        it('should return a text description', () => {
            const standard = new StandardForm('<Asset uuid=(base) />')
            const items: Descendant[] = [{
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
            }]
            expect(descendantsToRender(standard)(items).toJSON()).toEqual([
                'This is a test ',
                { data: { tag: 'Link', to: 'testFeature', text: 'with a link' }, children: [] },
                ' and more text.'
            ])
        })

        it('should handle single character text', () => {
            const standard = new StandardForm('<Asset uuid=(base) />')
            const items: Descendant[] = [{ type: 'paragraph', children: [{ text: 'A' }]}]
            expect(descendantsToRender(standard)(items).toJSON()).toEqual(['A'])
        })

        it('should handle special characters', () => {
            const standard = new StandardForm('<Asset uuid=(base) />')
            const items: Descendant[] = [{ type: 'paragraph', children: [{ text: 'Hello & World! @#$%' }]}]
            expect(descendantsToRender(standard)(items).toJSON()).toEqual(['Hello & World! @#$%'])
        })
    })

    // Test Link Rendering
    describe('Link Rendering', () => {
        it('should handle feature links correctly', () => {
            const standard = new StandardForm('<Asset uuid=(base)><Feature key=(testFeature) /></Asset>')
            const items: Descendant[] = [{
                type: 'paragraph',
                children: [
                    { text: 'Click ' },
                    { type: 'featureLink', to: 'testFeature', children: [{ text: 'here' }] },
                    { text: ' to continue' }
                ]
            }]
            expect(descendantsToRender(standard)(items).toJSON()).toEqual([
                'Click ',
                { data: { tag: 'Link', to: 'testFeature', text: 'here' }, children: [] },
                ' to continue'
            ])
        })

        it('should handle knowledge links correctly', () => {
            const standard = new StandardForm('<Asset uuid=(base)><Knowledge key=(testKnowledge) /></Asset>')
            const items: Descendant[] = [{
                type: 'paragraph',
                children: [
                    { text: 'Learn ' },
                    { type: 'knowledgeLink', to: 'testKnowledge', children: [{ text: 'more' }] },
                    { text: ' about this' }
                ]
            }]
            expect(descendantsToRender(standard)(items).toJSON()).toEqual([
                'Learn ',
                { data: { tag: 'Link', to: 'testKnowledge', text: 'more' }, children: [] },
                ' about this'
            ])
        })

        it('should handle multiple links in sequence', () => {
            const standard = new StandardForm('<Asset uuid=(base)><Feature key=(feature1) /><Knowledge key=(knowledge1) /></Asset>')
            const items: Descendant[] = [{
                type: 'paragraph',
                children: [
                    { type: 'featureLink', to: 'feature1', children: [{ text: 'First' }] },
                    { text: ' and ' },
                    { type: 'knowledgeLink', to: 'knowledge1', children: [{ text: 'Second' }] }
                ]
            }]
            expect(descendantsToRender(standard)(items).toJSON()).toEqual([
                { data: { tag: 'Link', to: 'feature1', text: 'First' }, children: [] },
                ' and ',
                { data: { tag: 'Link', to: 'knowledge1', text: 'Second' }, children: [] }
            ])
        })
    })

    // Test Whitespace Handling
    describe('Whitespace Handling', () => {
        it('should replace paragraph-edge spaces with Space tags before br and at document end', () => {
            const standard = new StandardForm('<Asset uuid=(base)><Feature key=(testFeature) /></Asset>')
            const items: Descendant[] = [{
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
            }]
            expect(descendantsToRender(standard)(items).toJSON()).toEqual([
                'This is a test.',
                { data: { tag: 'Space' }, children: [] },
                { data: { tag: 'br' }, children: [] },
                'With ',
                { data: { tag: 'Link', to: 'testFeature', text: 'link' }, children: [] },
                { data: { tag: 'Space' }, children: [] }
            ])
        })

        it('should handle multiple consecutive spaces', () => {
            const standard = new StandardForm('<Asset uuid=(base) />')
            const items: Descendant[] = [{
                type: 'paragraph',
                children: [{ text: 'Text    with    multiple    spaces' }]
            }]
            expect(descendantsToRender(standard)(items).toJSON()).toEqual(['Text    with    multiple    spaces'])
        })

        it('should handle tabs and newlines in text', () => {
            const standard = new StandardForm('<Asset uuid=(base) />')
            const items: Descendant[] = [{
                type: 'paragraph',
                children: [{ text: 'Text\twith\ttabs\nand\nnewlines' }]
            }]
            expect(descendantsToRender(standard)(items).toJSON()).toEqual(['Text\twith\ttabs\nand\nnewlines'])
        })
    })

    // Test Line Break Handling
    describe('Line Break Handling', () => {
        it('should replace paragraph breaks with LineBreak tags', () => {
            const standard = new StandardForm('<Asset uuid=(base) />')
            const items: Descendant[] = [{
                type: 'paragraph',
                children: [{ text: 'This is a test.' }]
            },
            {
                type: 'paragraph',
                children: [{ text: 'With two paragraphs.' }]
            }]
            expect(descendantsToRender(standard)(items).toJSON()).toEqual([
                'This is a test.',
                { data: { tag: 'br' }, children: [] },
                'With two paragraphs.'
            ])
        })

        it('should handle multiple consecutive paragraphs', () => {
            const standard = new StandardForm('<Asset uuid=(base) />')
            const items: Descendant[] = [
                { type: 'paragraph', children: [{ text: 'First paragraph' }] },
                { type: 'paragraph', children: [{ text: 'Second paragraph' }] },
                { type: 'paragraph', children: [{ text: 'Third paragraph' }] }
            ]
            expect(descendantsToRender(standard)(items).toJSON()).toEqual([
                'First paragraph',
                { data: { tag: 'br' }, children: [] },
                'Second paragraph',
                { data: { tag: 'br' }, children: [] },
                'Third paragraph'
            ])
        })

        it('should handle empty paragraphs', () => {
            const standard = new StandardForm('<Asset uuid=(base) />')
            const items: Descendant[] = [
                { type: 'paragraph', children: [{ text: 'First' }] },
                { type: 'paragraph', children: [{ text: '' }] },
                { type: 'paragraph', children: [{ text: 'Last' }] }
            ]
            expect(descendantsToRender(standard)(items).toJSON()).toEqual([
                'First',
                { data: { tag: 'DoubleBR' }, children: [] },
                'Last'
            ])
        })
    })

    describe('DoubleSpace (Track D)', () => {
        it('should emit DoubleSpace for mid-line double space', () => {
            const standard = new StandardForm('<Asset uuid=(base) />')
            const items: Descendant[] = [{ type: 'paragraph', children: [{ text: 'Hello  world' }] }]
            expect(descendantsToRender(standard)(items).toJSON()).toEqual([
                'Hello',
                { data: { tag: 'DoubleSpace' }, children: [] },
                'world'
            ])
        })

        it('should emit DoubleSpace before link when text ends with double space', () => {
            const standard = new StandardForm('<Asset uuid=(base)><Feature key=(feature1) /></Asset>')
            const items: Descendant[] = [{
                type: 'paragraph',
                children: [
                    { text: 'Hello  ' },
                    { type: 'featureLink', to: 'feature1', children: [{ text: 'link' }] }
                ]
            }]
            expect(descendantsToRender(standard)(items).toJSON()).toEqual([
                'Hello',
                { data: { tag: 'DoubleSpace' }, children: [] },
                { data: { tag: 'Link', to: 'feature1', text: 'link' }, children: [] }
            ])
        })
    })

    // Test Mixed Content
    describe('Mixed Content', () => {
        it('should handle complex mixed content with links and formatting', () => {
            const standard = new StandardForm('<Asset uuid=(base)><Feature key=(feature1) /><Knowledge key=(knowledge1) /></Asset>')
            const items: Descendant[] = [{
                type: 'paragraph',
                children: [
                    { text: 'Welcome to ' },
                    { type: 'featureLink', to: 'feature1', children: [{ text: 'our world' }] },
                    { text: '! Learn ' },
                    { type: 'knowledgeLink', to: 'knowledge1', children: [{ text: 'more' }] },
                    { text: ' about it.' }
                ]
            }]
            expect(descendantsToRender(standard)(items).toJSON()).toEqual([
                'Welcome to ',
                { data: { tag: 'Link', to: 'feature1', text: 'our world' }, children: [] },
                '! Learn ',
                { data: { tag: 'Link', to: 'knowledge1', text: 'more' }, children: [] },
                ' about it.'
            ])
        })

        it('should handle mixed content across multiple paragraphs', () => {
            const standard = new StandardForm('<Asset uuid=(base)><Feature key=(feature1) /></Asset>')
            const items: Descendant[] = [
                {
                    type: 'paragraph',
                    children: [
                        { text: 'First paragraph with ' },
                        { type: 'featureLink', to: 'feature1', children: [{ text: 'link' }] }
                    ]
                },
                {
                    type: 'paragraph',
                    children: [{ text: 'Second paragraph' }]
                }
            ]
            expect(descendantsToRender(standard)(items).toJSON()).toEqual([
                'First paragraph with ',
                { data: { tag: 'Link', to: 'feature1', text: 'link' }, children: [] },
                { data: { tag: 'br' }, children: [] },
                'Second paragraph'
            ])
        })
    })

    // Test Edge Cases
    describe('Edge Cases', () => {
        it('should handle single character paragraphs', () => {
            const standard = new StandardForm('<Asset uuid=(base) />')
            const items: Descendant[] = [{ type: 'paragraph', children: [{ text: 'A' }]}]
            expect(descendantsToRender(standard)(items).toJSON()).toEqual(['A'])
        })

        it('should handle very long text', () => {
            const standard = new StandardForm('<Asset uuid=(base) />')
            const longText = 'A'.repeat(1000)
            const items: Descendant[] = [{ type: 'paragraph', children: [{ text: longText }]}]
            expect(descendantsToRender(standard)(items).toJSON()).toEqual([longText])
        })

        it('should handle unicode characters', () => {
            const standard = new StandardForm('<Asset uuid=(base) />')
            const items: Descendant[] = [{ type: 'paragraph', children: [{ text: 'Hello 世界! 🌍' }]}]
            expect(descendantsToRender(standard)(items).toJSON()).toEqual(['Hello 世界! 🌍'])
        })

        it('should handle empty input array', () => {
            const standard = new StandardForm('<Asset uuid=(base) />')
            const items: Descendant[] = []
            expect(descendantsToRender(standard)(items).toJSON()).toEqual([])
        })
    })

    // Test Performance Considerations
    describe('Performance', () => {
        it('should handle large numbers of paragraphs efficiently', () => {
            const standard = new StandardForm('<Asset uuid=(base) />')
            const items: Descendant[] = Array.from({ length: 100 }, (_, i) => ({
                type: 'paragraph' as const,
                children: [{ text: `Paragraph ${i + 1}` }]
            }))
            
            const startTime = performance.now()
            const result = descendantsToRender(standard)(items)
            const endTime = performance.now()
            
            expect(result).toBeInstanceOf(StandardRender)
            expect(endTime - startTime).toBeLessThan(100) // Should complete in under 100ms
        })

        it('should handle large text blocks efficiently', () => {
            const standard = new StandardForm('<Asset uuid=(base) />')
            const largeText = 'Lorem ipsum '.repeat(1000)
            const items: Descendant[] = [{ type: 'paragraph', children: [{ text: largeText }]}]
            
            const startTime = performance.now()
            const result = descendantsToRender(standard)(items)
            const endTime = performance.now()
            
            expect(result).toBeInstanceOf(StandardRender)
            expect(endTime - startTime).toBeLessThan(50) // Should complete in under 50ms
        })
    })
})
