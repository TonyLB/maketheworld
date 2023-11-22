import { TreeUtility } from './utilityClass'

type TestType = {
    key: string;
    value: string;
}

describe('utilityClass', () => {
    describe('treeToSequence', () => {
        let treeUtility: TreeUtility<TestType, string>
        beforeEach(() => {
            treeUtility = new TreeUtility({
                compare: ({ key: keyA }, { key: keyB }) => (keyA === keyB),
                extractProperties: ({ value }) => (value)
            })
        })

        it('should convert to sequence correctly', () => {
            const testSequence = treeUtility.treeToSequence([
                { data: { key: 'A', value: 'A' }, children: [] },
                { data: { key: 'B', value: 'B' }, children: [
                    { data: { key: 'C', value: 'C' }, children: [] },
                    { data: { key: 'D', value: 'D' }, children: [] }
                ]}
            ])
            expect(testSequence).toEqual([
                0, 1, 0, 2, 3, 4, 5, 4, 6, 7, 6, 2
            ])
            expect(testSequence.map((index) => (treeUtility._hierarchyIndexes.fromIndex(index)))).toEqual([
                '0', '0:P-0', '0',
                '1',
                    '1:P-1',
                    '1:2', '1:2:P-2', '1:2',
                    '1:3', '1:3:P-3', '1:3',
                '1'
            ])
            expect(treeUtility._nodeIndexes._mappingTable).toEqual([
                { key: 'A', value: 'A' },
                { key: 'B', value: 'B' },
                { key: 'C', value: 'C' },
                { key: 'D', value: 'D' }
            ])
            expect(treeUtility._propertyIndexes._mappingTable).toEqual([
                'A', 'B', 'C', 'D'
            ])
        })

        it('should index duplicates correctly', () => {
            const testSequence = treeUtility.treeToSequence([
                { data: { key: 'A', value: 'A' }, children: [] },
                { data: { key: 'A', value: 'Z' }, children: [
                    { data: { key: 'B', value: 'B' }, children: [] },
                    { data: { key: 'B', value: 'B' }, children: [] }
                ]}
            ])
            expect(testSequence).toEqual([
                0, 1, 0, 0, 2, 3, 4, 3, 3, 4, 3, 0
            ])
            expect(testSequence.map((index) => (treeUtility._hierarchyIndexes.fromIndex(index)))).toEqual([
                '0', '0:P-0', '0',
                '0',
                    '0:P-1',
                    '0:1', '0:1:P-2', '0:1',
                    '0:1', '0:1:P-2', '0:1',
                '0'
            ])
            expect(treeUtility._nodeIndexes._mappingTable).toEqual([
                { key: 'A', value: 'A' },
                { key: 'B', value: 'B' }
            ])
            expect(treeUtility._propertyIndexes._mappingTable).toEqual([
                'A', 'Z', 'B'
            ])
        })
    })
})