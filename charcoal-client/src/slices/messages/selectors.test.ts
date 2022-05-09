import { MessageState } from './baseClasses'
import { RootState } from '../../store'

import {
    getMessages,
    getMessagesByRoom
} from './selectors'

const testState = {
    messages: {
        TESS: [{
            DisplayProtocol: 'WorldMessage',
            MessageId: 'Test1',
            Message: [{ tag: 'String', value: 'Test1' }],
            CreatedTime: 0,
            Target: 'TESS'
        }, {
            DisplayProtocol: 'WorldMessage',
            MessageId: 'Test2',
            Message: [{ tag: 'String', value: 'Test2' }],
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
                DisplayProtocol: 'WorldMessage',
                MessageId: 'Test1',
                Message: [{ tag: 'String', value: 'Test1' }],
                CreatedTime: 0,
                Target: 'TESS'
            }, {
                DisplayProtocol: 'WorldMessage',
                MessageId: 'Test2',
                Message: [{ tag: 'String', value: 'Test2' }],
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
                DisplayProtocol: 'WorldMessage',
                MessageId: 'Test1',
                Message: [{ tag: 'String', value: 'Test1' }],
                CreatedTime: 0,
                Target: 'TESS'
            }, {
                DisplayProtocol: 'WorldMessage',
                MessageId: 'Test2',
                Message: [{ tag: 'String', value: 'Test2' }],
                CreatedTime: 1,
                Target: 'TESS'
            }]])
        })

        it('should correctly handle Object.entries', () => {
            expect(Object.entries(getMessages(testState))).toEqual([['TESS', [{
                DisplayProtocol: 'WorldMessage',
                MessageId: 'Test1',
                Message: [{ tag: 'String', value: 'Test1' }],
                CreatedTime: 0,
                Target: 'TESS'
            }, {
                DisplayProtocol: 'WorldMessage',
                MessageId: 'Test2',
                Message: [{ tag: 'String', value: 'Test2' }],
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
                    Description: [{ tag: 'String', value: 'Test1' }],
                    Name: 'Test1',
                    Exits: [],
                    Characters: []
                }, {
                    DisplayProtocol: 'WorldMessage',
                    MessageId: 'Test2',
                    Message: [{ tag: 'String', value: 'Test2' }],
                    CreatedTime: 2,
                    Target: 'TESS'
                }, {
                    DisplayProtocol: 'WorldMessage',
                    MessageId: 'Test3',
                    Message: [{ tag: 'String', value: 'Test3' }],
                    CreatedTime: 3,
                    Target: 'TESS'
                }, {
                    DisplayProtocol: 'RoomHeader',
                    MessageId: 'Test4',
                    CreatedTime: 4,
                    Target: 'TESS',
                    RoomId: 'TEST4',
                    Description: [{ tag: 'String', value: 'Test4' }],
                    Name: 'Test4',
                    Exits: [],
                    Characters: []
                }, {
                    DisplayProtocol: 'WorldMessage',
                    MessageId: 'Test5',
                    Message: [{ tag: 'String', value: 'Test5' }],
                    CreatedTime: 5,
                    Target: 'TESS'
                }],
                MARCO: [{
                    DisplayProtocol: 'RoomHeader',
                    MessageId: 'Test1',
                    CreatedTime: 1,
                    Target: 'MARCO',
                    RoomId: 'TEST',
                    Description: [{ tag: 'String', value: 'Test1' }],
                    Name: 'Test1',
                    Exits: [],
                    Characters: []
                }, {
                    DisplayProtocol: 'WorldMessage',
                    MessageId: 'Test2',
                    Message: [{ tag: 'String', value: 'Test2' }],
                    CreatedTime: 2,
                    Target: 'MARCO'
                }, {
                    DisplayProtocol: 'RoomHeader',
                    MessageId: 'Test3',
                    CreatedTime: 3,
                    Target: 'MARCO',
                    RoomId: 'TEST',
                    Description: [{ tag: 'String', value: 'Test3' }],
                    Name: 'Test3',
                    Exits: [],
                    Characters: []
                }, {
                    DisplayProtocol: 'WorldMessage',
                    MessageId: 'Test4',
                    Message: [{ tag: 'String', value: 'Test4' }],
                    CreatedTime: 4,
                    Target: 'MARCO'
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
                        DisplayProtocol: 'WorldMessage',
                        MessageId: 'Test2',
                        Message: [{ tag: 'String', value: 'Test2' }],
                        CreatedTime: 2,
                        Target: 'TESS'
                    }, {
                        DisplayProtocol: 'WorldMessage',
                        MessageId: 'Test3',
                        Message: [{ tag: 'String', value: 'Test3' }],
                        CreatedTime: 3,
                        Target: 'TESS'
                    }, {
                        DisplayProtocol: 'WorldMessage',
                        MessageId: 'Test5',
                        Message: [{ tag: 'String', value: 'Test5' }],
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
                            Description: [{ tag: 'String', value: 'Test1' }],
                            Name: 'Test1',
                            Exits: [],
                            Characters: []
                        },
                        messageCount: 2
                    }, {
                        header: {
                            DisplayProtocol: 'RoomHeader',
                            MessageId: 'Test4',
                            CreatedTime: 4,
                            Target: 'TESS',
                            RoomId: 'TEST4',
                            Description: [{ tag: 'String', value: 'Test4' }],
                            Name: 'Test4',
                            Exits: [],
                            Characters: []
                        },
                        messageCount: 1
                }]
            })
        })

        it('should combine successive groups with the same room ID', () => {
            expect(getMessagesByRoom('MARCO')(testState)).toEqual({
                Messages: [{
                        DisplayProtocol: 'WorldMessage',
                        MessageId: 'Test2',
                        Message: [{ tag: 'String', value: 'Test2' }],
                        CreatedTime: 2,
                        Target: 'MARCO'
                    }, {
                        DisplayProtocol: 'WorldMessage',
                        MessageId: 'Test4',
                        Message: [{ tag: 'String', value: 'Test4' }],
                        CreatedTime: 4,
                        Target: 'MARCO'
                }],
                Groups: [{
                        header: {
                            DisplayProtocol: 'RoomHeader',
                            MessageId: 'Test1',
                            CreatedTime: 1,
                            Target: 'MARCO',
                            RoomId: 'TEST',
                            Description: [{ tag: 'String', value: 'Test3' }],
                            Name: 'Test3',
                            Exits: [],
                            Characters: []
                        },
                        messageCount: 2
                }]
            })
        })
    })

})
