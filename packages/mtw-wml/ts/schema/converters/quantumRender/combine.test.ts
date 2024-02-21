import { PrintMode } from '../baseClasses'
import combine, { wordWrapCombine } from './combine'

describe('quantumRender combine', () => {
    it('should properly combine both naive and nested contents', () => {
        expect(combine(
            [
                { printMode: PrintMode.naive, tag: 'Name', output: '<Name>Test</Name>' },
                { printMode: PrintMode.nested, tag: 'Name', output: '<Name>\n    Test\n</Name>' }
            ],
            [
                { printMode: PrintMode.naive, tag: 'Description', output: '<Description>Pretty</Description>'},
                { printMode: PrintMode.nested, tag: 'Description', output: '<Description>\n    Pretty\n</Description>' }
            ],
        )).toEqual([
            { printMode: PrintMode.naive, output: '<Name>Test</Name><Description>Pretty</Description>' },
            { printMode: PrintMode.nested, output: '<Name>\n    Test\n</Name>\n<Description>\n    Pretty\n</Description>'}
        ])
    })

    it('should default to naive contents when nested unavailable', () => {
        expect(combine(
            [
                { printMode: PrintMode.naive, tag: 'Exit', output: '<Exit to=(target) />' }
            ],
            [
                { printMode: PrintMode.naive, tag: 'Description', output: '<Description>Pretty</Description>'},
                { printMode: PrintMode.nested, tag: 'Description', output: '<Description>\n    Pretty\n</Description>' }
            ],
        )).toEqual([
            { printMode: PrintMode.naive, output: '<Exit to=(target) /><Description>Pretty</Description>' },
            { printMode: PrintMode.nested, output: '<Exit to=(target) />\n<Description>\n    Pretty\n</Description>'}
        ])
    })

    it('should return multiple values in a given nesting level', () => {
        expect(combine(
            [
                { printMode: PrintMode.naive, output: '<Exit to=(target) />' }
            ],
            [
                { printMode: PrintMode.naive, output: '<If {true}><Description>Pretty</Description></If><Else><Description>Ugly</Description></If>'},
                { printMode: PrintMode.nested, output: '<If {true}><Description>Pretty</Description></If>\n<Else><Description>Ugly</Description></If>'},
                { printMode: PrintMode.nested, output: '<If {true}>\n    <Description>Pretty</Description>\n</If>\n<Else>\n    <Description>Ugly</Description>\n</If>'}
            ],
        )).toEqual([
            { printMode: PrintMode.naive, output: '<Exit to=(target) /><If {true}><Description>Pretty</Description></If><Else><Description>Ugly</Description></If>' },
            { printMode: PrintMode.nested, output: '<Exit to=(target) />\n<If {true}><Description>Pretty</Description></If>\n<Else><Description>Ugly</Description></If>'},
            { printMode: PrintMode.nested, output: '<Exit to=(target) />\n<If {true}>\n    <Description>Pretty</Description>\n</If>\n<Else>\n    <Description>Ugly</Description>\n</If>'}
        ])
    })

    it('should line up row-level iterations in a given nesting level', () => {
        expect(combine(
            [
                { printMode: PrintMode.naive, output: '<If {true}><Name>Garden</Name></If><Else><Name>Wasteland</Name></If>'},
                { printMode: PrintMode.nested, output: '<If {true}><Name>Garden</Name></If>\n<Else><Name>Wasteland</Name></If>'},
                { printMode: PrintMode.nested, output: '<If {true}>\n    <Name>Garden</Name>\n</If>\n<Else>\n    <Name>Wasteland</Name>\n</If>'}
            ],
            [
                { printMode: PrintMode.naive, output: '<If {true}><Description>Pretty</Description></If><Else><Description>Ugly</Description></If>'},
                { printMode: PrintMode.nested, output: '<If {true}><Description>Pretty</Description></If>\n<Else><Description>Ugly</Description></If>'},
                { printMode: PrintMode.nested, output: '<If {true}>\n    <Description>Pretty</Description>\n</If>\n<Else>\n    <Description>Ugly</Description>\n</If>'}
            ],
        )).toEqual([
            { printMode: PrintMode.naive, output: '<If {true}><Name>Garden</Name></If><Else><Name>Wasteland</Name></If><If {true}><Description>Pretty</Description></If><Else><Description>Ugly</Description></If>' },
            { printMode: PrintMode.nested, output: '<If {true}><Name>Garden</Name></If>\n<Else><Name>Wasteland</Name></If>\n<If {true}><Description>Pretty</Description></If>\n<Else><Description>Ugly</Description></If>'},
            { printMode: PrintMode.nested, output: '<If {true}>\n    <Name>Garden</Name>\n</If>\n<Else>\n    <Name>Wasteland</Name>\n</If>\n<If {true}>\n    <Description>Pretty</Description>\n</If>\n<Else>\n    <Description>Ugly</Description>\n</If>'}
        ])
    })
})


describe('quantumRender wordWrapCombine', () => {
    it('should properly combine both naive and nested contents', () => {
        expect(wordWrapCombine(0)(
            [
                { printMode: PrintMode.naive, tag: 'String', output: 'Test' }
            ],
            [
                { printMode: PrintMode.naive, tag: 'Link', output: '<Link to=(target)>Link</Link>'},
                { printMode: PrintMode.nested, tag: 'Link', output: '<Link to=(target)>\n    Link\n</Link>' }
            ],
        )).toEqual([
            { printMode: PrintMode.naive, output: 'Test<Link to=(target)>Link</Link>'},
            { printMode: PrintMode.nested, output: 'Test<Link to=(target)>\n    Link\n</Link>' }
        ])
    })

    it('should properly word-wrap text at start of line', () => {
        expect(wordWrapCombine(10)(
            [
                { printMode: PrintMode.naive, tag: 'String', output: 'Test of a very long string, like, really long indeed, in a very compacted space in terms of indent' }
            ],
            [
                { printMode: PrintMode.naive, tag: 'Link', output: '<Link to=(target)>Link</Link>'},
                { printMode: PrintMode.nested, tag: 'Link', output: '<Link to=(target)>\n    Link\n</Link>' }
            ],
        )).toEqual([
            { printMode: PrintMode.naive, output: 'Test of a very long string, like, really\nlong indeed, in a very compacted space\nin terms of\nindent<Link to=(target)>Link</Link>'},
            { printMode: PrintMode.nested, output: 'Test of a very long string, like, really\nlong indeed, in a very compacted space\nin terms of indent<Link to=(target)>\n    Link\n</Link>' }
        ])
    })

    it('should properly word-wrap text after padding', () => {
        expect(wordWrapCombine(10)(
            [
                { printMode: PrintMode.naive, tag: 'Link', output: '<Link to=(target)>Link</Link>'},
                { printMode: PrintMode.nested, tag: 'Link', output: '<Link to=(target)>\n    Link\n</Link>' }
            ],
            [
                { printMode: PrintMode.naive, tag: 'String', output: 'Test of a very long string, like, really long indeed, in a very compacted space in terms of indent' }
            ],
        )).toEqual([
            { printMode: PrintMode.naive, output: '<Link to=(target)>Link</Link>Test of a\nvery long string, like, really long\nindeed, in a very compacted space in\nterms of indent'},
            { printMode: PrintMode.nested, output: '<Link to=(target)>\n    Link\n</Link>Test of a very long string, like,\nreally long indeed, in a very compacted\nspace in terms of indent' }
        ])
    })

    it('should word-wrap text if needed to fit next non-wrappable item', () => {
        expect(wordWrapCombine(8)(
            [
                { printMode: PrintMode.naive, tag: 'String', output: 'Small text that wraps anyway' }
            ],
            [
                { printMode: PrintMode.naive, tag: 'Link', output: '<Link to=(target)>Link</Link>'},
                { printMode: PrintMode.nested, tag: 'Link', output: '<Link to=(target)>\n    Link\n</Link>' }
            ],
        )).toEqual([
            { printMode: PrintMode.naive, output: 'Small text that wraps\nanyway<Link to=(target)>Link</Link>'},
            { printMode: PrintMode.nested, output: 'Small text that wraps anyway<Link to=(target)>\n    Link\n</Link>' }
        ])
    })

    it('should word-wrap text between non-wrappable items', () => {
        expect(wordWrapCombine(5)(
            [
                { printMode: PrintMode.naive, tag: 'Link', output: '<Link to=(target)>Link</Link>'},
                { printMode: PrintMode.nested, tag: 'Link', output: '<Link to=(target)>\n    Link\n</Link>' }
            ],
            [
                { printMode: PrintMode.naive, tag: 'String', output: 'Small text that wraps anyway' }
            ],
            [
                { printMode: PrintMode.naive, tag: 'Link', output: '<Link to=(target)>Link</Link>'},
                { printMode: PrintMode.nested, tag: 'Link', output: '<Link to=(target)>\n    Link\n</Link>' }
            ],
        )).toEqual([
            { printMode: PrintMode.naive, output: '<Link to=(target)>Link</Link>Small text that wraps\nanyway<Link to=(target)>Link</Link>'},
            { printMode: PrintMode.nested, output: '<Link to=(target)>\n    Link\n</Link>Small text that wraps anyway<Link to=(target)>\n    Link\n</Link>' }
        ])
    })

})