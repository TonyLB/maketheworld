import mergeTrees from './merge'

type TestType = {
    key: string;
    value: string;
}

describe('mergeTrees', () => {
    const options = {
        compare: ({ key: keyA }, { key: keyB }) => (keyA === keyB),
        extractProperties: ({ value }: TestType) => (value),
        rehydrateProperties: ({ key }, value) => ({ key, value: [...new Set(value)].join(':') })
    }

    it('should combine simple trees', () => {
        const testTreeOne = [
            { data: { key: 'A', value: 'A' }, children: [] },
        ]
        const testTreeTwo = [
            { data: { key: 'A', value: 'B' }, children: [
                { data: { key: 'D', value: 'D' }, children: [] }
            ] }
        ]
        const testTreeThree = [
            { data: { key: 'A', value: 'C' }, children: [
                { data: { key: 'E', value: 'E' }, children: [] }
            ] }
        ]
        expect(mergeTrees(options)(testTreeOne, testTreeTwo, testTreeThree)).toEqual([
            { data: { key: 'A', value: 'A:B:C' }, children: [
                { data: { key: 'D', value: 'D' }, children: [] },
                { data: { key: 'E', value: 'E' }, children: [] }
            ] },
        ])
    })

    it('should combine simple overlapping trees', () => {
        const testTreeOne = [
            { data: { key: 'A', value: 'A' }, children: [
                { data: { key: 'B', value: 'B' }, children: [] },
                { data: { key: 'C', value: 'C' }, children: [
                    { data: { key: 'E', value: 'E' }, children: [] }
                ] },
            ] },
        ]
        const testTreeTwo = [
            { data: { key: 'A', value: 'A' }, children: [
                { data: { key: 'C', value: 'C' }, children: [
                    { data: { key: 'F', value: 'F' }, children: [] }
                ] },
                { data: { key: 'D', value: 'D' }, children: [
                    { data: { key: 'C', value: 'C' }, children: [] }
                ] }
            ] }
        ]
        expect(mergeTrees(options)(testTreeOne, testTreeTwo)).toEqual([
            { data: { key: 'A', value: 'A' }, children: [
                { data: { key: 'B', value: 'B' }, children: [] },
                { data: { key: 'C', value: 'C' }, children: [
                    { data: { key: 'E', value: 'E' }, children: [] },
                    { data: { key: 'F', value: 'F' }, children: [] }
                ] },
                { data: { key: 'D', value: 'D' }, children: [
                    { data: { key: 'C', value: 'C' }, children: [] }
                ] },
            ] },
        ])
    })

})