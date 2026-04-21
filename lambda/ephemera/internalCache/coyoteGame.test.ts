jest.mock('@tonylb/mtw-utilities/ts/dynamoDB/index')

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB/index'
import { CacheCoyoteGameData } from './coyoteGame'

const ephemeraMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>

const stubOutcome = ['Outcome: Stubbed'] as const

const defaultDeps = () => ({
    generateIntent: jest.fn().mockResolvedValue({ intent: 'Hypothesis: Fresh' }),
    generateOutcome: jest.fn().mockResolvedValue(stubOutcome),
})

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
                ProjectionFields: ['intent', 'walkthrough', 'phasePlan', 'sceneAnalysis'],
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
                walkthrough: '## Scene analysis\nNotes.',
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
                walkthrough: '## Scene analysis\nPreferred.',
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
