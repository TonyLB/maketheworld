jest.mock('aws-amplify', () => ({
    graphqlOperation: jest.fn(),
    API: {
        graphql: jest.fn()
    }
}))

import { API, graphqlOperation } from 'aws-amplify'

jest.mock('../cacheDB', () => ({
    clientSettings: {
        put: jest.fn(() => (Promise.resolve(null)))
    }
}))

import cacheDB from '../cacheDB'

import {
    deltaFactory
} from './deltaSync'

describe('deltaSync syncFromDelta function', () => {

    afterEach(() => {
        jest.clearAllMocks()
    })

    it('should correctly process final result', async () => {
        graphqlOperation.mockReturnValue('test')
        API.graphql.mockReturnValue(Promise.resolve({ data: { test: {
            Items: ['test'],
            LastSync: 123456
        }}}))

        const processingAction = jest.fn(() => ('TestDispatch'))
        const { syncFromDelta } = deltaFactory({
            dataTag: 'test',
            lastSyncKey: 'testKey',
            processingAction,
            syncGQL: 'test'
        })
    
        const dispatch = jest.fn()
        
        await syncFromDelta({ startingAt: 100 })(dispatch)
        expect(dispatch.mock.calls.length).toBe(1)
        expect(dispatch.mock.calls[0][0]).toEqual('TestDispatch')
        expect(processingAction.mock.calls.length).toBe(1)
        expect(processingAction.mock.calls[0][0]).toEqual(['test'])
        expect(cacheDB.clientSettings.put.mock.calls.length).toBe(1)
        expect(cacheDB.clientSettings.put.mock.calls[0][0]).toEqual({ key: 'testKey', value: 123456 })
    })

    it('should correctly process intermediate result', async () => {
        graphqlOperation.mockReturnValue('test')
        API.graphql.mockReturnValue(Promise.resolve({ data: { test: {
            Items: ['test'],
            LastMoment: 123456
        }}}))

        const processingAction = jest.fn(() => ('TestDispatch'))
        const { syncFromDelta } = deltaFactory({
            dataTag: 'test',
            lastSyncKey: 'testKey',
            processingAction,
            syncGQL: 'test'
        })
    
        const dispatch = jest.fn()
        
        await syncFromDelta({ startingAt: 100 })(dispatch)
        expect(dispatch.mock.calls.length).toBe(2)
        expect(dispatch.mock.calls[0][0]).toEqual('TestDispatch')
        expect(dispatch.mock.calls[1][0]).toEqual(expect.any(Function))
        expect(processingAction.mock.calls.length).toBe(1)
        expect(processingAction.mock.calls[0][0]).toEqual(['test'])
        expect(cacheDB.clientSettings.put.mock.calls.length).toBe(0)
    })

})

describe('deltaSync syncFromBaseTable function', () => {

    afterEach(() => {
        jest.clearAllMocks()
    })

    it('should correctly process final result', async () => {
        graphqlOperation.mockReturnValue('test')
        API.graphql.mockReturnValue(Promise.resolve({ data: { test: {
            Items: ['test'],
            LastSync: 123456
        }}}))

        const processingAction = jest.fn(() => ('TestDispatch'))
        const { syncFromBaseTable } = deltaFactory({
            dataTag: 'test',
            lastSyncKey: 'testKey',
            processingAction,
            syncGQL: 'test'
        })
    
        const dispatch = jest.fn()
        
        await syncFromBaseTable({ ExclusiveStartKey: 'Blah' })(dispatch)
        expect(dispatch.mock.calls.length).toBe(1)
        expect(dispatch.mock.calls[0][0]).toEqual('TestDispatch')
        expect(processingAction.mock.calls.length).toBe(1)
        expect(processingAction.mock.calls[0][0]).toEqual(['test'])
        expect(cacheDB.clientSettings.put.mock.calls.length).toBe(1)
        expect(cacheDB.clientSettings.put.mock.calls[0][0]).toEqual({ key: 'testKey', value: 123456 })
    })

    it('should correctly process intermediate result', async () => {
        graphqlOperation.mockReturnValue('test')
        API.graphql.mockReturnValue(Promise.resolve({ data: { test: {
            Items: ['test'],
            LastEvaluatedKey: 'Bar'
        }}}))

        const processingAction = jest.fn(() => ('TestDispatch'))
        const { syncFromBaseTable } = deltaFactory({
            dataTag: 'test',
            lastSyncKey: 'testKey',
            processingAction,
            syncGQL: 'test'
        })
    
        const dispatch = jest.fn()
        
        await syncFromBaseTable({ ExclusiveStartKey: 'Foo' })(dispatch)
        expect(dispatch.mock.calls.length).toBe(2)
        expect(dispatch.mock.calls[0][0]).toEqual('TestDispatch')
        expect(dispatch.mock.calls[1][0]).toEqual(expect.any(Function))
        expect(processingAction.mock.calls.length).toBe(1)
        expect(processingAction.mock.calls[0][0]).toEqual(['test'])
        expect(cacheDB.clientSettings.put.mock.calls.length).toBe(0)
    })

})
