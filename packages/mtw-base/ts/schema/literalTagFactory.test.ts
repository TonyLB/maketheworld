import { literalTagFactory } from './literalTagFactory';
import { PrintMode } from './printMap';

describe('literalTagFactory - printMap', () => {
    const shortNameTag = 'ShortName'
    const shortNameFactory = literalTagFactory(shortNameTag)
    const shortNamePrintMap = shortNameFactory.printMap

    it('should return naive print mode for short content (ShortName)', () => {
        const result = shortNamePrintMap({
            tag: { data: { tag: shortNameTag }, children: [{ data: { tag: 'String', value: 'short content' }, children: [] }] },
            options: { indent: 0 }
        })

        expect(result).toEqual([
            { printMode: PrintMode.naive, output: '<ShortName>short content</ShortName>' }
        ])
    })

    it('should return nested print mode for long content (ShortName)', () => {
        const longContent = 'This is a very long content that should be pretty printed because it exceeds the 80 characters limit when considering indentation.'
        const result = shortNamePrintMap({
            tag: { data: { tag: shortNameTag }, children: [{ data: { tag: 'String', value: longContent }, children: [] }] },
            options: { indent: 0 }
        })

        expect(result).toEqual([
            { printMode: PrintMode.nested, output: '<ShortName>\n    This is a very long content that should be pretty printed because it exceeds the\n    80 characters limit when considering indentation.\n</ShortName>' }
        ])
    })

    it('should handle indentation correctly (ShortName)', () => {
        const result = shortNamePrintMap({
            tag: { data: { tag: shortNameTag }, children: [{ data: { tag: 'String', value: 'indented content' }, children: [] }] },
            options: { indent: 2 }
        })

        expect(result).toEqual([
            { printMode: PrintMode.naive, output: '<ShortName>indented content</ShortName>' }
        ])
    })

    it('should word-wrap differently when indented (ShortName)', () => {
        const longContent = 'This is a very long content that should be pretty printed because it exceeds the 80 characters limit when considering indentation.'
        const result = shortNamePrintMap({
            tag: { data: { tag: shortNameTag }, children: [{ data: { tag: 'String', value: longContent }, children: [] }] },
            options: { indent: 3 }
        })

        // Implementation returns a single PrintMapResult with multiline output (not multiple results per line)
        expect(result).toEqual([
            {
                printMode: PrintMode.nested,
                output: '<ShortName>\n    This is a very long content that should be pretty printed because it\n    exceeds the 80 characters limit when considering indentation.\n</ShortName>'
            }
        ])
    })

    it('should return empty output for invalid tag data (ShortName)', () => {
        const result = shortNamePrintMap({
            tag: { data: { tag: 'InvalidTag' }, children: [{ data: { tag: 'String', value: 'content' }, children: [] }] },
            options: { indent: 0 }
        })

        expect(result).toEqual([
            { printMode: PrintMode.naive, output: '' }
        ])
    })

    it('should pretty-print long Default content using the same rules', () => {
        const defaultTag = 'Default'
        const { printMap } = literalTagFactory(defaultTag)
        const longContent = 'This is a very long default value that should be pretty printed because it exceeds the 80 characters limit when considering indentation.'
        const result = printMap({
            tag: { data: { tag: defaultTag }, children: [{ data: { tag: 'String', value: longContent }, children: [] }] },
            options: { indent: 0 }
        })

        expect(result).toEqual([
            {
                printMode: PrintMode.nested,
                output: '<Default>\n    This is a very long default value that should be pretty printed because it\n    exceeds the 80 characters limit when considering indentation.\n</Default>'
            }
        ])
    })
})