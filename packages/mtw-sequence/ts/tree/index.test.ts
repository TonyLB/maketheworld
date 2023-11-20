import { convertToTree } from '.'

type IncomingTreeTest = {
    value: number;
    contents: IncomingTreeTest[];
}

describe('tree processing', () => {
    describe('convertToTree', () => {
        it('should correctly convert a simple tree', () => {
            expect(convertToTree<IncomingTreeTest, string>({
                extractChildren: ({ contents }) => (contents),
                extractNode: ({ value }) => (`${value}`)
            })([
                { value: 1, contents: [{ value: 2, contents: [] }, { value: 3, contents: [] }] },
                { value: 4, contents: [] }
            ])).toEqual([
                { data: '1', children: [{ data: '2', children: [] }, { data: '3', children: [] }] },
                { data: '4', children: [] }
            ])
        })
    })
})