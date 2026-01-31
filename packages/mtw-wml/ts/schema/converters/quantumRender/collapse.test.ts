import { PrintMode } from '@tonylb/mtw-base/ts/schema/printMap'
import collapse from './collapse'

describe('quantumRender collapse', () => {
    it('should properly return first value when it fits', () => {
        expect(collapse([
            { printMode: PrintMode.naive, output: '<DisplayName>Test</DisplayName>' },
            { printMode: PrintMode.nested, output: '<DisplayName>\n    Test\n</DisplayName>' }
        ])).toEqual({ printMode: PrintMode.naive, output: '<DisplayName>Test</DisplayName>' })
    })

    it('should properly return later value when the first does not fit', () => {
        expect(collapse([
            { printMode: PrintMode.naive, output: '<DisplayName>Test</DisplayName><Description>A nice long description to push past the line boundaries</Description>' },
            { printMode: PrintMode.nested, output: '<DisplayName>\n    Test\n</DisplayName>\n<Description>\n    A nice long description to push past the line boundaries\n</Description>' }
        ], { indent: 10 })).toEqual({ printMode: PrintMode.nested, output: '<DisplayName>\n    Test\n</DisplayName>\n<Description>\n    A nice long description to push past the line boundaries\n</Description>' })
    })
})
