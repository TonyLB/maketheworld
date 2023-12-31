import { compressWhitespace, deIndentWML, legacyContentStructure, removeIrrelevantWhitespace } from './utils'

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
                data: { tag: 'If', conditions: [{ if: 'true', dependencies: [] }], contents: [] },
                children: []
            },
            { data: { tag: 'Space' }, children: [] },
            {
                data: { tag: 'If', conditions: [{ if: 'true', dependencies: [], not: true }, { if: 'false', dependencies: [] }], contents: [] },
                children: []
            },
            { data: { tag: 'br' }, children: [] },
            {
                data: { tag: 'If', conditions: [{ if: 'true', dependencies: [], not: true }, { if: 'false', dependencies: [], not: true }], contents: [] },
                children: []
            }
        ])).toEqual([
            {
                data: { tag: 'If', conditions: [{ if: 'true', dependencies: [] }], contents: [] },
                children: []
            },
            {
                data: { tag: 'If', conditions: [{ if: 'true', dependencies: [], not: true }, { if: 'false', dependencies: [] }], contents: [] },
                children: []
            },
            {
                data: { tag: 'If', conditions: [{ if: 'true', dependencies: [], not: true }, { if: 'false', dependencies: [], not: true }], contents: [] },
                children: []
            }
        ])

    })
})

describe('legacyContentStructure', () => {
    it('should properly nest content structure', () => {
        expect(legacyContentStructure([
            {
                data: {
                    tag: 'Room',
                    key: 'Room-1',
                    contents: []
                },
                children: [
                    {
                        data: { tag: 'Name', contents: [] },
                        children: [{ data: { tag: 'String', value: 'Test Name' }, children: [] }]
                    },
                    {
                        data: { tag: 'Description', contents: [] },
                        children: [{
                            data: {
                                tag: 'If',
                                conditions: [],
                                contents: []
                            },
                            children: [{ data: { tag: 'String', value: 'Test Description' }, children: [] }]
                        }]
                    }
                ]
            }
        ])).toEqual([{
            tag: 'Room',
            key: 'Room-1',
            contents: [
                { tag: 'Name', contents: [{ tag: 'String', value: 'Test Name' }] },
                {
                    tag: 'Description',
                    contents: [{
                        tag: 'If',
                        conditions: [],
                        contents: [{ tag: 'String', value: 'Test Description' }]
                    }]
                }
            ]
        }])
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