import { descendantsCompact } from './descendantsFromRender'
import { CustomParagraphContents } from '../baseClasses'

// We need to export descendantsCompact for testing, so let's create a test version
// First, let me check if we can access it directly or if we need to extract it

describe('descendantsCompact', () => {
    // Test basic text combination
    describe('Basic Text Combination', () => {
        it('should combine consecutive text elements', () => {
            const items: CustomParagraphContents[] = [
                { text: 'Hello' },
                { text: ' ' },
                { text: 'World' }
            ]
            const result = descendantsCompact(items)
            expect(result).toEqual([
                { text: 'Hello World' }
            ])
        })

        it('should handle single text element', () => {
            const items: CustomParagraphContents[] = [
                { text: 'Hello World' }
            ]
            const result = descendantsCompact(items)
            expect(result).toEqual([
                { text: 'Hello World' }
            ])
        })

        it('should handle empty text elements', () => {
            const items: CustomParagraphContents[] = [
                { text: '' },
                { text: 'Hello' },
                { text: '' }
            ]
            const result = descendantsCompact(items)
            expect(result).toEqual([
                { text: 'Hello' }
            ])
        })
    })

    // Test mixed content handling
    describe('Mixed Content Handling', () => {
        it('should combine text around non-text elements', () => {
            const items: CustomParagraphContents[] = [
                { text: 'Click ' },
                { type: 'featureLink', to: 'test', children: [{ text: 'here' }] },
                { text: ' to continue' }
            ]
            const result = descendantsCompact(items)
            expect(result).toEqual([
                { text: 'Click ' },
                { type: 'featureLink', to: 'test', children: [{ text: 'here' }] },
                { text: ' to continue' }
            ])
        })

        it('should combine text before and after line breaks', () => {
            const items: CustomParagraphContents[] = [
                { text: 'First line' },
                { type: 'lineBreak' },
                { text: 'Second line' }
            ]
            const result = descendantsCompact(items)
            expect(result).toEqual([
                { text: 'First line' },
                { type: 'lineBreak' },
                { text: 'Second line' }
            ])
        })

        it('should handle multiple consecutive text elements with spaces', () => {
            const items: CustomParagraphContents[] = [
                { text: 'Text' },
                { text: ' ' },
                { text: 'with' },
                { text: ' ' },
                { text: 'spaces' }
            ]
            const result = descendantsCompact(items)
            expect(result).toEqual([
                { text: 'Text with spaces' } // Multiple spaces are normalized to single spaces
            ])
        })
    })

    // Test edge cases
    describe('Edge Cases', () => {
        it('should handle empty input array', () => {
            const items: CustomParagraphContents[] = []
            const result = descendantsCompact(items)
            expect(result).toEqual([])
        })

        it('should handle only non-text elements', () => {
            const items: CustomParagraphContents[] = [
                { type: 'lineBreak' },
                { type: 'featureLink', to: 'test', children: [{ text: 'link' }] }
            ]
            const result = descendantsCompact(items)
            expect(result).toEqual([
                { type: 'lineBreak' },
                { type: 'featureLink', to: 'test', children: [{ text: 'link' }] }
            ])
        })

        it('should handle text elements with only spaces', () => {
            const items: CustomParagraphContents[] = [
                { text: ' ' },
                { text: ' ' },
                { text: ' ' }
            ]
            const result = descendantsCompact(items)
            expect(result).toEqual([
                { text: ' ' } // Multiple spaces are combined into single space
            ])
        })

        it('should handle leading and trailing spaces', () => {
            const items: CustomParagraphContents[] = [
                { text: '  ' },
                { text: 'Hello' },
                { text: '  ' }
            ]
            const result = descendantsCompact(items)
            expect(result).toEqual([
                { text: ' Hello ' } // Multiple spaces normalized to single spaces
            ])
        })
    })

    // Test space normalization behavior
    describe('Space Normalization', () => {
        it('should normalize multiple spaces to single spaces', () => {
            const items: CustomParagraphContents[] = [
                { text: 'Text with ' },
                { text: ' ' }, // This represents a Space tag converted to text
                { text: 'embedded spaces' }
            ]
            const result = descendantsCompact(items)
            expect(result).toEqual([
                { text: 'Text with embedded spaces' } // Multiple spaces normalized to single space
            ])
        })

        it('should normalize consecutive space elements to single space', () => {
            const items: CustomParagraphContents[] = [
                { text: 'Multiple' },
                { text: ' ' },
                { text: ' ' },
                { text: 'spaces' }
            ]
            const result = descendantsCompact(items)
            expect(result).toEqual([
                { text: 'Multiple spaces' } // Multiple spaces are normalized to single spaces
            ])
        })
    })

    // Test performance
    describe('Performance', () => {
        it('should handle large numbers of text elements efficiently', () => {
            const items: CustomParagraphContents[] = Array.from({ length: 1000 }, (_, i) => 
                i % 2 === 0 ? { text: `Text${i}` } : { text: ' ' }
            )
            
            const startTime = performance.now()
            const result = descendantsCompact(items)
            const endTime = performance.now()
            
            expect(result).toBeInstanceOf(Array)
            expect(endTime - startTime).toBeLessThan(100) // Should complete in under 100ms
        })
    })
})
