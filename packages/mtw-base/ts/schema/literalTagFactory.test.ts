import { literalTagFactory } from './literalTagFactory';
import { PrintMode } from './printMap';

describe('literalTagFactory - printMap', () => {
    const tag = 'ShortName'
    const factory = literalTagFactory(tag)
    const printMap = factory.printMap

    it('should return naive print mode for short content', () => {
        const result = printMap({
            tag: { data: { tag }, children: [{ data: { tag: 'String', value: 'short content' }, children: [] }] },
            options: { indent: 0 }
        })

        expect(result).toEqual([
            { printMode: PrintMode.naive, output: '<ShortName>short content</ShortName>' }
        ])
    })

    it('should return nested print mode for long content', () => {
        const longContent = 'This is a very long content that should be pretty printed because it exceeds the 80 characters limit when considering indentation.'
        const result = printMap({
            tag: { data: { tag }, children: [{ data: { tag: 'String', value: longContent }, children: [] }] },
            options: { indent: 0 }
        })

        expect(result).toEqual([
            { printMode: PrintMode.nested, output: '<ShortName>\n    This is a very long content that should be pretty printed because it exceeds the\n    80 characters limit when considering indentation.\n</ShortName>' }
        ])
    })

    it('should handle indentation correctly', () => {
        const result = printMap({
            tag: { data: { tag }, children: [{ data: { tag: 'String', value: 'indented content' }, children: [] }] },
            options: { indent: 2 }
        })

        expect(result).toEqual([
            { printMode: PrintMode.naive, output: '<ShortName>indented content</ShortName>' }
        ])
    })

    it('should word-wrap differently when indented', () => {
        const longContent = 'This is a very long content that should be pretty printed because it exceeds the 80 characters limit when considering indentation.'
        const result = printMap({
            tag: { data: { tag }, children: [{ data: { tag: 'String', value: longContent }, children: [] }] },
            options: { indent: 3 }
        })

        expect(result).toEqual([
            { printMode: PrintMode.nested, output: '<ShortName>' },
            { printMode: PrintMode.nested, output: '    This is a very long content that should be pretty printed because it' },
            { printMode: PrintMode.nested, output: '    exceeds the 80 characters limit when considering indentation.' },
            { printMode: PrintMode.nested, output: '</ShortName>' }
        ])
    })

    it('should return empty output for invalid tag data', () => {
        const result = printMap({
            tag: { data: { tag: 'InvalidTag' }, children: [{ data: { tag: 'String', value: 'content' }, children: [] }] },
            options: { indent: 0 }
        })

        expect(result).toEqual([
            { printMode: PrintMode.naive, output: '' }
        ])
    })
})