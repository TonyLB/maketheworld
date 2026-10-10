jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { answerPending } from './answer'
import { applyOptimisticUpdate, twoCupPendingPayload } from './testFixtures'

const nowSeconds = () => Math.floor(Date.now() / 1000)

const fakeOptimisticUpdate = (row: Record<string, unknown> | undefined) => {
    ;(ephemeraDB.optimisticUpdate as jest.Mock).mockImplementation(async (props) => (await applyOptimisticUpdate(row, props)).returned)
}

describe('answerPending', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('answers a valid option and hands back the resumable payload with the answers merged and no pending', async () => {
        const payload = twoCupPendingPayload()
        const [key] = Object.keys(payload.pending!.options['option-red']!)
        fakeOptimisticUpdate({ ...payload, deleteAt: nowSeconds() + 100 })
        const result = await answerPending('CHARACTER#TESS', 'abc', 'option-blue')
        expect(result.outcome).toBe('answered')
        if (result.outcome === 'answered') {
            expect(result.payload.referentAnswers).toEqual({ [key!]: 'OBJECT#BlueCup' })
            expect(result.payload.pending).toBeUndefined()
            expect(result.payload.root).toEqual(payload.root)
        }
        const props = (ephemeraDB.optimisticUpdate as jest.Mock).mock.calls[0][0]
        expect(props.Key).toEqual({ EphemeraId: 'CHARACTER#TESS', DataCategory: 'SESSION#abc' })
        expect(props.checkKeys).toEqual(['pending'])
    })

    it('reports a second answer to an answered question as a duplicate, whichever option it names', async () => {
        const payload = twoCupPendingPayload()
        fakeOptimisticUpdate({ ...payload, pending: { ...payload.pending!, answer: 'option-red' }, deleteAt: nowSeconds() + 100 })
        expect(await answerPending('CHARACTER#TESS', 'abc', 'option-red')).toEqual({ outcome: 'duplicate' })
        expect(await answerPending('CHARACTER#TESS', 'abc', 'option-blue')).toEqual({ outcome: 'duplicate' })
    })

    it('treats an unknown option as stale', async () => {
        fakeOptimisticUpdate({ ...twoCupPendingPayload(), deleteAt: nowSeconds() + 100 })
        expect((await answerPending('CHARACTER#TESS', 'abc', 'option-green')).outcome).toBe('stale')
    })

    it('treats a missing row as stale, with no bubble to speak on', async () => {
        fakeOptimisticUpdate(undefined)
        expect(await answerPending('CHARACTER#TESS', 'abc', 'option-red')).toEqual({ outcome: 'stale' })
    })

    it('treats an expired row as stale', async () => {
        fakeOptimisticUpdate({ ...twoCupPendingPayload(), deleteAt: nowSeconds() - 10 })
        expect(await answerPending('CHARACTER#TESS', 'abc', 'option-red')).toEqual({ outcome: 'stale' })
    })

    it('treats a row with no open question as stale', async () => {
        const { pending, ...rest } = twoCupPendingPayload()
        fakeOptimisticUpdate({ ...rest, deleteAt: nowSeconds() + 100 })
        expect((await answerPending('CHARACTER#TESS', 'abc', 'option-red')).outcome).toBe('stale')
    })

    it('treats a row that fails the guard as stale', async () => {
        fakeOptimisticUpdate({ ...twoCupPendingPayload(), root: 'garbage', deleteAt: nowSeconds() + 100 })
        expect(await answerPending('CHARACTER#TESS', 'abc', 'option-red')).toEqual({ outcome: 'stale' })
    })

    it('is stale when the write loses to an overwritten question (successCallback never fires)', async () => {
        const payload = twoCupPendingPayload()
        ;(ephemeraDB.optimisticUpdate as jest.Mock).mockResolvedValue({ EphemeraId: 'CHARACTER#TESS', DataCategory: 'SESSION#abc', ...payload, deleteAt: nowSeconds() + 100 })
        expect(await answerPending('CHARACTER#TESS', 'abc', 'option-red')).toEqual({ outcome: 'stale', transcript: payload.transcript })
    })
})
