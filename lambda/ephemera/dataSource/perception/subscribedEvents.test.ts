import {
    isCharacterPerceptionRequestedIngressEnvelope,
    isPerceptionAffordancesPertainStreamEnvelope,
    isPerceptionSubscribedEnvelope,
    isPerceptionThreadRegisteredIngressEnvelope,
    sendCharacterPerceptionRequested,
    sendPerceptionThreadRegistered,
} from './subscribedEvents'
import { AFFORDANCE_CACHE_DATA_SOURCE_KEY } from '../affordanceCache/publishedEvents'

describe('perception subscribedEvents', () => {
    it('sendCharacterPerceptionRequested emits api.ephemera StreamingEvent envelope', async () => {
        const sent: any[] = []
        sendCharacterPerceptionRequested(
            { publish: (payload) => sent.push(payload) },
            'CHARACTER#VIEWED',
            {
                characterId: 'CHARACTER#VIEWER',
                ephemeraId: 'CHARACTER#VIEWED',
            }
        )
        expect(sent).toHaveLength(1)
        expect(sent[0].type).toBe('StreamingEvent')
        expect(sent[0].dataSourceKey).toBe('api.ephemera')
        expect(sent[0].streamKey).toBe('CHARACTER#VIEWED')
        expect(sent[0].header.type).toBe('Character Perception Requested')
        expect(await sent[0].getContent()).toMatchObject({
            characterId: 'CHARACTER#VIEWER',
            ephemeraId: 'CHARACTER#VIEWED',
        })
    })

    it('isCharacterPerceptionRequestedIngressEnvelope accepts Character Perception Requested and rejects unrelated', () => {
        const accepted = {
            header: {
                dataSourceKey: 'api.ephemera',
                streamKey: 'CHARACTER#ONE',
                timestamp: Date.now(),
                type: 'Character Perception Requested',
            },
            getContent: () =>
                Promise.resolve({
                    characterId: 'CHARACTER#TWO',
                    ephemeraId: 'CHARACTER#ONE',
                }),
        }
        const rejected = {
            header: {
                dataSourceKey: 'api.ephemera',
                streamKey: 'CHARACTER#ONE',
                timestamp: Date.now(),
                type: 'Render Requested',
            },
            getContent: () => Promise.resolve({}),
        }
        expect(isCharacterPerceptionRequestedIngressEnvelope(accepted)).toBe(true)
        expect(isCharacterPerceptionRequestedIngressEnvelope(rejected)).toBe(false)
    })

    it('sendPerceptionThreadRegistered publishes api.ephemera StreamingEvent envelope', async () => {
        const published: any[] = []
        sendPerceptionThreadRegistered(
            { publish: (payload) => published.push(payload) },
            'ROOM#ROOM1',
            {
                threadKind: 'roomHeaderBroadcast',
                componentId: 'ROOM#ROOM1',
                perspectiveKey: 'persp-a',
                targets: ['CHARACTER#VIEWER'],
            }
        )
        expect(published).toHaveLength(1)
        expect(published[0].type).toBe('StreamingEvent')
        expect(published[0].dataSourceKey).toBe('api.ephemera')
        expect(published[0].streamKey).toBe('ROOM#ROOM1')
        expect(published[0].header.type).toBe('Perception Thread Registered')
        expect(await published[0].getContent()).toMatchObject({
            threadKind: 'roomHeaderBroadcast',
            componentId: 'ROOM#ROOM1',
            perspectiveKey: 'persp-a',
            targets: ['CHARACTER#VIEWER'],
        })
    })

    it('isPerceptionThreadRegisteredIngressEnvelope accepts Perception Thread Registered and rejects unrelated', () => {
        const accepted = {
            header: {
                dataSourceKey: 'api.ephemera',
                streamKey: 'ROOM#R',
                timestamp: Date.now(),
                type: 'Perception Thread Registered',
            },
            getContent: () =>
                Promise.resolve({
                    threadKind: 'roomDescription',
                    componentId: 'ROOM#R',
                    perspectiveKey: 'p',
                    characterId: 'CHARACTER#viewer',
                }),
        }
        const rejected = {
            header: {
                dataSourceKey: 'api.ephemera',
                streamKey: 'ROOM#R',
                timestamp: Date.now(),
                type: 'Character Perception Requested',
            },
            getContent: () => Promise.resolve({}),
        }
        expect(isPerceptionThreadRegisteredIngressEnvelope(accepted)).toBe(true)
        expect(isPerceptionThreadRegisteredIngressEnvelope(rejected)).toBe(false)
    })

    it('isPerceptionSubscribedEnvelope matches Character or Perception Thread Registered ingress', () => {
        const character = {
            header: {
                dataSourceKey: 'api.ephemera',
                streamKey: 'CHARACTER#ONE',
                timestamp: Date.now(),
                type: 'Character Perception Requested',
            },
            getContent: () => Promise.resolve({}),
        }
        const threadReg = {
            header: {
                dataSourceKey: 'api.ephemera',
                streamKey: 'ROOM#one',
                timestamp: Date.now(),
                type: 'Perception Thread Registered',
            },
            getContent: () => Promise.resolve({
                threadKind: 'roomDescription',
                componentId: 'ROOM#one',
                perspectiveKey: 'k',
                characterId: 'CHARACTER#viewer',
            }),
        }
        expect(isPerceptionSubscribedEnvelope(character as any)).toBe(true)
        expect(isPerceptionSubscribedEnvelope(threadReg as any)).toBe(true)
        expect(
            isPerceptionSubscribedEnvelope({
                header: {
                    dataSourceKey: 'api.ephemera',
                    streamKey: 'ROOM#one',
                    timestamp: Date.now(),
                    type: 'Render Requested',
                },
                getContent: () => Promise.resolve({}),
            } as any)
        ).toBe(false)
    })

    it('isPerceptionAffordancesPertainStreamEnvelope accepts Affordances Pertain and rejects Cache Error', () => {
        const accepted = {
            header: {
                dataSourceKey: AFFORDANCE_CACHE_DATA_SOURCE_KEY,
                streamKey: 'ROOM#one',
                timestamp: Date.now(),
                type: 'Affordances Pertain',
            },
            getContent: () => Promise.resolve({ type: 'Affordances Pertain' }),
        }
        const rejected = {
            header: {
                dataSourceKey: AFFORDANCE_CACHE_DATA_SOURCE_KEY,
                streamKey: 'ROOM#one',
                timestamp: Date.now(),
                type: 'Cache Error',
            },
            getContent: () => Promise.resolve({ type: 'Cache Error' }),
        }
        expect(isPerceptionAffordancesPertainStreamEnvelope(accepted)).toBe(true)
        expect(isPerceptionAffordancesPertainStreamEnvelope(rejected)).toBe(false)
        expect(isPerceptionSubscribedEnvelope(accepted as any)).toBe(true)
        expect(isPerceptionSubscribedEnvelope(rejected as any)).toBe(false)
    })

    it('isPerceptionSubscribedEnvelope matches membership presentation ingress', () => {
        const navigate = {
            header: {
                dataSourceKey: 'mtw.ephemera.actions',
                streamKey: 'CHARACTER#Alice',
                timestamp: Date.now(),
                type: 'Character Navigate',
            },
            getContent: () => Promise.resolve({
                type: 'Character Navigate',
                characterId: 'CHARACTER#Alice',
                fromRoomId: 'ROOM#a',
                toRoomId: 'ROOM#b',
            }),
        }
        const moved = {
            header: {
                dataSourceKey: 'mtw.ephemera.positions',
                streamKey: 'CHARACTER#Alice',
                timestamp: Date.now(),
                type: 'Character Moved',
            },
            getContent: () => Promise.resolve({
                type: 'Character Moved',
                characterId: 'CHARACTER#Alice',
                froms: ['ROOM#a'],
                to: 'ROOM#b',
                beatAnchorTime: Date.now(),
            }),
        }
        expect(isPerceptionSubscribedEnvelope(navigate as any)).toBe(true)
        expect(isPerceptionSubscribedEnvelope(moved as any)).toBe(true)
    })

    it('isPerceptionSubscribedEnvelope matches object manipulation presentation ingress', () => {
        const takeHold = {
            header: {
                dataSourceKey: 'mtw.ephemera.actions',
                streamKey: 'CHARACTER#Alice',
                timestamp: Date.now(),
                type: 'Object Take Hold',
            },
            getContent: () => Promise.resolve({
                type: 'Object Take Hold',
                characterId: 'CHARACTER#Alice',
                objectId: 'OBJECT#Broom',
                roomId: 'ROOM#Cafe',
            }),
        }
        const objectMoved = {
            header: {
                dataSourceKey: 'mtw.ephemera.positions',
                streamKey: 'OBJECT#Broom',
                timestamp: Date.now(),
                type: 'Object Moved',
            },
            getContent: () => Promise.resolve({
                type: 'Object Moved',
                objectId: 'OBJECT#Broom',
                froms: ['ROOM#Cafe'],
                to: 'CHARACTER#Alice',
                beatAnchorTime: Date.now(),
            }),
        }
        expect(isPerceptionSubscribedEnvelope(takeHold as any)).toBe(true)
        expect(isPerceptionSubscribedEnvelope(objectMoved as any)).toBe(true)

        const objectDrop = {
            header: {
                dataSourceKey: 'mtw.ephemera.actions',
                streamKey: 'CHARACTER#Alice',
                timestamp: Date.now(),
                type: 'Object Drop',
            },
            getContent: () => Promise.resolve({
                type: 'Object Drop',
                characterId: 'CHARACTER#Alice',
                objectId: 'OBJECT#Broom',
                roomId: 'ROOM#Cafe',
            }),
        }
        expect(isPerceptionSubscribedEnvelope(objectDrop as any)).toBe(true)
    })
})
