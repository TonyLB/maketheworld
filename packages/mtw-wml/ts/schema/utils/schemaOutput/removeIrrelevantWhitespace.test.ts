import { removeIrrelevantWhitespace } from './removeIrrelevantWhitespace'

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
