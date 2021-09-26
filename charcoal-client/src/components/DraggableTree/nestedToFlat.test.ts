import nestedToFlat from './nestedToFlat'

interface ITest {
    name: string;
}

describe('nestedToFlat', () => {
    it('returns empty list from empty tree', () => {
        expect(nestedToFlat([])).toEqual([])
    })
    it('returns rows for simple conversion', () => {
        const compare = nestedToFlat<ITest>([{
                item: { name: 'A' },
                children: [{
                    item: { name: 'B' },
                    children: []
                },
                {
                    item: { name: 'C' },
                    children: []
                }]
            },
            {
                item: { name: 'G' },
                children: []
            }])
        expect(compare).toEqual([
            {
                item: { name: 'A' },
                level: 0,
                open: true,
                verticalRows: 2
            },
            {
                item: { name: 'B' },
                level: 1,
                verticalRows: 0,
                ancestry: [{}]
            },
            {
                item: { name: 'C' },
                level: 1,
                verticalRows: 0
            },
            {
                item: { name: 'G' },
                level: 0,
                verticalRows: 0
            }
        ])
    })
    it('returns rows for complex conversion', () => {
        const compare = nestedToFlat<ITest>([{
                item: { name: 'A' },
                children: [{
                    item: { name: 'B' },
                    children: []
                },
                {
                    item: { name: 'C' },
                    children: [
                        {
                            item: { name: 'D' },
                            children: [
                                {
                                    item: { name: 'E' },
                                    draggingSource: true,
                                    children: []
                                }
                            ]
                        }
                    ],
                },
                {
                    item: { name: 'F' },
                    children: []
                }]
            },
            {
                item: { name: 'G' },
                children: []
            }])

        expect(compare).toEqual([
            {
                item: { name: 'A' },
                level: 0,
                open: true,
                verticalRows: 5
            },
            {
                item: { name: 'B' },
                level: 1,
                verticalRows: 0
            },
            {
                item: { name: 'C' },
                level: 1,
                open: true,
                verticalRows: 1
            },
            {
                item: { name: 'D' },
                level: 2,
                open: true,
                verticalRows: 1
            },
            {
                item: { name: 'E' },
                level: 3,
                draggingSource: true,
                verticalRows: 0
            },
            {
                item: { name: 'F' },
                level: 1,
                verticalRows: 0
            },
            {
                item: { name: 'G' },
                level: 0,
                verticalRows: 0
            }
        ])
    })
    it('returns rows correctly when some closed', () => {
        const compare = nestedToFlat<ITest>([{
                item: { name: 'A' },
                open: false,
                children: [{
                    item: { name: 'B' },
                    children: []
                },
                {
                    item: { name: 'C' },
                    children: [
                        {
                            item: { name: 'D' },
                            children: [
                                {
                                    item: { name: 'E' },
                                    children: []
                                }
                            ]
                        }
                    ],
                },
                {
                    item: { name: 'F' },
                    children: []
                }]
            },
            {
                item: { name: 'G' },
                children: []
            }])

        expect(compare).toEqual([
            {
                item: { name: 'A' },
                level: 0,
                open: false,
                verticalRows: 0
            },
            {
                item: { name: 'G' },
                level: 0,
                verticalRows: 0
            }
        ])
    })
})
