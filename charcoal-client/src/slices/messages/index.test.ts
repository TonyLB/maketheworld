import reducer, {
    binarySearch,
    receiveMessages,
    getMessages
} from './index'
import {
    WorldMessage
} from '@tonylb/mtw-interfaces/dist/messages'

jest.mock('../../cacheDB')

describe('messages reducer', () => {
    describe('binarySearch', () => {
        const testArray = [
            [2, 'Test-2'],
            [5, 'Test-5'],
            [7, 'Test-7'],
            [8, 'Test-8'],
            [100, 'Test-B'],
            [100, 'Test-D'],
            [100, 'Test-H'],
            [1000, 'Test-1000'],
            [10000, 'Test-10000']
        ].map(([value, label]) => ({
            DisplayProtocol: 'WorldMessage',
            MessageId: label,
            Message: [{ tag: 'String', value: 'Test' }],
            CreatedTime: value,
            Target: 'Test'
        })) as WorldMessage[]

        it('should place elements at beginning of array', () => {
            expect(binarySearch(testArray, 1, 'Test-1')).toEqual({ exactMatch: false, index: 0 })
        })
        it('should place elements at end of array', () => {
            expect(binarySearch(testArray, 20000, 'Test-20000')).toEqual({ exactMatch: false, index: 9 })
        })
        it('should place elements inside array', () => {
            expect(binarySearch(testArray, 6, 'Test-6')).toEqual({ exactMatch: false, index: 2 })
        })
        it('should exact match at beginning of array', () => {
            expect(binarySearch(testArray, 2, 'Test-2')).toEqual({ exactMatch: true, index: 0 })
        })
        it('should exact match at end of array', () => {
            expect(binarySearch(testArray, 10000, 'Test-10000')).toEqual({ exactMatch: true, index: 8 })
        })
        it('should exact match inside array', () => {
            expect(binarySearch(testArray, 8, 'Test-8')).toEqual({ exactMatch: true, index: 3 })
        })

        it('should place elements at beginning of range', () => {
            expect(binarySearch(testArray, 100, 'Test-A')).toEqual({ exactMatch: false, index: 4 })
        })
        it('should place elements at end of range', () => {
            expect(binarySearch(testArray, 100, 'Test-Z')).toEqual({ exactMatch: false, index: 7 })
        })
        it('should place elements inside range', () => {
            expect(binarySearch(testArray, 100, 'Test-G')).toEqual({ exactMatch: false, index: 6 })
        })
        it('should match elements at beginning of range', () => {
            expect(binarySearch(testArray, 100, 'Test-B')).toEqual({ exactMatch: true, index: 4 })
        })
        it('should match elements at end of range', () => {
            expect(binarySearch(testArray, 100, 'Test-H')).toEqual({ exactMatch: true, index: 6 })
        })
        it('should match elements inside range', () => {
            expect(binarySearch(testArray, 100, 'Test-D')).toEqual({ exactMatch: true, index: 5 })
        })

        it('should return 0 on empty array', () => {
            expect(binarySearch([], 100, 'Test-D')).toEqual({ exactMatch: false, index: 0 })
        })
    })

    describe('receiveMessages', () => {
        const testArray = [
            [2, 'Test-2'],
            [100, 'Test-B'],
            [100, 'Test-H'],
            [10000, 'Test-10000']
        ].map(([value, label]) => ({
            DisplayProtocol: 'WorldMessage',
            MessageId: label,
            Message: [{ tag: 'String', value: 'Test' }],
            CreatedTime: value,
            Target: 'Test'
        })) as WorldMessage[]

        const state = {
            TESS: testArray
        }

        it('should accept message in empty state', () => {
            expect(reducer({}, receiveMessages([{
                DisplayProtocol: 'WorldMessage',
                CreatedTime: 1,
                Message: [{ tag: 'String', value: 'Test message' }],
                MessageId: 'Test',
                Target: 'TESS'
            }]))).toEqual({
                TESS: [{
                    DisplayProtocol: 'WorldMessage',
                    CreatedTime: 1,
                    Message: [{ tag: 'String', value: 'Test message' }],
                    MessageId: 'Test',
                    Target: 'TESS'
                }]
            })
        })

        it('should add target entry when none exists', () => {
            expect(reducer(state, receiveMessages([{
                DisplayProtocol: 'WorldMessage',
                CreatedTime: 1,
                Message: [{ tag: 'String', value: 'Test message' }],
                MessageId: 'Test',
                Target: 'MARCO'
            }]))).toEqual({
                MARCO: [{
                    DisplayProtocol: 'WorldMessage',
                    CreatedTime: 1,
                    Message: [{ tag: 'String', value: 'Test message' }],
                    MessageId: 'Test',
                    Target: 'MARCO'
                }],
                TESS: testArray
            })
        })

        it('should insert at start of array', () => {
            expect(reducer(state, receiveMessages([{
                DisplayProtocol: 'WorldMessage',
                CreatedTime: 1,
                Message: [{ tag: 'String', value: 'Test message' }],
                MessageId: 'Test',
                Target: 'TESS'
            }]))).toEqual({
                TESS: [{
                        DisplayProtocol: 'WorldMessage',
                        CreatedTime: 1,
                        Message: [{ tag: 'String', value: 'Test message' }],
                        MessageId: 'Test',
                        Target: 'TESS'
                    },
                    ...testArray
                ]
            })
        })

        it('should insert at end of array', () => {
            expect(reducer(state, receiveMessages([{
                DisplayProtocol: 'WorldMessage',
                CreatedTime: 200000,
                Message: [{ tag: 'String', value: 'Test message' }],
                MessageId: 'Test',
                Target: 'TESS'
            }]))).toEqual({
                TESS: [
                    ...testArray,
                    {
                        DisplayProtocol: 'WorldMessage',
                        CreatedTime: 200000,
                        Message: [{ tag: 'String', value: 'Test message' }],
                        MessageId: 'Test',
                        Target: 'TESS'
                    }
                ]
            })
        })
    })

    describe('getMessages proxy selector', () => {
        const testArray = [
            [2, 'Test-2'],
            [100, 'Test-B'],
            [100, 'Test-H'],
            [10000, 'Test-10000']
        ].map(([value, label]) => ({
            DisplayProtocol: 'WorldMessage',
            MessageId: label,
            Message: [{ tag: 'String', value: 'Test message' }],
            CreatedTime: value,
            Target: 'Test'
        })) as WorldMessage[]

        const state = { messages: { TESS: testArray } } as any

        it('should return values when available', () => {
            expect(getMessages(state).TESS).toEqual(testArray)
        })

        it('should return empty array when target not available', () => {
            expect(getMessages(state).MARCO).toEqual([])
        })

        it('should handle object.entries correctly', () => {
            expect(Object.entries(getMessages(state))).toEqual([['TESS', testArray]])
        })
    })
})
