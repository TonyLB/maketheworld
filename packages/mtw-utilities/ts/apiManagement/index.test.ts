jest.mock('../dynamoDB/index.js')
import { ephemeraDB } from '../dynamoDB/index.js'
jest.mock('./apiManagementClient')
import { apiClient } from './apiManagementClient'

import { SocketQueue } from './index'

const mockedAPIClient = apiClient as jest.Mocked<typeof apiClient>
const mockedEphemeraDB = ephemeraDB as jest.Mocked<typeof ephemeraDB>

describe('apiManagment', () => {

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        jest.restoreAllMocks()
    })

    describe('socketQueue class', () => {
        it('should initialize empty', async () => {
            const testSocket = new SocketQueue()
            await testSocket.flush()
            expect(mockedAPIClient.send).toHaveBeenCalledTimes(0)
        })

        it('should send a queued non-Message item', async() => {
            const testSocket = new SocketQueue()
            testSocket.send({ ConnectionId: 'ABC', Message: { update: 'Test' } })
            await testSocket.flush()
            expect(mockedAPIClient.send).toHaveBeenCalledWith({
                ConnectionId: 'ABC',
                Data: `{"update":"Test"}`
            })
        })

        it('should aggregate queued Message items', async() => {
            const testSocket = new SocketQueue()
            testSocket.send({
                ConnectionId: 'ABC',
                Message: {
                    messageType: 'Messages',
                    messages: [{
                        MessageId: 'MESSAGE#001',
                        Target: 'CHARACTER#123',
                        payload: 'Test'
                    }]
                }
            })
            testSocket.send({
                ConnectionId: 'ABC',
                Message: {
                    messageType: 'Messages',
                    messages: [{
                        MessageId: 'MESSAGE#002',
                        Target: 'CHARACTER#456',
                        payload: 'TestTwo'
                    },
                    {
                        MessageId: 'MESSAGE#003',
                        Target: 'CHARACTER#123',
                        payload: 'TestThree'
                    }]
                }
            })
            await testSocket.flush()
            expect(mockedAPIClient.send).toHaveBeenCalledWith({
                ConnectionId: 'ABC',
                Data: JSON.stringify({
                    messageType: 'Messages',
                    messages: [{
                        MessageId: 'MESSAGE#001',
                        Target: 'CHARACTER#123',
                        payload: 'Test'
                    },
                    {
                        MessageId: 'MESSAGE#002',
                        Target: 'CHARACTER#456',
                        payload: 'TestTwo'
                    },
                    {
                        MessageId: 'MESSAGE#003',
                        Target: 'CHARACTER#123',
                        payload: 'TestThree'
                    }]
                })
            })
        })

        it('should deliver global messages', async() => {
            const testSocket = new SocketQueue()
            testSocket.send({
                ConnectionId: '123',
                Message: {
                    messageType: 'Other',
                    payload: 'Test'
                }
            })
            testSocket.sendAll({
                messageType: 'Another',
                payload: 'TestTwo'
            }, {
                forceConnections: ['789']
            })
            mockedEphemeraDB.getItem.mockResolvedValue({
                connections: {
                    '123': 'TestPlayer',
                    '456': 'OtherTestPlayer'
                }
            })
            await testSocket.flush()
            expect(mockedAPIClient.send).toHaveBeenCalledTimes(4)
            expect(mockedAPIClient.send).toHaveBeenCalledWith({
                ConnectionId: '123',
                Data: JSON.stringify({
                    messageType: 'Other',
                    payload: 'Test'
                })
            })
            expect(mockedAPIClient.send).toHaveBeenCalledWith({
                ConnectionId: '123',
                Data: JSON.stringify({
                    messageType: 'Another',
                    payload: 'TestTwo'
                })
            })
            expect(mockedAPIClient.send).toHaveBeenCalledWith({
                ConnectionId: '456',
                Data: JSON.stringify({
                    messageType: 'Another',
                    payload: 'TestTwo'
                })
            })
            expect(mockedAPIClient.send).toHaveBeenCalledWith({
                ConnectionId: '789',
                Data: JSON.stringify({
                    messageType: 'Another',
                    payload: 'TestTwo'
                })
            })
        })

        it('should deliver player messages', async() => {
            const testSocket = new SocketQueue()
            testSocket.send({
                ConnectionId: '123',
                Message: {
                    messageType: 'Other',
                    payload: 'Test'
                }
            })
            testSocket.sendPlayer({
                PlayerName: 'TestPlayer',
                Message: {
                    messageType: 'Another',
                    payload: 'TestTwo'
                }
            })
            mockedEphemeraDB.getItem.mockResolvedValue({
                connections: {
                    '123': 'TestPlayer',
                    '456': 'OtherTestPlayer',
                    '789': 'TestPlayer'
                }
            })
            await testSocket.flush()
            expect(mockedAPIClient.send).toHaveBeenCalledTimes(3)
            expect(mockedAPIClient.send).toHaveBeenCalledWith({
                ConnectionId: '123',
                Data: JSON.stringify({
                    messageType: 'Other',
                    payload: 'Test'
                })
            })
            expect(mockedAPIClient.send).toHaveBeenCalledWith({
                ConnectionId: '123',
                Data: JSON.stringify({
                    messageType: 'Another',
                    payload: 'TestTwo'
                })
            })
            expect(mockedAPIClient.send).toHaveBeenCalledWith({
                ConnectionId: '789',
                Data: JSON.stringify({
                    messageType: 'Another',
                    payload: 'TestTwo'
                })
            })
        })
        it('should deliver targeted ephemera messages', async() => {
            const testSocket = new SocketQueue()
            testSocket.send({
                ConnectionId: '123',
                Message: {
                    messageType: 'Ephemera',
                    updates: [{
                        type: 'Map',
                        CharacterId: 'ABC',
                        MapId: 'TestMap',
                        Layers: [{
                            rooms: {
                                welcome: { x: 300, y: 200 }
                            }
                        }]
                    }]
                }
            })
            await testSocket.flush()
            expect(mockedAPIClient.send).toHaveBeenCalledTimes(1)
            expect(mockedAPIClient.send).toHaveBeenCalledWith({
                ConnectionId: '123',
                Data: JSON.stringify({
                    messageType: 'Ephemera',
                    updates: [{
                        type: 'Map',
                        CharacterId: 'ABC',
                        MapId: 'TestMap',
                        Layers: [{
                            rooms: {
                                welcome: { x: 300, y: 200 }
                            }
                        }]
                    }]
                })
            })
        })

        it('should aggregate ephemera messages', async() => {
            const testSocket = new SocketQueue()
            testSocket.send({
                ConnectionId: '123',
                Message: {
                    messageType: 'Ephemera',
                    updates: [{
                        type: 'Map',
                        CharacterId: 'ABC',
                        MapId: 'TestMap',
                        Layers: [{
                            rooms: {
                                welcome: { x: 300, y: 200 }
                            }
                        }]
                    }]
                }
            })
            testSocket.send({
                ConnectionId: '123',
                Message: {
                    messageType: 'Ephemera',
                    updates: [{
                        type: 'Map',
                        CharacterId: 'DEF',
                        MapId: 'AnotherTestMap',
                        Layers: [{
                            rooms: {
                                VORTEX: { x: 0, y: 0 }
                            }
                        }]
                    }]
                }
            })
            await testSocket.flush()
            expect(mockedAPIClient.send).toHaveBeenCalledTimes(1)
            expect(mockedAPIClient.send).toHaveBeenCalledWith({
                ConnectionId: '123',
                Data: JSON.stringify({
                    messageType: 'Ephemera',
                    updates: [{
                        type: 'Map',
                        CharacterId: 'ABC',
                        MapId: 'TestMap',
                        Layers: [{
                            rooms: {
                                welcome: { x: 300, y: 200 }
                            }
                        }]
                    },
                    {
                        type: 'Map',
                        CharacterId: 'DEF',
                        MapId: 'AnotherTestMap',
                        Layers: [{
                            rooms: {
                                VORTEX: { x: 0, y: 0 }
                            }
                        }]
                    }]
                })
            })
        })

    })
})