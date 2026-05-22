jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    ephemeraDB: {
        query: jest.fn(),
        putItem: jest.fn(),
        deleteItem: jest.fn(),
    },
}))

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import {
    deleteAdjacencyForRemovedSlice,
    deleteAllAdjacencyLinksForSituation,
    deleteSituationAdjacencyLink,
    putSituationAdjacencyLink,
    queryAdjacencyLinksForSituation,
    upsertAdjacencyForAuthoredSlice,
} from './situationAdjacency'
import type { SituationCacheAdjacencyRow } from './baseClasses'

const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>

const situationId = 'SITUATION#sit-1' as const
const hostId = 'ROOM#hall' as const
const perspectiveKey = 'PERSPECTIVE#v1#abc'

const linkRow = (): SituationCacheAdjacencyRow => ({
    EphemeraId: situationId,
    DataCategory: `Link::${hostId}::Cache::${perspectiveKey}`,
    assetStack: ['ASSET#a', 'ASSET#b'],
})

describe('situationAdjacency', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        ;(ephemeraDBMock.putItem as jest.Mock).mockResolvedValue(undefined)
        ;(ephemeraDBMock.deleteItem as jest.Mock).mockResolvedValue(undefined)
    })

    it('queryAdjacencyLinksForSituation filters invalid rows', async () => {
        const valid = linkRow()
        ;(ephemeraDBMock.query as jest.Mock).mockResolvedValue([
            valid,
            { EphemeraId: situationId, DataCategory: 'Link::bad' },
        ])

        const result = await queryAdjacencyLinksForSituation(situationId)

        expect(result).toEqual([valid])
    })

    it('upsertAdjacencyForAuthoredSlice puts link row', async () => {
        await upsertAdjacencyForAuthoredSlice({
            situationId,
            hostEphemeraId: hostId,
            perspectiveKey,
            assetStack: ['ASSET#a'],
        })

        expect(ephemeraDBMock.putItem).toHaveBeenCalledWith(
            expect.objectContaining({
                EphemeraId: situationId,
                DataCategory: `Link::${hostId}::Cache::${perspectiveKey}`,
                assetStack: ['ASSET#a'],
            })
        )
    })

    it('deleteAdjacencyForRemovedSlice deletes one link', async () => {
        await deleteAdjacencyForRemovedSlice({ situationId, hostEphemeraId: hostId, perspectiveKey })

        expect(ephemeraDBMock.deleteItem).toHaveBeenCalledWith({
            EphemeraId: situationId,
            DataCategory: `Link::${hostId}::Cache::${perspectiveKey}`,
        })
    })

    it('deleteAllAdjacencyLinksForSituation deletes every link in partition', async () => {
        const a = linkRow()
        const b: SituationCacheAdjacencyRow = {
            ...a,
            DataCategory: `Link::ROOM#other::Cache::${perspectiveKey}`,
        }
        ;(ephemeraDBMock.query as jest.Mock).mockResolvedValue([a, b])

        await deleteAllAdjacencyLinksForSituation(situationId)

        expect(ephemeraDBMock.deleteItem).toHaveBeenCalledTimes(2)
    })

    it('putSituationAdjacencyLink and deleteSituationAdjacencyLink delegate to ephemeraDB', async () => {
        const row = linkRow()
        await putSituationAdjacencyLink(row)
        expect(ephemeraDBMock.putItem).toHaveBeenCalledWith(row)

        await deleteSituationAdjacencyLink(situationId, hostId, perspectiveKey)
        expect(ephemeraDBMock.deleteItem).toHaveBeenCalled()
    })
})
