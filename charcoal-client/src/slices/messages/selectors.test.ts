import { MessageState } from './baseClasses'
import { RootState } from '../../store'

import {
    getMessages,
    getMessagesByRoom,
    getRecentlyVisited
} from './selectors'

const testState = {
    messages: {
        history: {
            'CHARACTER#TESS': [{
                DisplayProtocol: 'WorldMessage',
                MessageId: 'Test1',
                Message: ['Test1'],
                CreatedTime: 0,
                Target: 'CHARACTER#TESS'
            }, {
                DisplayProtocol: 'WorldMessage',
                MessageId: 'Test2',
                Message: ['Test2'],
                CreatedTime: 1,
                Target: 'CHARACTER#TESS'
            }]
        } as MessageState,
        aggregates: {},
        presentation: {}
    }
} as unknown as RootState
Object.preventExtensions(testState)

describe('messages selectors', () => {

    describe('getMessages proxy', () => {

        it('should correctly return when message data is present', () => {
            expect(getMessages(testState)['CHARACTER#TESS']).toEqual([{
                DisplayProtocol: 'WorldMessage',
                MessageId: 'Test1',
                Message: ['Test1'],
                CreatedTime: 0,
                Target: 'CHARACTER#TESS'
            }, {
                DisplayProtocol: 'WorldMessage',
                MessageId: 'Test2',
                Message: ['Test2'],
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
                Message: ['Test1'],
                CreatedTime: 0,
                Target: 'CHARACTER#TESS'
            }, {
                DisplayProtocol: 'WorldMessage',
                MessageId: 'Test2',
                Message: ['Test2'],
                CreatedTime: 1,
                Target: 'CHARACTER#TESS'
            }]])
        })

        it('should correctly handle Object.entries', () => {
            expect(Object.entries(getMessages(testState))).toEqual([['CHARACTER#TESS', [{
                DisplayProtocol: 'WorldMessage',
                MessageId: 'Test1',
                Message: ['Test1'],
                CreatedTime: 0,
                Target: 'CHARACTER#TESS'
            }, {
                DisplayProtocol: 'WorldMessage',
                MessageId: 'Test2',
                Message: ['Test2'],
                CreatedTime: 1,
                Target: 'CHARACTER#TESS'
            }]]])
        })
    })

    describe('getMessagesByRoom', () => {

        const testState = {
            messages: {
                history: {
                'CHARACTER#TESS': [{
                    DisplayProtocol: 'PerceptionMessage',
                    MessageId: 'Test1',
                    CreatedTime: 1,
                    Target: 'CHARACTER#TESS',
                    wmlContent: '<Room key=(test)><ShortName>Test1</ShortName><Description>Test1</Description></Room>',
                    metaData: {
                        componentUUID: 'ROOM#TEST',
                        displayMode: 'header'
                    }
                }, {
                    DisplayProtocol: 'WorldMessage',
                    MessageId: 'Test2',
                    Message: ['Test2'],
                    CreatedTime: 2,
                    Target: 'CHARACTER#TESS'
                }, {
                    DisplayProtocol: 'WorldMessage',
                    MessageId: 'Test3',
                    Message: ['Test3'],
                    CreatedTime: 3,
                    Target: 'CHARACTER#TESS'
                }, {
                    DisplayProtocol: 'PerceptionMessage',
                    MessageId: 'Test4',
                    CreatedTime: 4,
                    Target: 'CHARACTER#TESS',
                    wmlContent: '<Room key=(test4)><ShortName>Test4</ShortName><Description>Test4</Description></Room>',
                    metaData: {
                        componentUUID: 'ROOM#TEST4',
                        displayMode: 'header'
                    }
                }, {
                    DisplayProtocol: 'WorldMessage',
                    MessageId: 'Test5',
                    Message: ['Test5'],
                    CreatedTime: 5,
                    Target: 'CHARACTER#TESS'
                }],
                'CHARACTER#MARCO': [{
                    DisplayProtocol: 'PerceptionMessage',
                    MessageId: 'Test1',
                    CreatedTime: 1,
                    Target: 'CHARACTER#MARCO',
                    wmlContent: '<Room key=(test)><ShortName>Test1</ShortName><Description>Test1</Description></Room>',
                    metaData: {
                        componentUUID: 'ROOM#TEST',
                        displayMode: 'header'
                    }
                }, {
                    DisplayProtocol: 'WorldMessage',
                    MessageId: 'Test2',
                    Message: ['Test2'],
                    CreatedTime: 2,
                    Target: 'CHARACTER#MARCO'
                }, {
                    DisplayProtocol: 'PerceptionMessage',
                    MessageId: 'Test3',
                    CreatedTime: 3,
                    Target: 'CHARACTER#MARCO',
                    wmlContent: '<Room key=(test)><ShortName>Test3</ShortName><Description>Test3</Description></Room>',
                    metaData: {
                        componentUUID: 'ROOM#TEST',
                        displayMode: 'header'
                    }
                }, {
                    DisplayProtocol: 'WorldMessage',
                    MessageId: 'Test4',
                    Message: ['Test4'],
                    CreatedTime: 4,
                    Target: 'CHARACTER#MARCO'
                }]
                } as MessageState,
                aggregates: {},
                presentation: {}
            }
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
                        Message: ['Test2'],
                        CreatedTime: 2,
                        Target: 'CHARACTER#TESS'
                    }, {
                        DisplayProtocol: 'WorldMessage',
                        MessageId: 'Test3',
                        Message: ['Test3'],
                        CreatedTime: 3,
                        Target: 'CHARACTER#TESS'
                    }, {
                        DisplayProtocol: 'WorldMessage',
                        MessageId: 'Test5',
                        Message: ['Test5'],
                        CreatedTime: 5,
                        Target: 'CHARACTER#TESS'
                }],
                Groups: [{
                        header: {
                            DisplayProtocol: 'PerceptionMessage',
                            MessageId: 'Test1',
                            CreatedTime: 1,
                            Target: 'CHARACTER#TESS',
                            wmlContent: '<Room key=(test)><ShortName>Test1</ShortName><Description>Test1</Description></Room>',
                            metaData: {
                                componentUUID: 'ROOM#TEST',
                                displayMode: 'header'
                            }
                        },
                        messageCount: 2
                    }, {
                        header: {
                            DisplayProtocol: 'PerceptionMessage',
                            MessageId: 'Test4',
                            CreatedTime: 4,
                            Target: 'CHARACTER#TESS',
                            wmlContent: '<Room key=(test4)><ShortName>Test4</ShortName><Description>Test4</Description></Room>',
                            metaData: {
                                componentUUID: 'ROOM#TEST4',
                                displayMode: 'header'
                            }
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
                        Message: ['Test2'],
                        CreatedTime: 2,
                        Target: 'CHARACTER#MARCO'
                    }, {
                        DisplayProtocol: 'WorldMessage',
                        MessageId: 'Test4',
                        Message: ['Test4'],
                        CreatedTime: 4,
                        Target: 'CHARACTER#MARCO'
                }],
                Groups: [{
                        header: {
                            DisplayProtocol: 'PerceptionMessage',
                            MessageId: 'Test3',
                            CreatedTime: 3,
                            Target: 'CHARACTER#MARCO',
                            wmlContent: '<Room key=(test)><ShortName>Test3</ShortName><Description>Test3</Description></Room>',
                            metaData: {
                                componentUUID: 'ROOM#TEST',
                                displayMode: 'header'
                            }
                        },
                        messageCount: 2
                }]
            })
        })
    })

    describe('getRecentlyVisited', () => {

        const testState = {
            messages: {
                history: {
                'CHARACTER#TESS': [{
                    DisplayProtocol: 'PerceptionMessage',
                    MessageId: 'Test1',
                    CreatedTime: 1,
                    Target: 'CHARACTER#TESS',
                    wmlContent: '<Room key=(test)><ShortName>Test1</ShortName><Description>Test1</Description></Room>',
                    metaData: {
                        componentUUID: 'ROOM#TEST',
                        displayMode: 'header'
                    },
                    parsedWML: {
                        byUniversalId: {
                            'ROOM#TEST': {
                                name: { plainString: 'Test1' },
                                assets: { 'ASSET#test': 'key1', 'ASSET#testTwo': 'key1' }
                            }
                        }
                    }
                }, {
                    DisplayProtocol: 'WorldMessage',
                    MessageId: 'Test2',
                    Message: ['Test2'],
                    CreatedTime: 2,
                    Target: 'CHARACTER#TESS'
                }, {
                    DisplayProtocol: 'RoomUpdate',
                    MessageId: 'Test3',
                    CreatedTime: 3,
                    Target: 'CHARACTER#TESS',
                    RoomId: 'TEST',
                    assets: { 'ASSET#test': 'key1', 'ASSET#testTwo': 'key1' },
                    Name: ['Test3']
                }, {
                    DisplayProtocol: 'PerceptionMessage',
                    MessageId: 'Test4',
                    CreatedTime: 4,
                    Target: 'CHARACTER#TESS',
                    wmlContent: '<Room key=(test4)><ShortName>Test4</ShortName><Description>Test4</Description></Room>',
                    metaData: {
                        componentUUID: 'ROOM#TEST4',
                        displayMode: 'header'
                    },
                    parsedWML: {
                        byUniversalId: {
                            'ROOM#TEST4': {
                                name: { plainString: 'Test4' },
                                assets: { 'ASSET#test': 'key3' }
                            }
                        }
                    }
                }, {
                    DisplayProtocol: 'WorldMessage',
                    MessageId: 'Test5',
                    Message: ['Test5'],
                    CreatedTime: 5,
                    Target: 'CHARACTER#TESS'
                }]
                } as MessageState,
                aggregates: {},
                presentation: {}
            }
        } as unknown as RootState

        it('should return empty when no messages exist', () => {
            expect(getRecentlyVisited(6)(testState)).toEqual([])
        })

        it('should return recently visited rooms', () => {
            expect(getRecentlyVisited(1)(testState)).toEqual([{
                tag: 'Room',
                ephemeraId: 'ROOM#TEST',
                name: 'Unknown',
                assets: [{ fromAssetId: 'ASSET#test', universalKey: 'key1' }, { fromAssetId: 'ASSET#testTwo', universalKey: 'key1' }]
            }, {
                tag: 'Room',
                ephemeraId: 'ROOM#TEST4',
                name: 'Unknown',
                assets: [{ fromAssetId: 'ASSET#test', universalKey: 'key3' }]
            }])
        })

        it('should filter out messages before the given time', () => {
            expect(getRecentlyVisited(4)(testState)).toEqual([{
                tag: 'Room',
                ephemeraId: 'ROOM#TEST4',
                name: 'Unknown',
                assets: [{ fromAssetId: 'ASSET#test', universalKey: 'key3' }]
            }])
        })
    })

})
