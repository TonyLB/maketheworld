jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
jest.mock('../../publishMessage', () => ({
    __esModule: true,
    default: jest.fn().mockResolvedValue(undefined),
}))

import messageBus from '../../messageBus'
import type { PublishMessage } from '../../messageBus/baseClasses'
import { sendMessageBundleDeclared, sendMessageSlotReported } from './subscribedEvents'
import { ephemeraMessageOrchestrationDataSource, findDeclaredSlotMatch, consumeSlotMatch } from './index'

const BUNDLE_A = 'bundle-a'

const worldMessage = (text: string): PublishMessage => ({
    type: 'PublishMessage',
    targets: ['ROOM#a'],
    displayProtocol: 'WorldMessage',
    message: [text],
})

const originalMessageBusPublish = messageBus.publish.bind(messageBus)

describe('mtw.ephemera.messageOrchestration DataSource', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        messageBus.clear()
    })

    function spyPublish() {
        return jest.spyOn(messageBus, 'publish').mockImplementation((payload) => {
            originalMessageBusPublish(payload)
        })
    }

    it('registers subscription and flush completes without error when queue is empty', async () => {
        expect(ephemeraMessageOrchestrationDataSource.dataSourceKey).toBe('mtw.ephemera.messageOrchestration')
        await expect(messageBus.flushAndSettle()).resolves.toBeUndefined()
    })

    it('flushes PublishMessage events in declared order once every slot has reported', async () => {
        const publishSpy = spyPublish()

        sendMessageBundleDeclared(messageBus, BUNDLE_A, {
            bundleId: BUNDLE_A,
            slots: [
                { slotId: 'leave', expectedPublishType: 'WorldMessage' },
                { slotId: 'arrive', expectedPublishType: 'WorldMessage' },
            ],
        })
        sendMessageSlotReported(messageBus, BUNDLE_A, {
            bundleId: BUNDLE_A,
            slotId: 'arrive',
            message: worldMessage('Alice has arrived.'),
        })
        sendMessageSlotReported(messageBus, BUNDLE_A, {
            bundleId: BUNDLE_A,
            slotId: 'leave',
            message: worldMessage('Alice has left.'),
        })
        await messageBus.flushAndSettle()

        const worldPublishes = publishSpy.mock.calls
            .map((call) => call[0])
            .filter((message) => message?.type === 'PublishMessage' && message?.displayProtocol === 'WorldMessage')

        expect(worldPublishes.map((m: any) => m.message)).toEqual([
            ['Alice has left.'],
            ['Alice has arrived.'],
        ])
        publishSpy.mockRestore()
    })

    it('settles a bundle with an unresolved slot by publishing only the resolved subset', async () => {
        const publishSpy = spyPublish()

        sendMessageBundleDeclared(messageBus, BUNDLE_A, {
            bundleId: BUNDLE_A,
            slots: [
                { slotId: 'leave', expectedPublishType: 'WorldMessage' },
                { slotId: 'arrive', expectedPublishType: 'WorldMessage' },
            ],
        })
        sendMessageSlotReported(messageBus, BUNDLE_A, {
            bundleId: BUNDLE_A,
            slotId: 'leave',
            message: worldMessage('Alice has left.'),
        })
        await messageBus.flushAndSettle()

        const worldPublishes = publishSpy.mock.calls
            .map((call) => call[0])
            .filter((message) => message?.type === 'PublishMessage' && message?.displayProtocol === 'WorldMessage')

        expect(worldPublishes.map((m: any) => m.message)).toEqual([['Alice has left.']])
        publishSpy.mockRestore()
    })

    describe('slot match index (MO-9)', () => {
        it('a slot declared with componentId/perspectiveKey/threadKind is queryable, and the returned entry wraps the declared spec object', async () => {
            sendMessageBundleDeclared(messageBus, BUNDLE_A, {
                bundleId: BUNDLE_A,
                slots: [{
                    slotId: 'header',
                    expectedPublishType: 'PerceptionMessage',
                    componentId: 'ROOM#a',
                    perspectiveKey: 'PERSPECTIVE#a',
                    targets: ['CHARACTER#viewer'],
                    threadKind: 'characterMove',
                }],
            })
            await messageBus.flushAndSettle()

            const matches = findDeclaredSlotMatch('ROOM#a', 'PERSPECTIVE#a', 'characterMove')
            expect(matches).toHaveLength(1)
            expect(matches[0]).toEqual({
                bundleId: BUNDLE_A,
                spec: {
                    slotId: 'header',
                    expectedPublishType: 'PerceptionMessage',
                    componentId: 'ROOM#a',
                    perspectiveKey: 'PERSPECTIVE#a',
                    targets: ['CHARACTER#viewer'],
                    threadKind: 'characterMove',
                },
            })
        })

        it('two slots sharing (componentId, perspectiveKey) but different threadKind do not cross-contaminate', async () => {
            sendMessageBundleDeclared(messageBus, BUNDLE_A, {
                bundleId: BUNDLE_A,
                slots: [
                    {
                        slotId: 'header',
                        expectedPublishType: 'PerceptionMessage',
                        componentId: 'ROOM#a',
                        perspectiveKey: 'PERSPECTIVE#a',
                        targets: ['CHARACTER#viewer'],
                        threadKind: 'characterMove',
                    },
                    {
                        slotId: 'broadcast',
                        expectedPublishType: 'PerceptionMessage',
                        componentId: 'ROOM#a',
                        perspectiveKey: 'PERSPECTIVE#a',
                        targets: ['CHARACTER#other'],
                        threadKind: 'roomHeaderBroadcast',
                    },
                ],
            })
            await messageBus.flushAndSettle()

            expect(findDeclaredSlotMatch('ROOM#a', 'PERSPECTIVE#a', 'characterMove').map((m) => m.spec.slotId)).toEqual(['header'])
            expect(findDeclaredSlotMatch('ROOM#a', 'PERSPECTIVE#a', 'roomHeaderBroadcast').map((m) => m.spec.slotId)).toEqual(['broadcast'])
        })

        it('two slots sharing (componentId, perspectiveKey, threadKind) but different targets both come back for the caller to disambiguate', async () => {
            sendMessageBundleDeclared(messageBus, 'bundle-x', {
                bundleId: 'bundle-x',
                slots: [{
                    slotId: 'header',
                    expectedPublishType: 'PerceptionMessage',
                    componentId: 'ROOM#a',
                    perspectiveKey: 'PERSPECTIVE#a',
                    targets: ['CHARACTER#one'],
                    threadKind: 'characterMove',
                }],
            })
            sendMessageBundleDeclared(messageBus, 'bundle-y', {
                bundleId: 'bundle-y',
                slots: [{
                    slotId: 'header',
                    expectedPublishType: 'PerceptionMessage',
                    componentId: 'ROOM#a',
                    perspectiveKey: 'PERSPECTIVE#a',
                    targets: ['CHARACTER#two'],
                    threadKind: 'characterMove',
                }],
            })
            await messageBus.flushAndSettle()

            const matches = findDeclaredSlotMatch('ROOM#a', 'PERSPECTIVE#a', 'characterMove')
            expect(matches.map((m) => m.bundleId).sort()).toEqual(['bundle-x', 'bundle-y'])
        })

        it('consumeSlotMatch removes only the matched entry, leaving other candidates for the same key intact', async () => {
            sendMessageBundleDeclared(messageBus, 'bundle-x', {
                bundleId: 'bundle-x',
                slots: [{
                    slotId: 'header',
                    expectedPublishType: 'PerceptionMessage',
                    componentId: 'ROOM#a',
                    perspectiveKey: 'PERSPECTIVE#a',
                    targets: ['CHARACTER#one'],
                    threadKind: 'characterMove',
                }],
            })
            sendMessageBundleDeclared(messageBus, 'bundle-y', {
                bundleId: 'bundle-y',
                slots: [{
                    slotId: 'header',
                    expectedPublishType: 'PerceptionMessage',
                    componentId: 'ROOM#a',
                    perspectiveKey: 'PERSPECTIVE#a',
                    targets: ['CHARACTER#two'],
                    threadKind: 'characterMove',
                }],
            })
            await messageBus.flushAndSettle()

            consumeSlotMatch('ROOM#a', 'PERSPECTIVE#a', 'bundle-x', 'header')

            const matches = findDeclaredSlotMatch('ROOM#a', 'PERSPECTIVE#a', 'characterMove')
            expect(matches.map((m) => m.bundleId)).toEqual(['bundle-y'])
        })

        it('messageBus.clear() empties the slot match index', async () => {
            sendMessageBundleDeclared(messageBus, BUNDLE_A, {
                bundleId: BUNDLE_A,
                slots: [{
                    slotId: 'header',
                    expectedPublishType: 'PerceptionMessage',
                    componentId: 'ROOM#a',
                    perspectiveKey: 'PERSPECTIVE#a',
                    targets: ['CHARACTER#viewer'],
                    threadKind: 'characterMove',
                }],
            })
            await messageBus.flushAndSettle()
            expect(findDeclaredSlotMatch('ROOM#a', 'PERSPECTIVE#a', 'characterMove')).toHaveLength(1)

            messageBus.clear()

            expect(findDeclaredSlotMatch('ROOM#a', 'PERSPECTIVE#a', 'characterMove')).toHaveLength(0)
        })
    })
})
