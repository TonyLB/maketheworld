import { MessageState } from './baseClasses'
import { RootState } from '../../store'

import {
    getMessages,
    getMessagesByRoom,
    getPresentation,
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

        const historyForRoom = {
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
        } as MessageState

        const testState = {
            messages: {
                history: historyForRoom,
                aggregates: {},
                presentation: structuredClone(historyForRoom)
            },
            settings: { connection: { sessionId: '' } }
        } as unknown as RootState

        it('should return empty when no messages exist', () => {
            expect(getMessagesByRoom('CHARACTER#SAIONJI')(testState)).toEqual({
                Messages: [],
                Groups: []
            })
        })

        it('should return groups when all groups have headers', () => {
            const g1Header = {
                DisplayProtocol: 'PerceptionMessage',
                MessageId: 'Test1',
                CreatedTime: 1,
                Target: 'CHARACTER#TESS',
                wmlContent: '<Room key=(test)><ShortName>Test1</ShortName><Description>Test1</Description></Room>',
                metaData: {
                    componentUUID: 'ROOM#TEST',
                    displayMode: 'header'
                }
            }
            const g2Header = {
                DisplayProtocol: 'PerceptionMessage',
                MessageId: 'Test4',
                CreatedTime: 4,
                Target: 'CHARACTER#TESS',
                wmlContent: '<Room key=(test4)><ShortName>Test4</ShortName><Description>Test4</Description></Room>',
                metaData: {
                    componentUUID: 'ROOM#TEST4',
                    displayMode: 'header'
                }
            }
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
                        header: g1Header,
                        renderHeader: g1Header,
                        affordanceHeader: undefined,
                        firstAffordanceWithoutRenderCreatedTime: undefined,
                        messageCount: 2
                    }, {
                        header: g2Header,
                        renderHeader: g2Header,
                        affordanceHeader: undefined,
                        firstAffordanceWithoutRenderCreatedTime: undefined,
                        messageCount: 1
                }]
            })
        })

        it('should combine successive groups with the same room ID', () => {
            const marcoHeader = {
                DisplayProtocol: 'PerceptionMessage',
                MessageId: 'Test3',
                CreatedTime: 3,
                Target: 'CHARACTER#MARCO',
                wmlContent: '<Room key=(test)><ShortName>Test3</ShortName><Description>Test3</Description></Room>',
                metaData: {
                    componentUUID: 'ROOM#TEST',
                    displayMode: 'header'
                }
            }
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
                        header: marcoHeader,
                        renderHeader: marcoHeader,
                        affordanceHeader: undefined,
                        firstAffordanceWithoutRenderCreatedTime: undefined,
                        messageCount: 2
                }]
            })
        })

        it('should keep render header when a newer affordance header follows for the same room', () => {
            const renderH = {
                DisplayProtocol: 'PerceptionMessage',
                MessageId: 'R1',
                CreatedTime: 1,
                Target: 'CHARACTER#TESS',
                wmlContent: '<Room key=(a)><ShortName>A</ShortName></Room>',
                metaData: {
                    componentUUID: 'ROOM#X',
                    displayMode: 'header',
                    roomChannel: 'render'
                }
            }
            const affordH = {
                DisplayProtocol: 'PerceptionMessage',
                MessageId: 'A1',
                CreatedTime: 2,
                Target: 'CHARACTER#TESS',
                wmlContent: '<Room key=(a)><ShortName>B</ShortName></Room>',
                metaData: {
                    componentUUID: 'ROOM#X',
                    displayMode: 'header',
                    roomChannel: 'affordances'
                }
            }
            const affordNewer = {
                ...affordH,
                MessageId: 'A2',
                CreatedTime: 5
            }
            const presentation = {
                'CHARACTER#TESS': [renderH, affordH, affordNewer, {
                    DisplayProtocol: 'WorldMessage',
                    MessageId: 'W1',
                    Message: ['hi'],
                    CreatedTime: 6,
                    Target: 'CHARACTER#TESS'
                }]
            } as MessageState
            const st = {
                messages: {
                    history: presentation,
                    aggregates: {},
                    presentation: structuredClone(presentation)
                },
                settings: { connection: { sessionId: '' } }
            } as unknown as RootState
            const result = getMessagesByRoom('CHARACTER#TESS')(st)
            expect(result.Messages).toHaveLength(1)
            expect(result.Groups).toHaveLength(1)
            expect(result.Groups[0].header).toEqual(renderH)
            expect(result.Groups[0].renderHeader).toEqual(renderH)
            expect(result.Groups[0].affordanceHeader).toEqual(affordNewer)
        })

        it('should not put RoomUpdate rows in Messages', () => {
            const presentation = {
                'CHARACTER#TESS': [{
                    DisplayProtocol: 'PerceptionMessage',
                    MessageId: 'H1',
                    CreatedTime: 1,
                    Target: 'CHARACTER#TESS',
                    wmlContent: '<Room key=(a)><ShortName>A</ShortName></Room>',
                    metaData: { componentUUID: 'ROOM#X', displayMode: 'header' }
                }, {
                    DisplayProtocol: 'RoomUpdate',
                    MessageId: 'RU1',
                    CreatedTime: 2,
                    Target: 'CHARACTER#TESS',
                    RoomId: 'X',
                    assets: {},
                    Name: ['n']
                }, {
                    DisplayProtocol: 'WorldMessage',
                    MessageId: 'W1',
                    Message: ['x'],
                    CreatedTime: 3,
                    Target: 'CHARACTER#TESS'
                }]
            } as MessageState
            const st = {
                messages: {
                    history: presentation,
                    aggregates: {},
                    presentation: structuredClone(presentation)
                },
                settings: { connection: { sessionId: '' } }
            } as unknown as RootState
            const result = getMessagesByRoom('CHARACTER#TESS')(st)
            expect(result.Messages.every((m) => m.DisplayProtocol !== 'RoomUpdate')).toBe(true)
            expect(result.Messages).toHaveLength(1)
        })

        describe('CommandTranscriptMessage', () => {
            const header = (MessageId: string, CreatedTime: number, roomId: string) => ({
                DisplayProtocol: 'PerceptionMessage',
                MessageId,
                CreatedTime,
                Target: 'CHARACTER#TESS',
                wmlContent: '<Room key=(a)><ShortName>A</ShortName></Room>',
                metaData: { componentUUID: roomId, displayMode: 'header' }
            })
            const transcript = (MessageId: string, CreatedTime: number, SessionId: string | null = 'SESSION-A') => ({
                DisplayProtocol: 'CommandTranscriptMessage',
                MessageId,
                Message: [MessageId],
                CreatedTime,
                Target: 'CHARACTER#TESS',
                ...(SessionId ? { SessionId } : {})
            })
            const world = (MessageId: string, CreatedTime: number) => ({
                DisplayProtocol: 'WorldMessage',
                MessageId,
                Message: [MessageId],
                CreatedTime,
                Target: 'CHARACTER#TESS'
            })
            const stateFor = (rows: any[], sessionId = 'SESSION-A') => {
                const presentation = { 'CHARACTER#TESS': rows } as MessageState
                return {
                    messages: {
                        history: presentation,
                        aggregates: {},
                        presentation: structuredClone(presentation)
                    },
                    settings: { connection: { sessionId } }
                } as unknown as RootState
            }

            it('should show only the latest command echo in a room', () => {
                const st = stateFor([
                    header('H1', 1, 'ROOM#X'),
                    transcript('C1', 2),
                    world('W1', 3),
                    transcript('C2', 4),
                    world('W2', 5)
                ])
                const result = getMessagesByRoom('CHARACTER#TESS')(st)
                expect(result.Messages.map(({ MessageId }) => MessageId)).toEqual(['W1', 'C2', 'W2'])
                expect(result.Groups.map(({ messageCount }) => messageCount)).toEqual([3])
            })

            it('should drop stale command echoes from earlier rooms', () => {
                const st = stateFor([
                    header('H1', 1, 'ROOM#X'),
                    transcript('C1', 2),
                    world('W1', 3),
                    header('H2', 4, 'ROOM#Y'),
                    transcript('C2', 5),
                    world('W2', 6)
                ])
                const result = getMessagesByRoom('CHARACTER#TESS')(st)
                expect(result.Messages.map(({ MessageId }) => MessageId)).toEqual(['W1', 'C2', 'W2'])
                expect(result.Groups.map(({ messageCount }) => messageCount)).toEqual([1, 2])
            })

            it('should collapse a room section holding only a stale echo to a spacer', () => {
                const st = stateFor([
                    header('H1', 1, 'ROOM#X'),
                    transcript('C1', 2),
                    header('H2', 3, 'ROOM#Y'),
                    transcript('C2', 4)
                ])
                const result = getMessagesByRoom('CHARACTER#TESS')(st)
                expect(result.Messages.map(({ DisplayProtocol }) => DisplayProtocol)).toEqual(['SpacerMessage', 'CommandTranscriptMessage'])
                expect(result.Messages[1].MessageId).toEqual('C2')
                expect(result.Groups.map(({ messageCount }) => messageCount)).toEqual([1, 1])
            })

            it('should keep a command echo that carries an outcome revision', () => {
                const st = stateFor([
                    header('H1', 1, 'ROOM#X'),
                    { ...transcript('C1', 2), Outcome: { Kind: 'Error', Message: ['No.'] } },
                    world('W1', 3)
                ])
                const result = getMessagesByRoom('CHARACTER#TESS')(st)
                expect(result.Messages.map(({ MessageId }) => MessageId)).toEqual(['C1', 'W1'])
                expect((result.Messages[0] as any).Outcome).toEqual({ Kind: 'Error', Message: ['No.'] })
            })

            it('should not let a later echo from another session hide this session\'s latest', () => {
                const st = stateFor([
                    header('H1', 1, 'ROOM#X'),
                    transcript('C1', 2),
                    world('W1', 3),
                    transcript('C2', 4, 'SESSION-B'),
                    world('W2', 5)
                ])
                const result = getMessagesByRoom('CHARACTER#TESS')(st)
                expect(result.Messages.map(({ MessageId }) => MessageId)).toEqual(['C1', 'W1', 'W2'])
            })

            it('should show no echo when every echo is from another session', () => {
                const st = stateFor([
                    header('H1', 1, 'ROOM#X'),
                    transcript('C1', 2, 'SESSION-B'),
                    world('W1', 3)
                ])
                const result = getMessagesByRoom('CHARACTER#TESS')(st)
                expect(result.Messages.map(({ MessageId }) => MessageId)).toEqual(['W1'])
            })

            it('should never show an untagged echo', () => {
                const st = stateFor([
                    header('H1', 1, 'ROOM#X'),
                    transcript('C1', 2, null),
                    world('W1', 3)
                ])
                const result = getMessagesByRoom('CHARACTER#TESS')(st)
                expect(result.Messages.map(({ MessageId }) => MessageId)).toEqual(['W1'])
            })

            it('should show no echo before the session is initialized', () => {
                const st = stateFor([
                    header('H1', 1, 'ROOM#X'),
                    transcript('C1', 2, null),
                    world('W1', 3)
                ], '')
                const result = getMessagesByRoom('CHARACTER#TESS')(st)
                expect(result.Messages.map(({ MessageId }) => MessageId)).toEqual(['W1'])
            })

            it('should leave every command echo in presentation', () => {
                const st = stateFor([
                    header('H1', 1, 'ROOM#X'),
                    transcript('C1', 2),
                    transcript('C2', 3)
                ])
                expect(getPresentation(st)['CHARACTER#TESS'].map(({ MessageId }) => MessageId)).toEqual(['H1', 'C1', 'C2'])
            })
        })
    })

    describe('getRecentlyVisited', () => {

        const historyForRecent = {
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
        } as MessageState

        const testState = {
            messages: {
                history: historyForRecent,
                aggregates: {},
                presentation: structuredClone(historyForRecent)
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
