import { stampStableRefKeys } from './stampStableRefKeys'

describe('stampStableRefKeys', () => {
    it('camelCases unique spans, unsuffixed, in order', () => {
        expect(stampStableRefKeys([
            { type: 'text', text: 'get' },
            { type: 'objectSpan', span: 'bag' },
            { type: 'text', text: 'from' },
            { type: 'objectSpan', span: 'table' },
        ])).toEqual([
            { type: 'text', text: 'get' },
            { type: 'objectSpan', span: 'bag', stableRefKey: 'bagRef' },
            { type: 'text', text: 'from' },
            { type: 'objectSpan', span: 'table', stableRefKey: 'tableRef' },
        ])
    })

    it('leaves an all-text (zero-referent) skeleton untouched', () => {
        expect(stampStableRefKeys([{ type: 'text', text: 'look' }])).toEqual([
            { type: 'text', text: 'look' },
        ])
    })

    it('numbers both occurrences when two spans camelCase to the same base', () => {
        expect(stampStableRefKeys([
            { type: 'text', text: 'put' },
            { type: 'objectSpan', span: 'bench' },
            { type: 'text', text: 'on' },
            { type: 'objectSpan', span: 'bench' },
        ])).toEqual([
            { type: 'text', text: 'put' },
            { type: 'objectSpan', span: 'bench', stableRefKey: 'benchRef1' },
            { type: 'text', text: 'on' },
            { type: 'objectSpan', span: 'bench', stableRefKey: 'benchRef2' },
        ])
    })

    it('camelCases a multi-word span', () => {
        expect(stampStableRefKeys([
            { type: 'objectSpan', span: 'big bag' },
        ])).toEqual([
            { type: 'objectSpan', span: 'big bag', stableRefKey: 'bigBagRef' },
        ])
    })

    it('numbers duplicate multi-word spans the same way as single-word ones', () => {
        expect(stampStableRefKeys([
            { type: 'objectSpan', span: 'big bag' },
            { type: 'objectSpan', span: 'big bag' },
        ])).toEqual([
            { type: 'objectSpan', span: 'big bag', stableRefKey: 'bigBagRef1' },
            { type: 'objectSpan', span: 'big bag', stableRefKey: 'bigBagRef2' },
        ])
    })

    it('splits on non-alphanumeric characters when camelCasing', () => {
        expect(stampStableRefKeys([
            { type: 'objectSpan', span: "sam's hat" },
        ])).toEqual([
            { type: 'objectSpan', span: "sam's hat", stableRefKey: 'samSHatRef' },
        ])
    })
})
