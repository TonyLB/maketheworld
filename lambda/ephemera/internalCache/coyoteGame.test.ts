jest.mock('@tonylb/mtw-utilities/ts/dynamoDB/index')

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB/index'
import { CacheCoyoteGameData } from './coyoteGame'

const ephemeraMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>

const stubOutcome = ['Outcome: Stubbed'] as const

const defaultDeps = () => ({
    generateIntent: jest.fn().mockResolvedValue({ intent: 'Hypothesis: Fresh' }),
    generateOutcome: jest.fn().mockResolvedValue(stubOutcome),
})

const INTENT_PROJECTION_FIELDS = [
    'intent',
    'walkthrough',
    'narrativeBeatsStructured',
    'phasePlan',
    'sceneAnalysis',
    'gimmick',
] as const

describe('CacheCoyoteGameData', () => {
    const intentKey = {
        EphemeraId: 'Global',
        DataCategory: 'CoyoteGame#Intent',
    } as const

    const outcomeKey = {
        EphemeraId: 'Global',
        DataCategory: 'CoyoteGame#Outcome',
    } as const

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    describe('intent', () => {
        it('returns cached in-memory intent without hitting Dynamo', async () => {
            const { generateIntent, generateOutcome } = defaultDeps()
            const cache = new CacheCoyoteGameData({ generateIntent, generateOutcome })

            cache.set({ key: 'intent', value: { intent: 'Hypothesis: Cached' } })

            await expect(cache.get('intent')).resolves.toEqual({ intent: 'Hypothesis: Cached' })
            expect(ephemeraMock.getItem).not.toHaveBeenCalled()
            expect(generateIntent).not.toHaveBeenCalled()
        })

        it('reads intent from durable Global row on local miss', async () => {
            const { generateIntent, generateOutcome } = defaultDeps()
            ephemeraMock.getItem.mockResolvedValue({ intent: 'Hypothesis: Durable' })
            const cache = new CacheCoyoteGameData({ generateIntent, generateOutcome })

            await expect(cache.get('intent')).resolves.toEqual({ intent: 'Hypothesis: Durable' })
            expect(ephemeraMock.getItem).toHaveBeenCalledWith({
                Key: intentKey,
                ProjectionFields: [...INTENT_PROJECTION_FIELDS],
            })
            expect(generateIntent).not.toHaveBeenCalled()
        })

        it('maps legacy durable sceneAnalysis to walkthrough when walkthrough absent', async () => {
            const { generateIntent, generateOutcome } = defaultDeps()
            ephemeraMock.getItem.mockResolvedValue({
                intent: 'Hypothesis: Durable',
                sceneAnalysis: '## Scene analysis\nNotes.',
            })
            const cache = new CacheCoyoteGameData({ generateIntent, generateOutcome })

            await expect(cache.get('intent')).resolves.toEqual({
                intent: 'Hypothesis: Durable',
                walkthrough: '## Cartoon play-by-play\nNotes.',
            })
            expect(generateIntent).not.toHaveBeenCalled()
        })

        it('prefers durable walkthrough over legacy sceneAnalysis', async () => {
            const { generateIntent, generateOutcome } = defaultDeps()
            ephemeraMock.getItem.mockResolvedValue({
                intent: 'Hypothesis: Durable',
                sceneAnalysis: 'legacy',
                walkthrough: '## Scene analysis\nPreferred.',
            })
            const cache = new CacheCoyoteGameData({ generateIntent, generateOutcome })

            await expect(cache.get('intent')).resolves.toEqual({
                intent: 'Hypothesis: Durable',
                walkthrough: '## Cartoon play-by-play\nPreferred.',
            })
            expect(generateIntent).not.toHaveBeenCalled()
        })

        it('maps legacy sceneAnalysis with ## Cartoon play-by-play heading to walkthrough', async () => {
            const { generateIntent, generateOutcome } = defaultDeps()
            ephemeraMock.getItem.mockResolvedValue({
                intent: 'Hypothesis: Durable',
                sceneAnalysis: '## Cartoon play-by-play\nRocket gag.',
            })
            const cache = new CacheCoyoteGameData({ generateIntent, generateOutcome })

            await expect(cache.get('intent')).resolves.toEqual({
                intent: 'Hypothesis: Durable',
                walkthrough: '## Cartoon play-by-play\nRocket gag.',
            })
            expect(generateIntent).not.toHaveBeenCalled()
        })

        it('generates and persists intent on durable miss', async () => {
            const { generateIntent, generateOutcome } = defaultDeps()
            generateIntent.mockResolvedValue({ intent: 'Hypothesis: Generated' })
            ephemeraMock.getItem.mockResolvedValue(undefined)
            const cache = new CacheCoyoteGameData({ generateIntent, generateOutcome })

            await expect(cache.get('intent')).resolves.toEqual({ intent: 'Hypothesis: Generated' })
            expect(generateIntent).toHaveBeenCalledTimes(1)
            expect(ephemeraMock.putItem).toHaveBeenCalledWith({
                ...intentKey,
                intent: 'Hypothesis: Generated',
            })
        })

        it('persists walkthrough when generator returns it', async () => {
            const { generateIntent, generateOutcome } = defaultDeps()
            generateIntent.mockResolvedValue({
                intent: 'Hypothesis: Generated',
                walkthrough: 'Scaffolding.',
            })
            ephemeraMock.getItem.mockResolvedValue(undefined)
            const cache = new CacheCoyoteGameData({ generateIntent, generateOutcome })

            await expect(cache.get('intent')).resolves.toEqual({
                intent: 'Hypothesis: Generated',
                walkthrough: 'Scaffolding.',
            })
            expect(ephemeraMock.putItem).toHaveBeenCalledWith({
                ...intentKey,
                intent: 'Hypothesis: Generated',
                walkthrough: 'Scaffolding.',
            })
        })

        it('reads gimmick from durable row when present', async () => {
            const { generateIntent, generateOutcome } = defaultDeps()
            ephemeraMock.getItem.mockResolvedValue({
                intent: 'Hypothesis: Durable',
                gimmick: 'high speed chase',
            })
            const cache = new CacheCoyoteGameData({ generateIntent, generateOutcome })

            await expect(cache.get('intent')).resolves.toEqual({
                intent: 'Hypothesis: Durable',
                gimmick: 'high speed chase',
            })
            expect(ephemeraMock.getItem).toHaveBeenCalledWith({
                Key: intentKey,
                ProjectionFields: [...INTENT_PROJECTION_FIELDS],
            })
            expect(generateIntent).not.toHaveBeenCalled()
        })

        it('omits gimmick from record when durable gimmick is blank', async () => {
            const { generateIntent, generateOutcome } = defaultDeps()
            ephemeraMock.getItem.mockResolvedValue({
                intent: 'Hypothesis: Durable',
                gimmick: '   ',
            })
            const cache = new CacheCoyoteGameData({ generateIntent, generateOutcome })

            await expect(cache.get('intent')).resolves.toEqual({ intent: 'Hypothesis: Durable' })
            expect(generateIntent).not.toHaveBeenCalled()
        })

        it('persists gimmick when generator returns it', async () => {
            const { generateIntent, generateOutcome } = defaultDeps()
            generateIntent.mockResolvedValue({
                intent: 'Hypothesis: Generated',
                gimmick: 'deliver damage',
            })
            ephemeraMock.getItem.mockResolvedValue(undefined)
            const cache = new CacheCoyoteGameData({ generateIntent, generateOutcome })

            await expect(cache.get('intent')).resolves.toEqual({
                intent: 'Hypothesis: Generated',
                gimmick: 'deliver damage',
            })
            expect(ephemeraMock.putItem).toHaveBeenCalledWith({
                ...intentKey,
                intent: 'Hypothesis: Generated',
                gimmick: 'deliver damage',
            })
        })

        it('does not write gimmick key when generator returns whitespace gimmick', async () => {
            const { generateIntent, generateOutcome } = defaultDeps()
            generateIntent.mockResolvedValue({
                intent: 'Hypothesis: Generated',
                gimmick: '  \t  ',
            })
            ephemeraMock.getItem.mockResolvedValue(undefined)
            const cache = new CacheCoyoteGameData({ generateIntent, generateOutcome })

            await expect(cache.get('intent')).resolves.toEqual({ intent: 'Hypothesis: Generated' })
            expect(ephemeraMock.putItem).toHaveBeenCalledWith({
                ...intentKey,
                intent: 'Hypothesis: Generated',
            })
        })

        it('invalidate clears local cache and deletes durable row', async () => {
            const { generateIntent, generateOutcome } = defaultDeps()
            ephemeraMock.getItem.mockResolvedValueOnce({ intent: 'Hypothesis: Durable' }).mockResolvedValueOnce(undefined)
            const cache = new CacheCoyoteGameData({ generateIntent, generateOutcome })

            await expect(cache.get('intent')).resolves.toEqual({ intent: 'Hypothesis: Durable' })
            await cache.invalidate('intent')
            await expect(cache.get('intent')).resolves.toEqual({ intent: 'Hypothesis: Fresh' })

            expect(ephemeraMock.deleteItem).toHaveBeenCalledWith(intentKey)
            expect(generateIntent).toHaveBeenCalledTimes(1)
        })
    })

    describe('outcome', () => {
        it('returns cached in-memory outcome without hitting Dynamo', async () => {
            const { generateIntent, generateOutcome } = defaultDeps()
            const cache = new CacheCoyoteGameData({ generateIntent, generateOutcome })

            cache.set({ key: 'outcome', value: ['Cached'] })

            await expect(cache.get('outcome')).resolves.toEqual(['Cached'])
            expect(ephemeraMock.getItem).not.toHaveBeenCalled()
            expect(generateOutcome).not.toHaveBeenCalled()
        })

        it('reads outcome from durable Global row on local miss', async () => {
            const { generateIntent, generateOutcome } = defaultDeps()
            ephemeraMock.getItem.mockResolvedValue({ outcome: ['Outcome: Durable'] })
            const cache = new CacheCoyoteGameData({ generateIntent, generateOutcome })

            await expect(cache.get('outcome')).resolves.toEqual(['Outcome: Durable'])
            expect(ephemeraMock.getItem).toHaveBeenCalledWith({
                Key: outcomeKey,
                ProjectionFields: ['outcome'],
            })
            expect(generateOutcome).not.toHaveBeenCalled()
        })

        it('generates and persists outcome on durable miss', async () => {
            const { generateIntent, generateOutcome } = defaultDeps()
            generateOutcome.mockResolvedValue(['Outcome: Generated'])
            ephemeraMock.getItem.mockResolvedValue(undefined)
            const cache = new CacheCoyoteGameData({ generateIntent, generateOutcome })

            await expect(cache.get('outcome')).resolves.toEqual(['Outcome: Generated'])
            expect(generateOutcome).toHaveBeenCalledTimes(1)
            expect(ephemeraMock.putItem).toHaveBeenCalledWith({
                ...outcomeKey,
                outcome: ['Outcome: Generated'],
            })
        })

        it('invalidate clears local cache and deletes durable row', async () => {
            const { generateIntent, generateOutcome } = defaultDeps()
            ephemeraMock.getItem
                .mockResolvedValueOnce({ outcome: ['Outcome: Durable'] })
                .mockResolvedValueOnce(undefined)
            const cache = new CacheCoyoteGameData({ generateIntent, generateOutcome })

            await expect(cache.get('outcome')).resolves.toEqual(['Outcome: Durable'])
            await cache.invalidate('outcome')
            await expect(cache.get('outcome')).resolves.toEqual(stubOutcome)

            expect(ephemeraMock.deleteItem).toHaveBeenCalledWith(outcomeKey)
            expect(generateOutcome).toHaveBeenCalledTimes(1)
        })
    })
})
