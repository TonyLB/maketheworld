import { vi } from 'vitest'
import reducer, {
    receiveMessages,
    getMessages
} from './index'
import {
    WorldMessage
} from '@tonylb/mtw-interfaces/ts/messages'

vi.mock('../../cacheDB')

describe('messages reducer', () => {

    describe('receiveMessages', () => {
        const testArray = [
            [2, 'Test-2'],
            [100, 'Test-B'],
            [100, 'Test-H'],
            [10000, 'Test-10000']
        ].map(([value, label]) => ({
            DisplayProtocol: 'WorldMessage',
            MessageId: label,
            Message: ['Test'],
            CreatedTime: value,
            Target: 'CHARACTER#Test'
        })) as WorldMessage[]

        const state = {
            'CHARACTER#TESS': testArray
        }

        it('should accept message in empty state', () => {
            expect(reducer({}, receiveMessages([{
                DisplayProtocol: 'WorldMessage',
                CreatedTime: 1,
                Message: ['Test message'],
                MessageId: 'Test',
                Target: 'CHARACTER#TESS'
            }]))).toEqual({
                'CHARACTER#TESS': [{
                    DisplayProtocol: 'WorldMessage',
                    CreatedTime: 1,
                    Message: ['Test message'],
                    MessageId: 'Test',
                    Target: 'CHARACTER#TESS'
                }]
            })
        })

        it('should add target entry when none exists', () => {
            expect(reducer(state, receiveMessages([{
                DisplayProtocol: 'WorldMessage',
                CreatedTime: 1,
                Message: ['Test message'],
                MessageId: 'Test',
                Target: 'CHARACTER#MARCO'
            }]))).toEqual({
                'CHARACTER#MARCO': [{
                    DisplayProtocol: 'WorldMessage',
                    CreatedTime: 1,
                    Message: ['Test message'],
                    MessageId: 'Test',
                    Target: 'CHARACTER#MARCO'
                }],
                'CHARACTER#TESS': testArray
            })
        })

        it('should insert at start of array', () => {
            expect(reducer(state, receiveMessages([{
                DisplayProtocol: 'WorldMessage',
                CreatedTime: 1,
                Message: ['Test message'],
                MessageId: 'Test',
                Target: 'CHARACTER#TESS'
            }]))).toEqual({
                'CHARACTER#TESS': [{
                        DisplayProtocol: 'WorldMessage',
                        CreatedTime: 1,
                        Message: ['Test message'],
                        MessageId: 'Test',
                        Target: 'CHARACTER#TESS'
                    },
                    ...testArray
                ]
            })
        })

        it('should insert at end of array', () => {
            expect(reducer(state, receiveMessages([{
                DisplayProtocol: 'WorldMessage',
                CreatedTime: 200000,
                Message: ['Test message'],
                MessageId: 'Test',
                Target: 'CHARACTER#TESS'
            }]))).toEqual({
                'CHARACTER#TESS': [
                    ...testArray,
                    {
                        DisplayProtocol: 'WorldMessage',
                        CreatedTime: 200000,
                        Message: ['Test message'],
                        MessageId: 'Test',
                        Target: 'CHARACTER#TESS'
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
            Message: ['Test message'],
            CreatedTime: value,
            Target: 'CHARACTER#Test'
        })) as WorldMessage[]

        const state = { messages: { 'CHARACTER#TESS': testArray } } as any

        it('should return values when available', () => {
            expect(getMessages(state)['CHARACTER#TESS']).toEqual(testArray)
        })

        it('should return empty array when target not available', () => {
            expect(getMessages(state)['CHARACTER#MARCO']).toEqual([])
        })

        it('should handle object.entries correctly', () => {
            expect(Object.entries(getMessages(state))).toEqual([['CHARACTER#TESS', testArray]])
        })
    })
})
