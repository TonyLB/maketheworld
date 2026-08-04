import {
    isPerceptionAffordancesPertainStreamEnvelope,
    isPerceptionSubscribedEnvelope,
    isPerceptionThreadRegisteredIngressEnvelope,
    sendPerceptionThreadRegistered,
} from './subscribedEvents'
import { AFFORDANCE_CACHE_DATA_SOURCE_KEY } from '../affordanceCache/publishedEvents'

describe('perception subscribedEvents', () => {
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
                type: 'Render Requested',
            },
            getContent: () => Promise.resolve({}),
        }
        expect(isPerceptionThreadRegisteredIngressEnvelope(accepted)).toBe(true)
        expect(isPerceptionThreadRegisteredIngressEnvelope(rejected)).toBe(false)
    })

    //
    // `Character Perception Requested` was the imperative character-look ingress, retired once
    // character `link` joined Feature/Knowledge on the render-orchestration path. It is asserted
    // *rejected* here rather than simply dropped from the suite: an unreachable-but-accepted
    // second route to the same output is what let the character path break silently before.
    //
    it('isPerceptionSubscribedEnvelope matches Perception Thread Registered and rejects retired Character ingress', () => {
        const retiredCharacter = {
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
        expect(isPerceptionSubscribedEnvelope(retiredCharacter as any)).toBe(false)
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

    it('isPerceptionSubscribedEnvelope matches relational object manipulation ingress', () => {
        const establishRelation = {
            header: {
                dataSourceKey: 'mtw.ephemera.actions',
                streamKey: 'CHARACTER#Alice',
                timestamp: Date.now(),
                type: 'Object Establish Relation',
            },
            getContent: () => Promise.resolve({}),
        }
        const relationChanged = {
            header: {
                dataSourceKey: 'mtw.ephemera.positions',
                streamKey: 'OBJECT#Broom',
                timestamp: Date.now(),
                type: 'Object Relation Changed',
            },
            getContent: () => Promise.resolve({}),
        }
        expect(isPerceptionSubscribedEnvelope(establishRelation as any)).toBe(true)
        expect(isPerceptionSubscribedEnvelope(relationChanged as any)).toBe(true)
    })

    it('does not subscribe to the retired object-move events', () => {
        // Phase 4: object moves narrate through the mutation kernel, so perception has no reason to
        // see Take Hold / Drop / Object Moved --- the same removal Phase 3 made for the character
        // membership events when membership narration migrated.
        const retired = ['Object Take Hold', 'Object Drop'].map((type) => ({
            header: {
                dataSourceKey: 'mtw.ephemera.actions',
                streamKey: 'CHARACTER#Alice',
                timestamp: Date.now(),
                type,
            },
            getContent: () => Promise.resolve({}),
        })).concat([{
            header: {
                dataSourceKey: 'mtw.ephemera.positions',
                streamKey: 'OBJECT#Broom',
                timestamp: Date.now(),
                type: 'Object Moved',
            },
            getContent: () => Promise.resolve({}),
        }])

        retired.forEach((envelope) => {
            expect(isPerceptionSubscribedEnvelope(envelope as any)).toBe(false)
        })
    })
})
