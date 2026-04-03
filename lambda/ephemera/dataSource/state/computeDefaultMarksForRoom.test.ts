import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { InternalCache } from '../../internalCache'
import { computeDefaultMarksForRoom } from './computeDefaultMarksForRoom'
import { resolveCanonAssetStackForRoom } from './resolveAssetStackForRoom'

jest.mock('./resolveAssetStackForRoom', () => ({
    resolveCanonAssetStackForRoom: jest.fn(),
}))

jest.mock('./mergeComponentsAcrossStack', () => {
    return {
        mergeRoomAcrossStack: (byAssets: { component: { tag?: string } }[]) => {
            const hasRoom = byAssets.some(({ component }) => component.tag === 'Room')
            return hasRoom ? ({ tag: 'Room' } as any) : undefined
        },
        mergeLensAcrossStack: (byAssets: { component: { tag?: string } }[]) => {
            const hasLens = byAssets.some(({ component }) => component.tag === 'Lens')
            return hasLens ? ({ tag: 'Lens' } as any) : undefined
        },
    }
})

jest.mock('@tonylb/mtw-wml/ts/standardize/worldState/lensMarks', () => {
    return {
        getLensMarksWithDefaults: () => [
            {
                markId: 'MARK#mood',
                default: 'calm',
            },
        ],
    }
})

const resolveCanonAssetStackForRoomMock = resolveCanonAssetStackForRoom as jest.MockedFunction<
    typeof resolveCanonAssetStackForRoom
>

describe('computeDefaultMarksForRoom', () => {
    const roomId = 'ROOM#TEST' as EphemeraRoomId
    const assetStack: AssetUUID[] = ['ASSET#Base' as AssetUUID, 'ASSET#Overlay' as AssetUUID]

    const makeMockInternalCache = (overrides: Partial<InternalCache> = {}): InternalCache => {
        const base: any = {
            ComponentAssetMeta: {
                getAcrossAssets: jest.fn()
            }
        }
        return Object.assign(base, overrides) as InternalCache
    }

    beforeEach(() => {
        resolveCanonAssetStackForRoomMock.mockReset()
    })

    it('returns empty markState when resolveCanonAssetStackForRoom returns no ids', async () => {
        resolveCanonAssetStackForRoomMock.mockResolvedValue([])
        const mockCache = makeMockInternalCache()

        const result = await computeDefaultMarksForRoom({
            roomId,
            internalCacheOverride: mockCache
        })

        expect(result).toEqual({ markValue: [] })
        expect(resolveCanonAssetStackForRoomMock).toHaveBeenCalledWith(roomId, mockCache)
        expect(mockCache.ComponentAssetMeta.getAcrossAssets).not.toHaveBeenCalled()
    })

    it('returns empty markState when room cannot be resolved in stack', async () => {
        resolveCanonAssetStackForRoomMock.mockResolvedValue(assetStack)
        const mockCache = makeMockInternalCache()
        ;(mockCache.ComponentAssetMeta.getAcrossAssets as jest.Mock).mockResolvedValue({})

        const result = await computeDefaultMarksForRoom({
            roomId,
            internalCacheOverride: mockCache
        })

        expect(result).toEqual({ markValue: [] })
        expect(mockCache.ComponentAssetMeta.getAcrossAssets).toHaveBeenCalledWith(
            roomId,
            assetStack
        )
    })

    it('returns empty markState when no Lens is present', async () => {
        resolveCanonAssetStackForRoomMock.mockResolvedValue(['ASSET#Base' as AssetUUID])
        const mockCache = makeMockInternalCache()
        const standardRoomInstance = {
            tag: 'Room'
        } as any

        ;(mockCache.ComponentAssetMeta.getAcrossAssets as jest.Mock).mockResolvedValue({
            ['ASSET#Base' as AssetUUID]: standardRoomInstance
        })

        const result = await computeDefaultMarksForRoom({
            roomId,
            internalCacheOverride: mockCache
        })

        expect(result).toEqual({ markValue: [] })
    })

    it('computes markState from a Lens with defaults', async () => {
        resolveCanonAssetStackForRoomMock.mockResolvedValue(assetStack)
        const mockCache = makeMockInternalCache()
        const standardRoomInstance = {
            tag: 'Room'
        } as any

        const standardLensInstance = {
            tag: 'Lens',
            marks: {
                items: [
                    {
                        reference: { universalKey: 'MARK#mood' },
                        payload: {
                            default: {
                                toJSON: () => ({ tag: 'Literal', value: 'calm' })
                            }
                        }
                    }
                ]
            }
        } as any

        ;(mockCache.ComponentAssetMeta.getAcrossAssets as jest.Mock).mockResolvedValue({
            ['ASSET#Base' as AssetUUID]: standardRoomInstance,
            ['ASSET#Overlay' as AssetUUID]: standardLensInstance
        })

        const result = await computeDefaultMarksForRoom({
            roomId,
            internalCacheOverride: mockCache
        })

        expect(result.markValue).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    mark: 'MARK#mood',
                    value: 'calm'
                })
            ])
        )
    })
})
