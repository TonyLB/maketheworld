import internalCache from '../internalCache'
import StandardExample from '@tonylb/mtw-wml/ts/standardize/components/example'
import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardSituation from '@tonylb/mtw-wml/ts/standardize/components/situation'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import {
    computePerspectiveMatcherForRoomSituation,
    enrichExampleEvent,
    exampleToCacheShape,
    getOrderedAssetStack,
    roomHasFacetForSituation,
    situationHasMarks,
} from './exampleEnrichment'

jest.mock('../internalCache', () => ({
    __esModule: true,
    default: {
        AssetData: {
            get: jest.fn(),
        },
        ComponentData: {
            get: jest.fn(),
        },
    },
}))

describe('exampleEnrichment helpers', () => {
    const mockInternalCache = internalCache as unknown as {
        AssetData: { get: jest.Mock };
        ComponentData: { get: jest.Mock };
    }

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('should order asset stack by _from depth with event asset preferred last', () => {
        const exampleId = 'EXAMPLE#one' as const
        const eventAssetId = 'ASSET#child' as const

        const baseExample = new StandardExample({
            tag: 'Example',
            universalKey: exampleId,
        })
        const childExample = new StandardExample({
            tag: 'Example',
            universalKey: exampleId,
        })
        ;(childExample as any)._from = 'ASSET#base'

        const stack = getOrderedAssetStack(exampleId, eventAssetId, [
            { AssetId: 'ASSET#base', component: baseExample },
            { AssetId: 'ASSET#child', component: childExample },
        ])

        expect(stack).toEqual(['ASSET#base', 'ASSET#child'])
    })

    it('should extract markState and renderedContent from Example', () => {
        const example = new StandardExample(deIndentWML(`
            <Example key=(ex) uuid=(EXAMPLE#one)>
                <Description>Hello</Description>
                <Mark key=(m1) uuid=(MARK#one)>
                    <Match>match-value</Match>
                </Mark>
            </Example>
        `))

        const payload = exampleToCacheShape(example)

        expect(payload.markState.markValue).toEqual([
            { mark: 'MARK#one', value: 'match-value' },
        ])
        expect(payload.renderedContent.description).toEqual(['Hello'])
        expect(payload.provenance.type).toBe('authored')
    })

    it('should merge Example and find parentIds in enrichExampleEvent', async () => {
        const exampleId = 'EXAMPLE#one' as const
        const eventAssetId = 'ASSET#asset1' as const

        const exampleBase = new StandardExample(deIndentWML(`
            <Example key=(base) uuid=(EXAMPLE#one)>
                <Description>Hello</Description>
            </Example>
        `))

        const room = new StandardRoom({
            tag: 'Room',
            universalKey: 'ROOM#one',
            examples: [
                { universalKey: exampleId, key: 'exampleRef', tag: 'Example' } as any,
            ],
        } as any)

        const standardForm = new StandardForm([
            {
                tag: 'Asset',
                key: 'asset1',
                universalKey: eventAssetId,
            } as any,
            exampleBase.toJSON() as any,
            room.toJSON() as any,
        ])

        mockInternalCache.ComponentData.get.mockResolvedValue([
            {
                ComponentId: exampleId,
                byAssets: [
                    {
                        AssetId: eventAssetId,
                        component: exampleBase,
                    },
                ],
            },
        ])

        mockInternalCache.AssetData.get.mockResolvedValue([
            {
                AssetId: eventAssetId,
                standardForm,
            },
        ])

        const result = await enrichExampleEvent({
            exampleId,
            eventAssetId,
            component: exampleBase,
            eventType: 'Component Updated',
        })

        expect(result.exampleId).toBe(exampleId)
        expect(result.assetStack).toEqual([eventAssetId])
        expect(result.parentIds).toEqual(['ROOM#one'])
        expect(result.example).toBeDefined()
        expect(result.example?.renderedContent.description.length).toBeGreaterThan(0)
    })

    describe('perspective matcher (Phase 5.7)', () => {
        const situationId = 'SITUATION#s1' as const

        it('roomHasFacetForSituation returns true when room has facet for situation', () => {
            const room = {
                situations: {
                    items: [{ reference: { universalKey: situationId } }],
                },
            } as unknown as StandardRoom
            expect(roomHasFacetForSituation(room, situationId)).toBe(true)
        })

        it('roomHasFacetForSituation returns false when room has no facet for situation', () => {
            const room = {
                situations: {
                    items: [{ reference: { universalKey: 'SITUATION#other' } }],
                },
            } as unknown as StandardRoom
            expect(roomHasFacetForSituation(room, situationId)).toBe(false)
        })

        it('situationHasMarks returns true when situation has marks', () => {
            const situation = { marks: { length: 1 } } as unknown as StandardSituation
            expect(situationHasMarks(situation)).toBe(true)
        })

        it('situationHasMarks returns false when situation has no marks', () => {
            const situation = new StandardSituation({ tag: 'Situation', universalKey: 'SITUATION#s1' } as any)
            expect(situationHasMarks(situation)).toBe(false)
        })

        it('computePerspectiveMatcherForRoomSituation returns required and forbidden', () => {
            const roomWithFacet = {
                situations: { items: [{ reference: { universalKey: 'SITUATION#s1' } }] },
            } as unknown as StandardRoom
            const situationWithMarks = { marks: { length: 1 } } as unknown as StandardSituation
            const roomByAssets = [
                { AssetId: 'ASSET#a' as const, component: new StandardRoom({ tag: 'Room', universalKey: 'ROOM#one' } as any) },
                { AssetId: 'ASSET#b' as const, component: roomWithFacet },
            ]
            const situationByAssets = [
                { AssetId: 'ASSET#a' as const, component: new StandardSituation({ tag: 'Situation', universalKey: 'SITUATION#s1' } as any) },
                { AssetId: 'ASSET#b' as const, component: situationWithMarks },
            ]
            const matcher = computePerspectiveMatcherForRoomSituation({
                roomId: 'ROOM#one',
                situationId: 'SITUATION#s1',
                assetStack: ['ASSET#a', 'ASSET#b'],
                roomByAssets,
                situationByAssets,
            })
            expect(matcher.requiredAssetIds).toContain('ASSET#b')
            expect(matcher.requiredAssetIds).not.toContain('ASSET#a')
            expect(matcher.forbiddenAssetIds).toEqual([])
        })
    })
})

