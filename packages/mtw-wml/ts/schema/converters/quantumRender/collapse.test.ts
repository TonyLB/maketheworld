import { PrintMode } from '../baseClasses'
import collapse from './collapse'

describe('quantumRender collapse', () => {
    it('should properly return first value when it fits', () => {
        expect(collapse([
            { printMode: PrintMode.naive, output: '<Name>Test</Name>' },
            { printMode: PrintMode.nested, output: '<Name>\n    Test\n</Name>' }
        ])).toEqual({ printMode: PrintMode.naive, output: '<Name>Test</Name>' })
    })

    it('should properly return later value when the first does not fit', () => {
        expect(collapse([
            { printMode: PrintMode.naive, output: '<Name>Test</Name><Description>A nice long description to push past the line boundaries</Description>' },
            { printMode: PrintMode.nested, output: '<Name>\n    Test\n</Name>\n<Description>\n    A nice long description to push past the line boundaries\n</Description>' }
        ], { indent: 10 })).toEqual({ printMode: PrintMode.nested, output: '<Name>\n    Test\n</Name>\n<Description>\n    A nice long description to push past the line boundaries\n</Description>' })
    })
})
