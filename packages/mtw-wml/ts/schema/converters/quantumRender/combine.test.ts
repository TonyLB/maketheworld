import { PrintMode } from '../baseClasses'
import combine from './combine'

describe('quantumRender combine', () => {
    it('should properly combine both naive and nested contents', () => {
        expect(combine(
            [
                { printMode: PrintMode.naive, output: '<Name>Test</Name>' },
                { printMode: PrintMode.nested, output: '<Name>\n    Test\n</Name>' }
            ],
            [
                { printMode: PrintMode.naive, output: '<Description>Pretty</Description>'},
                { printMode: PrintMode.nested, output: '<Description>\n    Pretty\n</Description>' }
            ],
        )).toEqual([
            { printMode: PrintMode.naive, output: '<Name>Test</Name><Description>Pretty</Description>' },
            { printMode: PrintMode.nested, output: '<Name>\n    Test\n</Name>\n<Description>\n    Pretty\n</Description>'}
        ])
    })

    it('should default to naive contents when nested unavailable', () => {
        expect(combine(
            [
                { printMode: PrintMode.naive, output: '<Exit to=(target) />' }
            ],
            [
                { printMode: PrintMode.naive, output: '<Description>Pretty</Description>'},
                { printMode: PrintMode.nested, output: '<Description>\n    Pretty\n</Description>' }
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
