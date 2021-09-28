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
                key: 'A',
                item: { name: 'A' },
                children: [{
                    key: 'B',
                    item: { name: 'B' },
                    children: []
                },
                {
                    key: 'C',
                    item: { name: 'C' },
                    children: []
                }]
            },
            {
                key: 'G',
                item: { name: 'G' },
                children: []
            }])
        expect(compare).toEqual([
            {
                key: 'A',
                item: { name: 'A' },
                level: 0,
                open: true,
                verticalRows: 2,
                draggingPoints: [{ position: 1 }]
            },
            {
                key: 'B',
                item: { name: 'B' },
                level: 1,
                verticalRows: 0,
                draggingPoints: [{ position: 1}, { key: 'A', position: 1 }]
            },
            {
                key: 'C',
                item: { name: 'C' },
                level: 1,
                verticalRows: 0,
                draggingPoints: [{ position: 1 }, { key: 'A', position: 2 }]
            },
            {
                key: 'G',
                item: { name: 'G' },
                level: 0,
                verticalRows: 0,
                draggingPoints: [{ position: 2 }]
            }
        ])
    })
    it('returns rows for complex conversion', () => {
        const compare = nestedToFlat<ITest>([{
                key: 'A',
                item: { name: 'A' },
                children: [{
                    key: 'B',
                    item: { name: 'B' },
                    children: []
                },
                {
                    key: 'C',
                    item: { name: 'C' },
                    children: [
                        {
                            key: 'D',
                            item: { name: 'D' },
                            children: [
                                {
                                    key: 'E',
                                    item: { name: 'E' },
                                    draggingSource: true,
                                    children: []
                                }
                            ]
                        }
                    ],
                },
                {
                    key: 'F',
                    item: { name: 'F' },
                    children: []
                }]
            },
            {
                key: 'G',
                item: { name: 'G' },
                children: []
            }])

        expect(compare).toEqual([
            {
                key: 'A',
                item: { name: 'A' },
                level: 0,
                open: true,
                verticalRows: 5,
                draggingPoints: [{ position: 1 }]
            },
            {
                key: 'B',
                item: { name: 'B' },
                level: 1,
                verticalRows: 0,
                draggingPoints: [{ position: 1}, { key: 'A', position: 1 }]
            },
            {
                key: 'C',
                item: { name: 'C' },
                level: 1,
                open: true,
                verticalRows: 1,
                draggingPoints: [{ position: 1 }, { key: 'A', position: 2 }]
            },
            {
                key: 'D',
                item: { name: 'D' },
                level: 2,
                open: true,
                verticalRows: 1,
                draggingPoints: [{ position: 1 }, { key: 'A', position: 2 }, { key: 'C', position: 1 }]
            },
            {
                key: 'E',
                item: { name: 'E' },
                level: 3,
                draggingSource: true,
                verticalRows: 0,
                draggingPoints: [{ position: 1}, { key: 'A', position: 2 }, { key: 'C', position: 1 }, { key: 'D', position: 1 }]
            },
            {
                key: 'F',
                item: { name: 'F' },
                level: 1,
                verticalRows: 0,
                draggingPoints: [{ position: 1 }, { key: 'A', position: 3 }]
            },
            {
                key: 'G',
                item: { name: 'G' },
                level: 0,
                verticalRows: 0,
                draggingPoints: [{ position: 2 }]
            }
        ])
    })
    it('returns rows correctly when some closed', () => {
        const compare = nestedToFlat<ITest>([{
                key: 'A',
                item: { name: 'A' },
                open: false,
                children: [{
                    key: 'B',
                    item: { name: 'B' },
                    children: []
                },
                {
                    key: 'C',
                    item: { name: 'C' },
                    children: [
                        {
                            key: 'D',
                            item: { name: 'D' },
                            children: [
                                {
                                    key: 'E',
                                    item: { name: 'E' },
                                    children: []
                                }
                            ]
                        }
                    ],
                },
                {
                    key: 'F',
                    item: { name: 'F' },
                    children: []
                }]
            },
            {
                key: 'G',
                item: { name: 'G' },
                children: []
            }])

        expect(compare).toEqual([
            {
                key: 'A',
                item: { name: 'A' },
                level: 0,
                open: false,
                verticalRows: 0,
                draggingPoints: [{ position: 1 }]
            },
            {
                key: 'G',
                item: { name: 'G' },
                level: 0,
                verticalRows: 0,
                draggingPoints: [{ position: 2 }]
            }
        ])
    })
})
