jest.mock('../affordanceCache/catalogRow')
jest.mock('../affordanceCache/ensureAffordanceTopology')

import { orchestrateAffordanceRequest } from './orchestrationHandler'
import { getAffordanceRow } from '../affordanceCache/catalogRow'
import { ensureAffordanceTopology } from '../affordanceCache/ensureAffordanceTopology'

const getAffordanceRowMock = getAffordanceRow as jest.MockedFunction<typeof getAffordanceRow>
const ensureTopologyMock = ensureAffordanceTopology as jest.MockedFunction<typeof ensureAffordanceTopology>

describe('orchestrateAffordanceRequest', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        ensureTopologyMock.mockResolvedValue(undefined)
    })

    it('skips ensure when catalog is ready and reason is roster', async () => {
        getAffordanceRowMock.mockResolvedValue({
            EphemeraId: 'ROOM#one',
            DataCategory: 'Affordance::PERSPECTIVE#v1#a',
            assetStack: ['ASSET#a'],
            catalogVersion: 1,
            hydratedCatalogVersion: 1,
            topology: { roomUniversalKey: 'ROOM#one', exits: [] },
        })

        const streamEvent = jest.fn().mockResolvedValue(undefined)

        await orchestrateAffordanceRequest({
            payload: {
                type: 'AffordancesRequested',
                roomId: 'ROOM#one',
                perspective: { assetStack: ['ASSET#a'] },
                reason: 'roster',
            },
            messageBus: { send: jest.fn() } as any,
            streamEvent,
        })

        expect(ensureTopologyMock).not.toHaveBeenCalled()
        expect(streamEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                update: expect.objectContaining({ type: 'Slice Ready' }),
            })
        )
    })

    it('calls ensureAffordanceTopology when reason is topology', async () => {
        getAffordanceRowMock.mockResolvedValue({
            EphemeraId: 'ROOM#one',
            DataCategory: 'Affordance::PERSPECTIVE#v1#a',
            assetStack: ['ASSET#a'],
            catalogVersion: 1,
            hydratedCatalogVersion: 1,
            topology: { roomUniversalKey: 'ROOM#one', exits: [] },
        })

        const streamEvent = jest.fn().mockResolvedValue(undefined)

        await orchestrateAffordanceRequest({
            payload: {
                type: 'AffordancesRequested',
                roomId: 'ROOM#one',
                perspective: { assetStack: ['ASSET#a'] },
                reason: 'topology',
            },
            messageBus: { send: jest.fn() } as any,
            streamEvent,
        })

        expect(ensureTopologyMock).toHaveBeenCalled()
    })
})
