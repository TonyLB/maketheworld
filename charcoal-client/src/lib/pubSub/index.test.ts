import { vi } from 'vitest'
vi.mock('uuid')
import { v4 as uuidMock } from 'uuid'
import { PubSub } from './index'
import { mockFunction } from '../jestHelpers'

class testData {
    value: string = ''
}

const uuid = mockFunction(uuidMock)

describe('PubSub class', () => {
    let testPubSub: PubSub<testData>
    beforeEach(() => {
        vi.clearAllMocks()
        testPubSub = new PubSub<testData>()
    })
    it('should accept subscriptions', () => {
        expect(testPubSub.subscriptions).toEqual([])
        const callbackOne = vi.fn()
        uuid.mockReturnValueOnce('testUUID1' as any).mockReturnValueOnce('testUUID2' as any)
        const subscriptionOne = testPubSub.subscribe(callbackOne)
        expect(testPubSub.subscriptions).toEqual([{
            id: 'testUUID1',
            callback: callbackOne
        }])
        expect(subscriptionOne).toEqual('testUUID1')
        const callbackTwo = vi.fn()
        const subscriptionTwo = testPubSub.subscribe(callbackTwo)
        expect(testPubSub.subscriptions).toEqual([{
            id: 'testUUID1',
            callback: callbackOne
        },
        {
            id: 'testUUID2',
            callback: callbackTwo
        }])
        expect(subscriptionTwo).toEqual('testUUID2')
    })
    it('should accept unsubscribe', () => {
        expect(testPubSub.subscriptions).toEqual([])
        const callbackOne = vi.fn()
        uuid.mockReturnValueOnce('testUUID1' as any).mockReturnValueOnce('testUUID2' as any)
        testPubSub.subscribe(callbackOne)
        expect(testPubSub.subscriptions).toEqual([{
            id: 'testUUID1',
            callback: callbackOne
        }])
        const callbackTwo = vi.fn()
        testPubSub.subscribe(callbackTwo)
        testPubSub.unsubscribe('testUUID1')
        expect(testPubSub.subscriptions).toEqual([{
            id: 'testUUID2',
            callback: callbackTwo
        }])
    })
    it('should call all callbacks on publish', () => {
        expect(testPubSub.subscriptions).toEqual([])
        uuid.mockReturnValueOnce('testUUID1' as any).mockReturnValueOnce('testUUID2' as any)
        const callbackOne = vi.fn()
        testPubSub.subscribe(callbackOne)
        testPubSub.publish({ value: 'Test One' })
        const callbackTwo = vi.fn()
        testPubSub.subscribe(callbackTwo)
        testPubSub.publish({ value: 'Test Two' })
        expect(callbackOne).toHaveBeenCalledWith({ payload: { value: 'Test One' }, unsubscribe: expect.any(Function) })
        expect(callbackOne).toHaveBeenCalledWith({ payload: { value: 'Test Two' }, unsubscribe: expect.any(Function) })
        expect(callbackTwo).not.toHaveBeenCalledWith({ payload: { value: 'Test One' }, unsubscribe: expect.any(Function) })
        expect(callbackTwo).toHaveBeenCalledWith({ payload: { value: 'Test Two' }, unsubscribe: expect.any(Function) })
    })
    it('should unsubscribe correctly within callbacks', () => {
        expect(testPubSub.subscriptions).toEqual([])
        uuid.mockReturnValueOnce('testUUID1' as any).mockReturnValueOnce('testUUID2' as any)
        const callbackOne = vi.fn().mockImplementation(({ unsubscribe }) => { unsubscribe() })
        testPubSub.subscribe(callbackOne)
        const callbackTwo = vi.fn()
        testPubSub.subscribe(callbackTwo)
        expect(testPubSub.subscriptions).toEqual([{
            id: 'testUUID1',
            callback: callbackOne
        },
        {
            id: 'testUUID2',
            callback: callbackTwo
        }])
        testPubSub.publish({ value: 'Test One' })
        expect(testPubSub.subscriptions).toEqual([{
            id: 'testUUID2',
            callback: callbackTwo
        }])
        testPubSub.publish({ value: 'Test Two' })
        expect(callbackOne).toHaveBeenCalledWith({ payload: { value: 'Test One' }, unsubscribe: expect.any(Function) })
        expect(callbackOne).not.toHaveBeenCalledWith({ payload: { value: 'Test Two' }, unsubscribe: expect.any(Function) })
        expect(callbackTwo).toHaveBeenCalledWith({ payload: { value: 'Test One' }, unsubscribe: expect.any(Function) })
        expect(callbackTwo).toHaveBeenCalledWith({ payload: { value: 'Test Two' }, unsubscribe: expect.any(Function) })
    })
})