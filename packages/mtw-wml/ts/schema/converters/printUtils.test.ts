import { PrintMode } from "@tonylb/mtw-base/ts/schema/printMap"
import { isNestedPrint, optimalLineResults } from "./printUtils"

describe('nestingLevel utilities', () => {
    it('should correctly identify a nested tag', () => {
        expect(isNestedPrint('<Description>\n    Test\n</Description>')).toBe(true)
        expect(isNestedPrint('<Description>Test</Description>')).toBe(false)
        expect(isNestedPrint('<Description\n>\n    Test\n</Description>')).toBe(false)
    })

    it('should correctly choose optimalLineResults when all are within limits', () => {
        expect(optimalLineResults()([
            { printMode: PrintMode.naive, output: '<DisplayName>Test</DisplayName></Description>Test</Description>' },
            { printMode: PrintMode.nested, output: '<DisplayName>Test</DisplayName>\n</Description>Test</Description>' },
            { printMode: PrintMode.nested, output: '<DisplayName>\n    Test\n</DisplayName>\n</Description>\n    Test\n</Description>' }
        ])).toEqual([
            { printMode: PrintMode.naive, output: '<DisplayName>Test</DisplayName></Description>Test</Description>' },
            { printMode: PrintMode.nested, output: '<DisplayName>Test</DisplayName>\n</Description>Test</Description>' }
        ])
    })

    it('should correctly choose optimalLineResults when some options are beyond limits', () => {
        expect(optimalLineResults()([
            { printMode: PrintMode.naive, output: '<DisplayName>Test</DisplayName></Description>Test with a gigantic string, like the biggest ever, at least big enough for this test</Description>' },
            { printMode: PrintMode.nested, output: '<DisplayName>Test</DisplayName>\n</Description>Test with a gigantic string, like the biggest ever, at least big enough for this test</Description>' },
            { printMode: PrintMode.nested, output: '<DisplayName>\n    Test\n</DisplayName>\n</Description>\n    Test with a gigantic string, like the biggest ever, at least\n    big enough for this test\n</Description>' }
        ])).toEqual([
            { printMode: PrintMode.nested, output: '<DisplayName>\n    Test\n</DisplayName>\n</Description>\n    Test with a gigantic string, like the biggest ever, at least\n    big enough for this test\n</Description>' }
        ])
    })

    it('should correctly choose optimalLineResults when all options are beyond limits', () => {
        expect(optimalLineResults()([
            { printMode: PrintMode.naive, output: '<DisplayName>Test</DisplayName></Description>Test with a gigantic string, like the biggest ever, at least big enough for this test</Description>' },
            { printMode: PrintMode.nested, output: '<DisplayName>Test</DisplayName>\n</Description>Test with a gigantic string, like the biggest ever, at least big enough for this test</Description>' }
        ])).toEqual([
            { printMode: PrintMode.naive, output: '<DisplayName>Test</DisplayName></Description>Test with a gigantic string, like the biggest ever, at least big enough for this test</Description>' },
            { printMode: PrintMode.nested, output: '<DisplayName>Test</DisplayName>\n</Description>Test with a gigantic string, like the biggest ever, at least big enough for this test</Description>' }
        ])
    })
})
