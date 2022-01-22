import { MessageState } from './baseClasses'
import { RootState } from '../../store'

import {
    getMessages
} from './selectors'

const testState = {
    messages: {
        TESS: [{
            DisplayProtocol: 'World',
            MessageId: 'Test1',
            Message: 'Test1',
            CreatedTime: 0,
            Target: 'TESS'
        }, {
            DisplayProtocol: 'World',
            MessageId: 'Test2',
            Message: 'Test2',
            CreatedTime: 1,
            Target: 'TESS'
        }]
    } as MessageState
} as unknown as RootState
Object.preventExtensions(testState)

describe('messages selectors', () => {

    describe('getMessages proxy', () => {

        it('should correctly return when message data is present', () => {
            expect(getMessages(testState).TESS).toEqual([{
                DisplayProtocol: 'World',
                MessageId: 'Test1',
                Message: 'Test1',
                CreatedTime: 0,
                Target: 'TESS'
            }, {
                DisplayProtocol: 'World',
                MessageId: 'Test2',
                Message: 'Test2',
                CreatedTime: 1,
                Target: 'TESS'
            }])
        })

        it('should correctly return when no data is present', () => {
            expect(getMessages(testState).SAIONJI).toEqual([])
        })

        it('should correctly handle Object.keys', () => {
            expect(Object.keys(getMessages(testState))).toEqual(['TESS'])
        })

        it('should correctly handle Object.values', () => {
            expect(Object.values(getMessages(testState))).toEqual([[{
                DisplayProtocol: 'World',
                MessageId: 'Test1',
                Message: 'Test1',
                CreatedTime: 0,
                Target: 'TESS'
            }, {
                DisplayProtocol: 'World',
                MessageId: 'Test2',
                Message: 'Test2',
                CreatedTime: 1,
                Target: 'TESS'
            }]])
        })

        it('should correctly handle Object.entries', () => {
            expect(Object.entries(getMessages(testState))).toEqual([['TESS', [{
                DisplayProtocol: 'World',
                MessageId: 'Test1',
                Message: 'Test1',
                CreatedTime: 0,
                Target: 'TESS'
            }, {
                DisplayProtocol: 'World',
                MessageId: 'Test2',
                Message: 'Test2',
                CreatedTime: 1,
                Target: 'TESS'
            }]]])
        })
    })

})
