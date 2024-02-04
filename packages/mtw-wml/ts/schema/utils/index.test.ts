import { compressWhitespace, deIndentWML, removeIrrelevantWhitespace } from '.'

describe('compressWhitespace', () => {
    it('should return empty on an empty input', () => {
        expect(compressWhitespace([])).toEqual([])
    })

    it('should remove leading whitespace at beginning', () => {
        expect(compressWhitespace([
            { data: { tag: 'String', value: ' Test' }, children: [] }
        ])).toEqual([
            { data: { tag: 'String', value: 'Test' }, children: [] }
        ])
    })

    it('should remove leading whitespace after Space', () => {
        expect(compressWhitespace([
            { data: { tag: 'Space' }, children: [] },
            { data: { tag: 'String', value: ' Test' }, children: [] }
        ])).toEqual([
            { data: { tag: 'Space' }, children: [] },
            { data: { tag: 'String', value: 'Test' }, children: [] }
        ])
    })

    it('should remove leading whitespace after line break', () => {
        expect(compressWhitespace([
            { data: { tag: 'br' }, children: [] },
            { data: { tag: 'String', value: ' Test' }, children: [] }
        ])).toEqual([
            { data: { tag: 'br' }, children: [] },
            { data: { tag: 'String', value: 'Test' }, children: [] }
        ])
    })

    it('should remove trailing whitespace at end', () => {
        expect(compressWhitespace([
            { data: { tag: 'String', value: 'Test ' }, children: [] }
        ])).toEqual([
            { data: { tag: 'String', value: 'Test' }, children: [] }
        ])
    })

    it('should remove trailing whitespace before Space', () => {
        expect(compressWhitespace([
            { data: { tag: 'String', value: 'Test ' }, children: [] },
            { data: { tag: 'Space' }, children: [] }
        ])).toEqual([
            { data: { tag: 'String', value: 'Test' }, children: [] },
            { data: { tag: 'Space' }, children: [] }
        ])
    })

    it('should remove trailing whitespace before line break', () => {
        expect(compressWhitespace([
            { data: { tag: 'String', value: 'Test ' }, children: [] },
            { data: { tag: 'br' }, children: [] }
        ])).toEqual([
            { data: { tag: 'String', value: 'Test' }, children: [] },
            { data: { tag: 'br' }, children: [] }
        ])
    })

    it('should eliminate whitespace compressed to nothing', () => {
        expect(compressWhitespace([
            { data: { tag: 'String', value: ' ' }, children: [] },
            { data: { tag: 'br' }, children: [] }
        ])).toEqual([
            { data: { tag: 'br' }, children: [] }
        ])
    })

    it('should compress any number of Spacers after linebreak', () => {
        expect(compressWhitespace([
            { data: { tag: 'String', value: 'Test' }, children: [] },
            { data: { tag: 'br' }, children: [] },
            { data: { tag: 'Space' }, children: [] },
            { data: { tag: 'Space' }, children: [] },
            { data: { tag: 'Space' }, children: [] },
            { data: { tag: 'Space' }, children: [] },
            { data: { tag: 'String', value: 'Second line' }, children: [] }
        ])).toEqual([
            { data: { tag: 'String', value: 'Test' }, children: [] },
            { data: { tag: 'br' }, children: [] },
            { data: { tag: 'String', value: 'Second line' }, children: [] }
        ])
    })

    it('should compress any number of Spacers before linebreak', () => {
        expect(compressWhitespace([
            { data: { tag: 'String', value: 'Test' }, children: [] },
            { data: { tag: 'Space' }, children: [] },
            { data: { tag: 'Space' }, children: [] },
            { data: { tag: 'Space' }, children: [] },
            { data: { tag: 'Space' }, children: [] },
            { data: { tag: 'br' }, children: [] },
            { data: { tag: 'String', value: 'Second line' }, children: [] }
        ])).toEqual([
            { data: { tag: 'String', value: 'Test' }, children: [] },
            { data: { tag: 'br' }, children: [] },
            { data: { tag: 'String', value: 'Second line' }, children: [] }
        ])
    })

    it('should compress any number of Spacers', () => {
        expect(compressWhitespace([
            { data: { tag: 'String', value: 'Test' }, children: [] },
            { data: { tag: 'Space' }, children: [] },
            { data: { tag: 'Space' }, children: [] },
            { data: { tag: 'Space' }, children: [] },
            { data: { tag: 'Space' }, children: [] },
            { data: { tag: 'String', value: 'Second line' }, children: [] }
        ])).toEqual([
            { data: { tag: 'String', value: 'Test' }, children: [] },
            { data: { tag: 'Space' }, children: [] },
            { data: { tag: 'String', value: 'Second line' }, children: [] }
        ])
    })

})

describe('removeIrrelevantWhitespace', () => {

    it('should compress Space between adjacent connected conditional tags', () => {
        expect(removeIrrelevantWhitespace([
            {
                data: { tag: 'If', conditions: [{ if: 'true' }] },
                children: []
            },
            { data: { tag: 'Space' }, children: [] },
            {
                data: { tag: 'If', conditions: [{ if: 'true', not: true }, { if: 'false' }] },
                children: []
            },
            { data: { tag: 'br' }, children: [] },
            {
                data: { tag: 'If', conditions: [{ if: 'true', not: true }, { if: 'false', not: true }] },
                children: []
            }
        ])).toEqual([
            {
                data: { tag: 'If', conditions: [{ if: 'true' }] },
                children: []
            },
            {
                data: { tag: 'If', conditions: [{ if: 'true', not: true }, { if: 'false' }] },
                children: []
            },
            {
                data: { tag: 'If', conditions: [{ if: 'true', not: true }, { if: 'false', not: true }] },
                children: []
            }
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