import { compressWhitespace, deIndentWML } from './utils'

describe('compressWhitespace', () => {
    it('should return empty on an empty input', () => {
        expect(compressWhitespace([])).toEqual([])
    })

    it('should remove leading whitespace at beginning', () => {
        expect(compressWhitespace([
            { tag: 'String', value: ' Test' }
        ])).toEqual([
            { tag: 'String', value: 'Test' }
        ])
    })

    it('should remove leading whitespace after Space', () => {
        expect(compressWhitespace([
            { tag: 'Space' },
            { tag: 'String', value: ' Test' }
        ])).toEqual([
            { tag: 'Space' },
            { tag: 'String', value: 'Test' }
        ])
    })

    it('should remove leading whitespace after line break', () => {
        expect(compressWhitespace([
            { tag: 'br' },
            { tag: 'String', value: ' Test' }
        ])).toEqual([
            { tag: 'br' },
            { tag: 'String', value: 'Test' }
        ])
    })

    it('should remove trailing whitespace at end', () => {
        expect(compressWhitespace([
            { tag: 'String', value: 'Test ' }
        ])).toEqual([
            { tag: 'String', value: 'Test' }
        ])
    })

    it('should remove trailing whitespace before Space', () => {
        expect(compressWhitespace([
            { tag: 'String', value: 'Test ' },
            { tag: 'Space' }
        ])).toEqual([
            { tag: 'String', value: 'Test' },
            { tag: 'Space' }
        ])
    })

    it('should remove trailing whitespace before line break', () => {
        expect(compressWhitespace([
            { tag: 'String', value: 'Test ' },
            { tag: 'br' }
        ])).toEqual([
            { tag: 'String', value: 'Test' },
            { tag: 'br' }
        ])
    })

    it('should eliminate whitespace compressed to nothing', () => {
        expect(compressWhitespace([
            { tag: 'String', value: ' ' },
            { tag: 'br' }
        ])).toEqual([
            { tag: 'br' }
        ])
    })

    it('should compress any number of Spacers after linebreak', () => {
        expect(compressWhitespace([
            { tag: 'String', value: 'Test' },
            { tag: 'br' },
            { tag: 'Space' },
            { tag: 'Space' },
            { tag: 'Space' },
            { tag: 'Space' },
            { tag: 'String', value: 'Second line' }
        ])).toEqual([
            { tag: 'String', value: 'Test' },
            { tag: 'br' },
            { tag: 'String', value: 'Second line' }
        ])
    })

    it('should compress any number of Spacers before linebreak', () => {
        expect(compressWhitespace([
            { tag: 'String', value: 'Test' },
            { tag: 'Space' },
            { tag: 'Space' },
            { tag: 'Space' },
            { tag: 'Space' },
            { tag: 'br' },
            { tag: 'String', value: 'Second line' }
        ])).toEqual([
            { tag: 'String', value: 'Test' },
            { tag: 'br' },
            { tag: 'String', value: 'Second line' }
        ])
    })

    it('should compress any number of Spacers', () => {
        expect(compressWhitespace([
            { tag: 'String', value: 'Test' },
            { tag: 'Space' },
            { tag: 'Space' },
            { tag: 'Space' },
            { tag: 'Space' },
            { tag: 'String', value: 'Second line' }
        ])).toEqual([
            { tag: 'String', value: 'Test' },
            { tag: 'Space' },
            { tag: 'String', value: 'Second line' }
        ])
    })

})

describe('deIndentWML', () => {
    it('should leave unindented WML unchanged', () => {
        const testWML = '<Asset key=(Test)>\n    <Room key=(ABC)>\n        <Exit to=(DEF)>Test Exit</Exit>\n    </Room>\n</Asset>'
        expect(deIndentWML(testWML)).toEqual(testWML)
    })

    it('should unindent', () => {
        expect(deIndentWML(`
            <Asset key=(Test)>
                <Room key=(ABC)>
                    <Exit to=(DEF)>Test Exit</Exit>
                </Room>
            </Asset>
        `)).toEqual('<Asset key=(Test)>\n    <Room key=(ABC)>\n        <Exit to=(DEF)>Test Exit</Exit>\n    </Room>\n</Asset>')
    })
})