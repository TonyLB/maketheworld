import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import type { EphemeraCacheDynamoItem, EphemeraCacheRenderedContent } from '../renderCache/baseClasses'
import { roomRenderChannelWmlForRoomId, roomRenderWmlFromCacheRecord } from './roomRenderWmlFromCacheRecord'

describe('roomRenderWmlFromCacheRecord', () => {
    const roomId = 'ROOM#audit' as const

    it('includes Render-backed prose and no Character siblings or exit facets', () => {
        const renderedContent: EphemeraCacheRenderedContent = {
            displayName: ['Parlor'],
            summary: ['A quiet space.'],
            description: ['Full prose here.'],
        }
        const wml = roomRenderWmlFromCacheRecord(roomId, renderedContent)
        const parsed = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const room = parsed.byUniversalId[roomId]
        expect(room).toBeInstanceOf(StandardRoom)
        expect((room as StandardRoom).render).toBeDefined()
        const keys = Object.keys(parsed.byUniversalId)
        expect(keys.filter((k) => k.startsWith('CHARACTER#'))).toHaveLength(0)
        expect(wml).not.toMatch(/<Exit\b/i)
    })

    it('produces minimal room when renderedContent maps to empty facet', () => {
        const renderedContent: EphemeraCacheRenderedContent = {
            description: [],
        }
        const wml = roomRenderWmlFromCacheRecord(roomId, renderedContent)
        const parsed = new StandardForm(wml, { standardizeMode: 'ephemeraWire' })
        const room = parsed.byUniversalId[roomId]
        expect(room).toBeInstanceOf(StandardRoom)
        expect((room as StandardRoom).render).toBeUndefined()
    })
})

describe('roomRenderChannelWmlForRoomId', () => {
    const roomId = 'ROOM#cachePick' as const

    it('uses first cache row renderedContent', () => {
        const rows: EphemeraCacheDynamoItem[] = [
            {
                EphemeraId: roomId,
                DataCategory: 'CACHE#aa',
                markState: { markValue: [] },
                renderedContent: { displayName: ['Hall'], description: [] },
                provenance: { type: 'authored' },
                perspectiveId: 'p0',
                perspectiveMatcher: { assetStack: [] } as any,
            },
        ]
        const wml = roomRenderChannelWmlForRoomId(roomId, rows)
        expect(wml).toMatch(/Hall/)
    })

    it('matches empty-list behavior when there are no cache rows', () => {
        const wmlEmpty = roomRenderChannelWmlForRoomId(roomId, [])
        const wmlDirect = roomRenderWmlFromCacheRecord(roomId, { description: [] })
        expect(wmlEmpty).toEqual(wmlDirect)
    })
})
