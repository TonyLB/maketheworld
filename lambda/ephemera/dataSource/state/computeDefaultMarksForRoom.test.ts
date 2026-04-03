import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { InternalCache } from '../../internalCache'
import { computeDefaultMarksForRoom, PerspectiveSpec } from './computeDefaultMarksForRoom'

jest.mock('./mergeComponentsAcrossStack', () => {
    return {
        //
        // For these tests, we only need minimal behavior:
        // - A "room" exists whenever any component has tag === 'Room'
        // - A "lens" exists whenever any component has tag === 'Lens'
        //
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

describe('computeDefaultMarksForRoom', () => {
    const roomId = 'ROOM#TEST' as EphemeraRoomId
    const assetStack: AssetUUID[] = ['ASSET#Base' as AssetUUID, 'ASSET#Overlay' as AssetUUID]

    const makeMockInternalCache = (overrides: Partial<InternalCache> = {}): InternalCache => {
        const base: any = {
            ComponentMeta: {
                getAcrossAssets: jest.fn()
            }
        }
        return Object.assign(base, overrides) as InternalCache
    }

    it('returns empty markState when assetStack is empty', async () => {
        const mockCache = makeMockInternalCache()
        const perspective: PerspectiveSpec = { assetStack: [] }

        const result = await computeDefaultMarksForRoom({
            roomId,
            perspective,
            internalCacheOverride: mockCache
        })

        expect(result).toEqual({ markValue: [] })
        expect(mockCache.ComponentMeta.getAcrossAssets).not.toHaveBeenCalled()
    })

    it('returns empty markState when room cannot be resolved in perspective', async () => {
        const mockCache = makeMockInternalCache()
        const perspective: PerspectiveSpec = { assetStack }

        ;(mockCache.ComponentMeta.getAcrossAssets as jest.Mock).mockResolvedValue({})

        const result = await computeDefaultMarksForRoom({
            roomId,
            perspective,
            internalCacheOverride: mockCache
        })

        expect(result).toEqual({ markValue: [] })
        expect(mockCache.ComponentMeta.getAcrossAssets).toHaveBeenCalledWith(
            roomId,
            assetStack
        )
    })

    it('returns empty markState when no Lens is present', async () => {
        const mockCache = makeMockInternalCache()
        const perspective: PerspectiveSpec = { assetStack: ['ASSET#Base' as AssetUUID] }

        const standardRoomInstance = {
            tag: 'Room'
        } as any

        ;(mockCache.ComponentMeta.getAcrossAssets as jest.Mock).mockResolvedValue({
            ['ASSET#Base' as AssetUUID]: standardRoomInstance
        })

        const result = await computeDefaultMarksForRoom({
            roomId,
            perspective,
            internalCacheOverride: mockCache
        })

        expect(result).toEqual({ markValue: [] })
    })

    it('computes markState from a Lens with defaults', async () => {
        const mockCache = makeMockInternalCache()
        const perspective: PerspectiveSpec = { assetStack }

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

        ;(mockCache.ComponentMeta.getAcrossAssets as jest.Mock).mockResolvedValue({
            ['ASSET#Base' as AssetUUID]: standardRoomInstance,
            ['ASSET#Overlay' as AssetUUID]: standardLensInstance
        })

        const result = await computeDefaultMarksForRoom({
            roomId,
            perspective,
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

