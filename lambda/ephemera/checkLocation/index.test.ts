jest.mock('../internalCache')
import internalCache from '../internalCache'

jest.mock('../dataSource/positions/membership/repairCharacterLegalPlacement', () => ({
    repairCharacterLegalPlacement: jest.fn().mockResolvedValue({ trimmed: false, relocated: false }),
}))

jest.mock('../dataSource/positions', () => ({
    __esModule: true,
    default: {
        streamEvent: jest.fn().mockResolvedValue(undefined),
    },
}))

import { MessageBus } from '../messageBus/baseClasses'
import checkLocation from '.'
import { checkLocationCoalescer } from './coalescer'
import { repairCharacterLegalPlacement } from '../dataSource/positions/membership/repairCharacterLegalPlacement'
import { Graph } from '@tonylb/mtw-utilities/ts/graphStorage/utils/graph'

// @ts-ignore
const internalCacheMock = jest.mocked(internalCache, true)
const repairCharacterLegalPlacementMock = repairCharacterLegalPlacement as jest.MockedFunction<
    typeof repairCharacterLegalPlacement
>

describe('checkLocation', () => {
    const messageBusMock = {
        send: jest.fn(),
        publish: jest.fn(),
    } as unknown as jest.Mocked<MessageBus>

    beforeEach(() => {
        jest.clearAllMocks()
        checkLocationCoalescer.reset()
        repairCharacterLegalPlacementMock.mockResolvedValue({ trimmed: false, relocated: false })
    })

    it('delegates player payloads to repairCharacterLegalPlacement', async () => {
        await checkLocation({
            payloads: [{ type: 'CheckLocation', characterId: 'CHARACTER#Test', forceMove: true }],
            messageBus: messageBusMock,
        })

        expect(repairCharacterLegalPlacementMock).toHaveBeenCalledWith(expect.objectContaining({
            characterId: 'CHARACTER#Test',
            forceMove: true,
            messageBus: messageBusMock,
            streamEvent: expect.any(Function),
        }))
    })

    it('expands room payloads to characters in the room', async () => {
        internalCacheMock.RoomCharacterList.get.mockResolvedValue([
            { EphemeraId: 'CHARACTER#Alpha', DisplayName: 'Alpha', SessionIds: [] },
            { EphemeraId: 'CHARACTER#Beta', DisplayName: 'Beta', SessionIds: [] },
        ])

        await checkLocation({
            payloads: [{ type: 'CheckLocation', roomId: 'ROOM#Oubliette' }],
            messageBus: messageBusMock,
        })

        expect(repairCharacterLegalPlacementMock).toHaveBeenCalledTimes(2)
        expect(repairCharacterLegalPlacementMock).toHaveBeenCalledWith(expect.objectContaining({
            characterId: 'CHARACTER#Alpha',
        }))
        expect(repairCharacterLegalPlacementMock).toHaveBeenCalledWith(expect.objectContaining({
            characterId: 'CHARACTER#Beta',
        }))
    })

    it('expands asset payloads to characters in descendant rooms', async () => {
        internalCacheMock.RoomCharacterList.get.mockImplementation(async (roomId: string) => {
            if (roomId === 'ROOM#Laboratory') {
                return [{ EphemeraId: 'CHARACTER#Alpha', DisplayName: 'Alpha', SessionIds: [] }]
            }
            return [{ EphemeraId: 'CHARACTER#Beta', DisplayName: 'Beta', SessionIds: [] }]
        })
        const assetGraph = new Graph<string, { key: string }, { context?: string }>(
            {
                'ASSET#draftTwo': { key: 'ASSET#draftTwo' },
                'ROOM#Laboratory': { key: 'ROOM#Laboratory' },
                'ROOM#Oubliette': { key: 'ROOM#Oubliette' },
            },
            [
                { from: 'ASSET#draftTwo', to: 'ROOM#Laboratory', context: 'draftTwo' },
                { from: 'ASSET#draftTwo', to: 'ROOM#Oubliette', context: 'draftTwo' },
            ],
            {},
            true
        )
        internalCacheMock.Graph.get.mockResolvedValue(assetGraph)

        await checkLocation({
            payloads: [{ type: 'CheckLocation', assetId: 'ASSET#draftTwo' }],
            messageBus: messageBusMock,
        })

        expect(repairCharacterLegalPlacementMock).toHaveBeenCalledTimes(2)
        expect(repairCharacterLegalPlacementMock).toHaveBeenCalledWith(expect.objectContaining({
            characterId: 'CHARACTER#Alpha',
        }))
        expect(repairCharacterLegalPlacementMock).toHaveBeenCalledWith(expect.objectContaining({
            characterId: 'CHARACTER#Beta',
        }))
    })

    it('repairs each character only once when duplicate payloads are batched', async () => {
        await checkLocation({
            payloads: [
                { type: 'CheckLocation', characterId: 'CHARACTER#Test' },
                { type: 'CheckLocation', characterId: 'CHARACTER#Test' },
            ],
            messageBus: messageBusMock,
        })

        expect(repairCharacterLegalPlacementMock).toHaveBeenCalledTimes(1)
    })

    it('repairs each character only once when concurrent handler invocations overlap', async () => {
        const payload = { type: 'CheckLocation' as const, characterId: 'CHARACTER#Test' as const }
        await Promise.all([
            checkLocation({ payloads: [payload], messageBus: messageBusMock }),
            checkLocation({ payloads: [payload], messageBus: messageBusMock }),
        ])

        expect(repairCharacterLegalPlacementMock).toHaveBeenCalledTimes(1)
    })
})
