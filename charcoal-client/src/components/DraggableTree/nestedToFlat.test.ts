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
                name: 'A',
                children: [{
                    name: 'B',
                    children: []
                },
                {
                    name: 'C',
                    children: []
                }]
            },
            {
                name: 'G',
                children: []
            }])
        expect(compare).toEqual([
            {
                name: 'A',
                level: 0
            },
            {
                name: 'B',
                level: 1,
            },
            {
                name: 'C',
                level: 1,
            },
            {
                name: 'G',
                level: 0
            }
        ])
    })
    it('returns rows for complex conversion', () => {
        const compare = nestedToFlat<ITest>([{
                name: 'A',
                children: [{
                    name: 'B',
                    children: []
                },
                {
                    name: 'C',
                    children: [
                        { name: 'D', children: [
                            { name: 'E', children: [] }
                        ] }
                    ],
                },
                {
                    name: 'F',
                    children: []
                }]
            },
            {
                name: 'G',
                children: []
            }])

        expect(compare).toEqual([
            {
                name: 'A',
                level: 0
            },
            {
                name: 'B',
                level: 1,
            },
            {
                name: 'C',
                level: 1
            },
            {
                name: 'D',
                level: 2,
            },
            {
                name: 'E',
                level: 3
            },
            {
                name: 'F',
                level: 1
            },
            {
                name: 'G',
                level: 0
            }
        ])
    })
})
