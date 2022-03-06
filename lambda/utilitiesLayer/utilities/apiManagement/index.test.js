import { jest, describe, expect, it } from '@jest/globals'

jest.mock('../dynamoDB.js')
import { ephemeraDB } from '../dynamoDB.js'
jest.mock('./apiManagementClient.js')
import { apiClient } from './apiManagementClient.js'

import { SocketQueue } from './index.js'

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
            expect(apiClient.send).toHaveBeenCalledTimes(0)
        })

        it('should send a queued non-Message item', async() => {
            const testSocket = new SocketQueue()
            testSocket.send({ ConnectionId: 'ABC', Message: { update: 'Test' } })
            await testSocket.flush()
            expect(apiClient.send).toHaveBeenCalledWith({
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
            expect(apiClient.send).toHaveBeenCalledWith({
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

        it('should should deliver global messages', async() => {
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
            })
            ephemeraDB.getItem.mockResolvedValue({
                connections: {
                    '123': {},
                    '456': {}
                }
            })
            await testSocket.flush()
            expect(apiClient.send).toHaveBeenCalledTimes(3)
            expect(apiClient.send).toHaveBeenCalledWith({
                ConnectionId: '123',
                Data: JSON.stringify({
                    messageType: 'Other',
                    payload: 'Test'
                })
            })
            expect(apiClient.send).toHaveBeenCalledWith({
                ConnectionId: '123',
                Data: JSON.stringify({
                    messageType: 'Another',
                    payload: 'TestTwo'
                })
            })
            expect(apiClient.send).toHaveBeenCalledWith({
                ConnectionId: '456',
                Data: JSON.stringify({
                    messageType: 'Another',
                    payload: 'TestTwo'
                })
            })
        })

        it('should should deliver targeted ephemera messages', async() => {
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
            expect(apiClient.send).toHaveBeenCalledTimes(1)
            expect(apiClient.send).toHaveBeenCalledWith({
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

    })
})