import { compressWhitespace } from './compressWhitespace'

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
            { data: { tag: 'Space' }, children: [] },
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
            { data: { tag: 'Space' }, children: [] },
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
            { data: { tag: 'DoubleSpace' }, children: [] },
            { data: { tag: 'String', value: 'Second line' }, children: [] }
        ])
    })

    describe('Whitespace preservation (target semantics)', () => {
        it('should preserve Space immediately before br', () => {
            expect(compressWhitespace([
                { data: { tag: 'String', value: 'Line one' }, children: [] },
                { data: { tag: 'Space' }, children: [] },
                { data: { tag: 'br' }, children: [] },
                { data: { tag: 'String', value: 'Line two' }, children: [] }
            ])).toEqual([
                { data: { tag: 'String', value: 'Line one' }, children: [] },
                { data: { tag: 'Space' }, children: [] },
                { data: { tag: 'br' }, children: [] },
                { data: { tag: 'String', value: 'Line two' }, children: [] }
            ])
        })

        it('should preserve Space immediately after br', () => {
            expect(compressWhitespace([
                { data: { tag: 'String', value: 'Line one' }, children: [] },
                { data: { tag: 'br' }, children: [] },
                { data: { tag: 'Space' }, children: [] },
                { data: { tag: 'String', value: 'Line two' }, children: [] }
            ])).toEqual([
                { data: { tag: 'String', value: 'Line one' }, children: [] },
                { data: { tag: 'br' }, children: [] },
                { data: { tag: 'Space' }, children: [] },
                { data: { tag: 'String', value: 'Line two' }, children: [] }
            ])
        })

        it('should compress multiple Spacers before br to a single Space', () => {
            expect(compressWhitespace([
                { data: { tag: 'String', value: 'Line one' }, children: [] },
                { data: { tag: 'Space' }, children: [] },
                { data: { tag: 'Space' }, children: [] },
                { data: { tag: 'Space' }, children: [] },
                { data: { tag: 'br' }, children: [] },
                { data: { tag: 'String', value: 'Line two' }, children: [] }
            ])).toEqual([
                { data: { tag: 'String', value: 'Line one' }, children: [] },
                { data: { tag: 'Space' }, children: [] },
                { data: { tag: 'br' }, children: [] },
                { data: { tag: 'String', value: 'Line two' }, children: [] }
            ])
        })

        describe('Track C -- DoubleBR (empty middle paragraph)', () => {
            const brTag = { data: { tag: 'br' as const }, children: [] as [] }
            const doubleBRTag = { data: { tag: 'DoubleBR' as const }, children: [] as [] }
            const spaceTag = { data: { tag: 'Space' as const }, children: [] as [] }

            it('should normalize two consecutive br between strings to DoubleBR', () => {
                expect(compressWhitespace([
                    { data: { tag: 'String', value: 'First' }, children: [] },
                    brTag,
                    brTag,
                    { data: { tag: 'String', value: 'Last' }, children: [] }
                ])).toEqual([
                    { data: { tag: 'String', value: 'First' }, children: [] },
                    doubleBRTag,
                    { data: { tag: 'String', value: 'Last' }, children: [] }
                ])
            })

            it('should cap three or more consecutive br at one DoubleBR', () => {
                expect(compressWhitespace([
                    { data: { tag: 'String', value: 'First' }, children: [] },
                    brTag,
                    brTag,
                    brTag,
                    { data: { tag: 'String', value: 'Last' }, children: [] }
                ])).toEqual([
                    { data: { tag: 'String', value: 'First' }, children: [] },
                    doubleBRTag,
                    { data: { tag: 'String', value: 'Last' }, children: [] }
                ])
            })

            it('should preserve Space br Space br sequence (Track B interaction)', () => {
                expect(compressWhitespace([
                    { data: { tag: 'String', value: 'Line one' }, children: [] },
                    spaceTag,
                    brTag,
                    spaceTag,
                    brTag,
                    { data: { tag: 'String', value: 'Line two' }, children: [] }
                ])).toEqual([
                    { data: { tag: 'String', value: 'Line one' }, children: [] },
                    spaceTag,
                    brTag,
                    spaceTag,
                    brTag,
                    { data: { tag: 'String', value: 'Line two' }, children: [] }
                ])
            })
        })

        describe('Phase 2d -- atomic tags (boilerplate)', () => {
            const doubleSpaceTag = { data: { tag: 'DoubleSpace' as const }, children: [] as [] }
            const doubleBRTag = { data: { tag: 'DoubleBR' as const }, children: [] as [] }

            it('should normalize adjacent Space Space to DoubleSpace', () => {
                expect(compressWhitespace([
                    { data: { tag: 'String', value: 'Hello' }, children: [] },
                    { data: { tag: 'Space' }, children: [] },
                    { data: { tag: 'Space' }, children: [] },
                    { data: { tag: 'String', value: 'world' }, children: [] }
                ])).toEqual([
                    { data: { tag: 'String', value: 'Hello' }, children: [] },
                    doubleSpaceTag,
                    { data: { tag: 'String', value: 'world' }, children: [] }
                ])
            })

            it('should pass through DoubleSpace and DoubleBR unchanged', () => {
                expect(compressWhitespace([
                    { data: { tag: 'String', value: 'Hello' }, children: [] },
                    doubleSpaceTag,
                    { data: { tag: 'String', value: 'world' }, children: [] },
                    doubleBRTag,
                    { data: { tag: 'String', value: 'Last' }, children: [] }
                ])).toEqual([
                    { data: { tag: 'String', value: 'Hello' }, children: [] },
                    doubleSpaceTag,
                    { data: { tag: 'String', value: 'world' }, children: [] },
                    doubleBRTag,
                    { data: { tag: 'String', value: 'Last' }, children: [] }
                ])
            })

            it('should not promote literal two-space string to DoubleSpace', () => {
                expect(compressWhitespace([
                    { data: { tag: 'String', value: 'Hello  world' }, children: [] }
                ])).toEqual([
                    { data: { tag: 'String', value: 'Hello  world' }, children: [] }
                ])
            })
        })
    })

})
