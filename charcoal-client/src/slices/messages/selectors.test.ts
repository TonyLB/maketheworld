import { MessageState } from './baseClasses'
import { RootState } from '../../store'

import {
    getMessages,
    getMessagesByRoom
} from './selectors'

const testState = {
    messages: {
        'CHARACTER#TESS': [{
            DisplayProtocol: 'WorldMessage',
            MessageId: 'Test1',
            Message: [{ tag: 'String', value: 'Test1' }],
            CreatedTime: 0,
            Target: 'CHARACTER#TESS'
        }, {
            DisplayProtocol: 'WorldMessage',
            MessageId: 'Test2',
            Message: [{ tag: 'String', value: 'Test2' }],
            CreatedTime: 1,
            Target: 'CHARACTER#TESS'
        }]
    } as MessageState
} as unknown as RootState
Object.preventExtensions(testState)

describe('messages selectors', () => {

    describe('getMessages proxy', () => {

        it('should correctly return when message data is present', () => {
            expect(getMessages(testState)['CHARACTER#TESS']).toEqual([{
                DisplayProtocol: 'WorldMessage',
                MessageId: 'Test1',
                Message: [{ tag: 'String', value: 'Test1' }],
                CreatedTime: 0,
                Target: 'CHARACTER#TESS'
            }, {
                DisplayProtocol: 'WorldMessage',
                MessageId: 'Test2',
                Message: [{ tag: 'String', value: 'Test2' }],
                CreatedTime: 1,
                Target: 'CHARACTER#TESS'
            }])
        })

        it('should correctly return when no data is present', () => {
            expect(getMessages(testState)['CHARACTER#SAIONJI']).toEqual([])
        })

        it('should correctly handle Object.keys', () => {
            expect(Object.keys(getMessages(testState))).toEqual(['CHARACTER#TESS'])
        })

        it('should correctly handle Object.values', () => {
            expect(Object.values(getMessages(testState))).toEqual([[{
                DisplayProtocol: 'WorldMessage',
                MessageId: 'Test1',
                Message: [{ tag: 'String', value: 'Test1' }],
                CreatedTime: 0,
                Target: 'CHARACTER#TESS'
            }, {
                DisplayProtocol: 'WorldMessage',
                MessageId: 'Test2',
                Message: [{ tag: 'String', value: 'Test2' }],
                CreatedTime: 1,
                Target: 'CHARACTER#TESS'
            }]])
        })

        it('should correctly handle Object.entries', () => {
            expect(Object.entries(getMessages(testState))).toEqual([['CHARACTER#TESS', [{
                DisplayProtocol: 'WorldMessage',
                MessageId: 'Test1',
                Message: [{ tag: 'String', value: 'Test1' }],
                CreatedTime: 0,
                Target: 'CHARACTER#TESS'
            }, {
                DisplayProtocol: 'WorldMessage',
                MessageId: 'Test2',
                Message: [{ tag: 'String', value: 'Test2' }],
                CreatedTime: 1,
                Target: 'CHARACTER#TESS'
            }]]])
        })
    })

    describe('getMessagesByRoom', () => {

        const testState = {
            messages: {
                'CHARACTER#TESS': [{
                    DisplayProtocol: 'RoomHeader',
                    MessageId: 'Test1',
                    CreatedTime: 1,
                    Target: 'CHARACTER#TESS',
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
                    Target: 'CHARACTER#TESS'
                }, {
                    DisplayProtocol: 'WorldMessage',
                    MessageId: 'Test3',
                    Message: [{ tag: 'String', value: 'Test3' }],
                    CreatedTime: 3,
                    Target: 'CHARACTER#TESS'
                }, {
                    DisplayProtocol: 'RoomHeader',
                    MessageId: 'Test4',
                    CreatedTime: 4,
                    Target: 'CHARACTER#TESS',
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
                    Target: 'CHARACTER#TESS'
                }],
                'CHARACTER#MARCO': [{
                    DisplayProtocol: 'RoomHeader',
                    MessageId: 'Test1',
                    CreatedTime: 1,
                    Target: 'CHARACTER#MARCO',
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
                    Target: 'CHARACTER#MARCO'
                }, {
                    DisplayProtocol: 'RoomHeader',
                    MessageId: 'Test3',
                    CreatedTime: 3,
                    Target: 'CHARACTER#MARCO',
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
                    Target: 'CHARACTER#MARCO'
                }]
            } as MessageState
        } as unknown as RootState

        it('should return empty when no messages exist', () => {
            expect(getMessagesByRoom('CHARACTER#SAIONJI')(testState)).toEqual({
                Messages: [],
                Groups: []
            })
        })

        it('should return groups when all groups have headers', () => {
            expect(getMessagesByRoom('CHARACTER#TESS')(testState)).toEqual({
                Messages: [{
                        DisplayProtocol: 'WorldMessage',
                        MessageId: 'Test2',
                        Message: [{ tag: 'String', value: 'Test2' }],
                        CreatedTime: 2,
                        Target: 'CHARACTER#TESS'
                    }, {
                        DisplayProtocol: 'WorldMessage',
                        MessageId: 'Test3',
                        Message: [{ tag: 'String', value: 'Test3' }],
                        CreatedTime: 3,
                        Target: 'CHARACTER#TESS'
                    }, {
                        DisplayProtocol: 'WorldMessage',
                        MessageId: 'Test5',
                        Message: [{ tag: 'String', value: 'Test5' }],
                        CreatedTime: 5,
                        Target: 'CHARACTER#TESS'
                }],
                Groups: [{
                        header: {
                            DisplayProtocol: 'RoomHeader',
                            MessageId: 'Test1',
                            CreatedTime: 1,
                            Target: 'CHARACTER#TESS',
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
                            Target: 'CHARACTER#TESS',
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
            expect(getMessagesByRoom('CHARACTER#MARCO')(testState)).toEqual({
                Messages: [{
                        DisplayProtocol: 'WorldMessage',
                        MessageId: 'Test2',
                        Message: [{ tag: 'String', value: 'Test2' }],
                        CreatedTime: 2,
                        Target: 'CHARACTER#MARCO'
                    }, {
                        DisplayProtocol: 'WorldMessage',
                        MessageId: 'Test4',
                        Message: [{ tag: 'String', value: 'Test4' }],
                        CreatedTime: 4,
                        Target: 'CHARACTER#MARCO'
                }],
                Groups: [{
                        header: {
                            DisplayProtocol: 'RoomHeader',
                            MessageId: 'Test1',
                            CreatedTime: 1,
                            Target: 'CHARACTER#MARCO',
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
