import internalCache from '../internalCache'
import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import StandardKnowledge from '@tonylb/mtw-wml/ts/standardize/components/knowledge'
import StandardSituation from '@tonylb/mtw-wml/ts/standardize/components/situation'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import { StandardLens } from '@tonylb/mtw-wml/ts/standardize/components/worldState'
import {
    computePerspectiveMatcherForParentSituation,
    computePerspectiveMatcherForRoomSituation,
    getOrderedAssetStack,
    getParentIdsForSituation,
    mergeLensAcrossStack,
    mergeRoomAcrossStack,
    parentHasFacetForSituation,
    situationFacetToCacheShape,
    situationHasMarks,
} from './exampleEnrichment'
import { getLensMarksWithDefaults } from '@tonylb/mtw-wml/ts/standardize/worldState/lensMarks'

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
        const situationId = 'SITUATION#one' as const
        const eventAssetId = 'ASSET#child' as const

        const baseSituation = new StandardSituation({
            tag: 'Situation',
            universalKey: situationId,
        })
        const childSituation = new StandardSituation({
            tag: 'Situation',
            universalKey: situationId,
        })
        ;(childSituation as any)._from = 'ASSET#base'

        const stack = getOrderedAssetStack(situationId, eventAssetId, [
            { AssetId: 'ASSET#base', component: baseSituation },
            { AssetId: 'ASSET#child', component: childSituation },
        ])

        expect(stack).toEqual(['ASSET#base', 'ASSET#child'])
    })

    describe('getParentIdsForSituation', () => {
        it('should return Feature and Knowledge parents referencing the Situation via facets', async () => {
            const situationId = 'SITUATION#DEFAULT' as const
            const eventAssetId = 'ASSET#asset1' as const

            const feature = new StandardFeature(deIndentWML(`
                <Feature key=(feat) uuid=(FEATURE#one)>
                    <Situation uuid=(DEFAULT)><DisplayName>Feature prose</DisplayName></Situation>
                </Feature>
            `))
            const knowledge = new StandardKnowledge(deIndentWML(`
                <Knowledge key=(know) uuid=(KNOWLEDGE#one)>
                    <Situation uuid=(DEFAULT)><DisplayName>Knowledge prose</DisplayName></Situation>
                </Knowledge>
            `))

            const standardForm = new StandardForm([
                {
                    tag: 'Asset',
                    key: 'asset1',
                    universalKey: eventAssetId,
                } as any,
                feature.toJSON() as any,
                knowledge.toJSON() as any,
            ])

            mockInternalCache.AssetData.get.mockResolvedValue([
                {
                    AssetId: eventAssetId,
                    standardForm,
                },
            ])

            const parentIds = await getParentIdsForSituation(
                situationId,
                [eventAssetId],
                eventAssetId
            )

            expect(parentIds).toEqual(
                expect.arrayContaining(['FEATURE#one', 'KNOWLEDGE#one'])
            )
            expect(parentIds).toHaveLength(2)
        })

        it('should return Room parent when Room facet references the Situation', async () => {
            const situationId = 'SITUATION#DEFAULT' as const
            const eventAssetId = 'ASSET#asset1' as const

            const room = new StandardRoom(deIndentWML(`
                <Room key=(one) uuid=(ROOM#one)>
                    <Situation uuid=(DEFAULT)><DisplayName>Room prose</DisplayName></Situation>
                </Room>
            `))

            const standardForm = new StandardForm([
                {
                    tag: 'Asset',
                    key: 'asset1',
                    universalKey: eventAssetId,
                } as any,
                room.toJSON() as any,
            ])

            mockInternalCache.AssetData.get.mockResolvedValue([
                {
                    AssetId: eventAssetId,
                    standardForm,
                },
            ])

            const parentIds = await getParentIdsForSituation(
                situationId,
                [eventAssetId],
                eventAssetId
            )

            expect(parentIds).toEqual(['ROOM#one'])
        })

        it('should return empty for EXAMPLE# ids', async () => {
            const parentIds = await getParentIdsForSituation(
                'EXAMPLE#one',
                ['ASSET#asset1'],
                'ASSET#asset1'
            )

            expect(parentIds).toEqual([])
            expect(mockInternalCache.AssetData.get).not.toHaveBeenCalled()
        })
    })

    it('mergeRoomAcrossStack should merge rooms in assetStack order', () => {
        const roomId = 'ROOM#one' as const
        const baseRoom = new StandardRoom(deIndentWML(`
            <Room key=(one) uuid=(ROOM#one)>
                <Situation key=(base) uuid=(SITUATION#base) />
            </Room>
        `))
        const overrideRoom = new StandardRoom(deIndentWML(`
            <Room key=(one) uuid=(ROOM#one)>
                <Situation key=(override) uuid=(SITUATION#override) />
            </Room>
        `))

        const assetStack = ['ASSET#base', 'ASSET#override'] as (`ASSET#${string}`)[]
        const byAssets = [
            { AssetId: 'ASSET#base' as const, component: baseRoom as any },
            { AssetId: 'ASSET#override' as const, component: overrideRoom as any },
        ]

        const merged = mergeRoomAcrossStack(byAssets, assetStack)
        expect(merged).toBeDefined()
        const situationIds = merged?.situations.items.map(
            (f: any) => f.reference.universalKey
        )
        expect(situationIds).toEqual(
            expect.arrayContaining(['SITUATION#base', 'SITUATION#override'])
        )
    })

    it('mergeLensAcrossStack and getLensMarksWithDefaults should honor last-write defaults', () => {
        const baseLens = new StandardLens(deIndentWML(`
            <Lens key=(illumination) uuid=(LENS#one)>
                <Mark key=(illumination) uuid=(MARK#illumination)>
                    <Default>light</Default>
                </Mark>
            </Lens>
        `))
        const overrideLens = new StandardLens(deIndentWML(`
            <Lens key=(illumination) uuid=(LENS#one)>
                <Mark key=(illumination) uuid=(MARK#illumination)>
                    <Default>dark</Default>
                </Mark>
            </Lens>
        `))

        const assetStack = ['ASSET#base' as const, 'ASSET#override' as const]
        const byAssets = [
            { AssetId: 'ASSET#base' as const, component: baseLens as any },
            { AssetId: 'ASSET#override' as const, component: overrideLens as any },
        ]

        const merged = mergeLensAcrossStack(byAssets, assetStack)
        expect(merged).toBeDefined()
        const marks = getLensMarksWithDefaults(merged as StandardLens)
        expect(marks).toHaveLength(1)
        expect(marks[0]).toEqual(
            expect.objectContaining({
                markId: 'MARK#illumination',
                default: 'dark',
            })
        )
    })

    describe('situationFacetToCacheShape with lens marks', () => {
        it('should scope to lens marks and apply defaults', () => {
            const lens = new StandardLens(deIndentWML(`
                <Lens key=(illumination) uuid=(LENS#lens1)>
                    <Mark key=(illumination) uuid=(MARK#illumination)>
                        <Default>lighted</Default>
                    </Mark>
                    <Mark key=(timeofday) uuid=(MARK#timeofday)>
                        <Default>Afternoon</Default>
                    </Mark>
                </Lens>
            `))
            const lensMarks = getLensMarksWithDefaults(lens)

            const situation = new StandardSituation(deIndentWML(`
                <Situation key=(s1) uuid=(SITUATION#s1)>
                    <Mark key=(illumination) uuid=(MARK#illumination)>
                        <Match>dim</Match>
                    </Mark>
                    <Mark key=(extraneous) uuid=(MARK#other)>
                        <Match>ignored</Match>
                    </Mark>
                </Situation>
            `))

            const payload = situationFacetToCacheShape(situation, {} as any, {
                lensMarks,
            })

            expect(payload.markState.markValue).toEqual([
                { mark: 'MARK#illumination', value: 'dim' },
                { mark: 'MARK#timeofday', value: 'Afternoon' },
            ])
        })

        it('should emit no marks when lensMarks is empty even if situation has marks', () => {
            const situation = new StandardSituation(deIndentWML(`
                <Situation key=(s1) uuid=(SITUATION#s1)>
                    <Mark key=(illumination) uuid=(MARK#illumination)>
                        <Match>dim</Match>
                    </Mark>
                </Situation>
            `))

            const payload = situationFacetToCacheShape(situation, {} as any, {
                lensMarks: [],
            })

            expect(payload.markState.markValue).toEqual([])
        })

        it('should preserve existing behavior when lensMarks is undefined', () => {
            const situation = new StandardSituation(deIndentWML(`
                <Situation key=(s1) uuid=(SITUATION#s1)>
                    <Mark key=(illumination) uuid=(MARK#illumination)>
                        <Match>dim</Match>
                    </Mark>
                </Situation>
            `))

            const payload = situationFacetToCacheShape(situation, {} as any)

            expect(payload.markState.markValue).toEqual([
                { mark: 'MARK#illumination', value: 'dim' },
            ])
        })
    })

    describe('perspective matcher (Phase 5.7)', () => {
        const situationId = 'SITUATION#s1' as const

        it('parentHasFacetForSituation returns true when room has facet for situation', () => {
            const room = {
                situations: {
                    items: [{ reference: { universalKey: situationId } }],
                },
            } as unknown as StandardRoom
            expect(parentHasFacetForSituation(room, situationId)).toBe(true)
        })

        it('parentHasFacetForSituation returns false when room has no facet for situation', () => {
            const room = {
                situations: {
                    items: [{ reference: { universalKey: 'SITUATION#other' } }],
                },
            } as unknown as StandardRoom
            expect(parentHasFacetForSituation(room, situationId)).toBe(false)
        })

        it('situationHasMarks returns true when situation has marks', () => {
            const situation = { marks: { length: 1 } } as unknown as StandardSituation
            expect(situationHasMarks(situation)).toBe(true)
        })

        it('situationHasMarks returns false when situation has no marks', () => {
            const situation = new StandardSituation({ tag: 'Situation', universalKey: 'SITUATION#s1' } as any)
            expect(situationHasMarks(situation)).toBe(false)
        })

        it('computePerspectiveMatcherForParentSituation returns required and forbidden for Feature parent', () => {
            const featureWithFacet = {
                situations: { items: [{ reference: { universalKey: 'SITUATION#s1' } }] },
            } as unknown as StandardFeature
            const situationWithMarks = { marks: { length: 1 } } as unknown as StandardSituation
            const parentByAssets = [
                { AssetId: 'ASSET#a' as const, component: new StandardFeature({ tag: 'Feature', universalKey: 'FEATURE#one' } as any) },
                { AssetId: 'ASSET#b' as const, component: featureWithFacet },
            ]
            const situationByAssets = [
                { AssetId: 'ASSET#a' as const, component: new StandardSituation({ tag: 'Situation', universalKey: 'SITUATION#s1' } as any) },
                { AssetId: 'ASSET#b' as const, component: situationWithMarks },
            ]
            const matcher = computePerspectiveMatcherForParentSituation({
                parentId: 'FEATURE#one',
                situationId: 'SITUATION#s1',
                assetStack: ['ASSET#a', 'ASSET#b'],
                parentByAssets,
                situationByAssets,
            })
            expect(matcher.requiredAssetIds).toContain('ASSET#b')
            expect(matcher.requiredAssetIds).not.toContain('ASSET#a')
            expect(matcher.forbiddenAssetIds).toEqual([])
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

