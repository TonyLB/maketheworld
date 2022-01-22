import { MessageState } from './baseClasses'
import { RootState } from '../../store'

import {
    getMessages,
    getMessagesByRoom
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

    describe('getMessagesByRoom', () => {

        const testState = {
            messages: {
                TESS: [{
                    DisplayProtocol: 'RoomHeader',
                    MessageId: 'Test1',
                    CreatedTime: 1,
                    Target: 'TESS',
                    RoomId: 'TEST',
                    Description: 'Test1',
                    Name: 'Test1',
                    Exits: [],
                    RoomCharacters: []
                }, {
                    DisplayProtocol: 'World',
                    MessageId: 'Test2',
                    Message: 'Test2',
                    CreatedTime: 2,
                    Target: 'TESS'
                }, {
                    DisplayProtocol: 'World',
                    MessageId: 'Test3',
                    Message: 'Test3',
                    CreatedTime: 3,
                    Target: 'TESS'
                }, {
                    DisplayProtocol: 'RoomHeader',
                    MessageId: 'Test4',
                    CreatedTime: 4,
                    Target: 'TESS',
                    RoomId: 'TEST4',
                    Description: 'Test4',
                    Name: 'Test4',
                    Exits: [],
                    RoomCharacters: []
                }, {
                    DisplayProtocol: 'World',
                    MessageId: 'Test5',
                    Message: 'Test5',
                    CreatedTime: 5,
                    Target: 'TESS'
                }]
            } as MessageState
        } as unknown as RootState

        it('should return empty when no messages exist', () => {
            expect(getMessagesByRoom('SAIONJI')(testState)).toEqual({
                Messages: [],
                Groups: []
            })
        })

        it('should return groups when all groups have headers', () => {
            expect(getMessagesByRoom('TESS')(testState)).toEqual({
                Messages: [{
                        DisplayProtocol: 'World',
                        MessageId: 'Test2',
                        Message: 'Test2',
                        CreatedTime: 2,
                        Target: 'TESS'
                    }, {
                        DisplayProtocol: 'World',
                        MessageId: 'Test3',
                        Message: 'Test3',
                        CreatedTime: 3,
                        Target: 'TESS'
                    }, {
                        DisplayProtocol: 'World',
                        MessageId: 'Test5',
                        Message: 'Test5',
                        CreatedTime: 5,
                        Target: 'TESS'
                }],
                Groups: [{
                        header: {
                            DisplayProtocol: 'RoomHeader',
                            MessageId: 'Test1',
                            CreatedTime: 1,
                            Target: 'TESS',
                            RoomId: 'TEST',
                            Description: 'Test1',
                            Name: 'Test1',
                            Exits: [],
                            RoomCharacters: []
                        },
                        messageCount: 2
                    }, {
                        header: {
                            DisplayProtocol: 'RoomHeader',
                            MessageId: 'Test4',
                            CreatedTime: 4,
                            Target: 'TESS',
                            RoomId: 'TEST4',
                            Description: 'Test4',
                            Name: 'Test4',
                            Exits: [],
                            RoomCharacters: []
                        },
                        messageCount: 1
                }]
            })
        })
    })

})
