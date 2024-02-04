jest.mock('uuid')
import { v4 as uuidMock } from 'uuid'
import { genericIDFromTree } from './genericIDTree'
import { GenericTree } from './baseClasses'

const uuid = uuidMock as jest.MockedFunction<typeof uuidMock>

describe('genericIDFromTree', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })
    it('should attach UUIDs to all nodes', () => {
        uuid.mockReturnValue('UUID')
        const testTree: GenericTree<string> = [
            {
                data: 'A',
                children: [
                    { data: 'B', children: [] },
                    { data: 'C', children: [] }
                ]
            },
            { data: 'D', children: [] }
        ]
        expect(genericIDFromTree(testTree)).toEqual([
            {
                data: 'A',
                id: 'UUID',
                children: [
                    { data: 'B', children: [], id: 'UUID' },
                    { data: 'C', children: [], id: 'UUID' }
                ]
            },
            { data: 'D', children: [], id: 'UUID' }
        ])
    })
})