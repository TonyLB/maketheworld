import { IMPROVISATION_ASSET_ID, type EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'
import { StandardCharacter } from '@tonylb/mtw-wml/ts/standardize/components/character'
import StandardSituation from '@tonylb/mtw-wml/ts/standardize/components/situation'
import { StandardLens } from '@tonylb/mtw-wml/ts/standardize/components/worldState'
import { Schema } from '@tonylb/mtw-wml/ts/schema'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'

function objectFromWML(wml: string): StandardObject {
    const schema = new Schema()
    schema.loadWML(deIndentWML(wml))
    return new StandardObject(schema.schema[0].children[0])
}
import type { AuthoritativeComponentData } from '../componentData/dynamoStandardComponents'
import { mergeAuthoritativeAcrossParticipationOrder } from '../aggregate/assemble'
import { aggregatePerspectiveExplicit } from '../aggregate/input'
import {
    createComponentAggregateCacheHandler,
    type ComponentAggregateMergedCache,
} from '../aggregate/factory'
import { inMemoryComponentAggregateInternalCacheSlice } from '../aggregate/testHarness'

import { assembleComponentExamplesAtPerspective } from './assemble'
import { situationFacetToCacheShape } from './enrichment'
import { authoredExampleSetSituationIds } from './result'

describe('assembleComponentExamplesAtPerspective', () => {
    const roomU = 'ROOM#r1' as const
    const assetA = 'ASSET#a1' as const
    const assetB = 'ASSET#b2' as const
    const situationBase = 'SITUATION#base' as const
    const situationOverride = 'SITUATION#override' as const
    const lensU = 'LENS#lens1' as EphemeraId

    const baseRoom = new StandardRoom(
        deIndentWML(`
        <Room key=(one) uuid=(ROOM#r1)>
            <Situation key=(base) uuid=(SITUATION#base) />
        </Room>
    `)
    )
    const overrideRoom = new StandardRoom(
        deIndentWML(`
        <Room key=(one) uuid=(ROOM#r1)>
            <Situation key=(override) uuid=(SITUATION#override) />
        </Room>
    `)
    )

    const baseSituation = new StandardSituation(
        deIndentWML(`<Situation key=(base) uuid=(SITUATION#base) />`)
    )
    const overrideSituation = new StandardSituation(
        deIndentWML(`<Situation key=(override) uuid=(SITUATION#override) />`)
    )

    function makeAggregate(
        authoritativeByUniversal: ReadonlyMap<EphemeraId, AuthoritativeComponentData>
    ): ComponentAggregateMergedCache {
        return createComponentAggregateCacheHandler(
            inMemoryComponentAggregateInternalCacheSlice({ authoritativeByUniversal })
        )
    }

    it('returns empty set when host has no situation facets after merge', async () => {
        const bareRoom = new StandardRoom(
            deIndentWML(`<Room key=(one) uuid=(ROOM#r1) />`)
        )
        const slice = inMemoryComponentAggregateInternalCacheSlice({
            authoritativeByUniversal: new Map([
                [roomU, { ComponentId: roomU, byAssets: [{ AssetId: assetA, component: bareRoom as unknown as StandardComponent }] }],
            ]),
        })
        const aggregate = createComponentAggregateCacheHandler(slice)
        const getSpy = jest.spyOn(aggregate, 'get')
        const set = await assembleComponentExamplesAtPerspective({
            input: { hostUniversalKey: roomU, mergeParticipationOrder: [assetA] },
            aggregate,
        })
        expect(set.size).toBe(0)
        expect(getSpy).toHaveBeenCalledTimes(1)
        expect(getSpy.mock.calls[0]?.[0]).toHaveLength(1)
        expect(getSpy.mock.calls[0]?.[0][0]?.universalKey).toBe(roomU)
        getSpy.mockRestore()
    })

    it('assembles one AuthoredExample per merged situation facet (two-layer room)', async () => {
        const byAssets = [
            { AssetId: assetA, component: baseRoom as unknown as StandardComponent },
            { AssetId: assetB, component: overrideRoom as unknown as StandardComponent },
        ]
        const authoritativeMap = new Map<EphemeraId, AuthoritativeComponentData>([
            [roomU, { ComponentId: roomU, byAssets }],
            [situationBase, { ComponentId: situationBase, byAssets: [{ AssetId: assetA, component: baseSituation as unknown as StandardComponent }] }],
            [situationOverride, { ComponentId: situationOverride, byAssets: [{ AssetId: assetB, component: overrideSituation as unknown as StandardComponent }] }],
        ])
        const aggregate = makeAggregate(authoritativeMap)
        const getSpy = jest.spyOn(aggregate, 'get')
        const set = await assembleComponentExamplesAtPerspective({
            input: { hostUniversalKey: roomU, mergeParticipationOrder: [assetA, assetB] },
            aggregate,
        })
        expect(authoredExampleSetSituationIds(set)).toEqual(
            expect.arrayContaining([situationBase, situationOverride])
        )
        expect(set.size).toBe(2)
        expect(getSpy).toHaveBeenCalledTimes(2)
        expect(getSpy.mock.calls[0]?.[0]).toHaveLength(1)
        expect(getSpy.mock.calls[0]?.[0][0]?.universalKey).toBe(roomU)
        const secondKeys = getSpy.mock.calls[1]?.[0].map((p) => p.universalKey) ?? []
        expect(secondKeys).not.toContain(roomU)
        expect(secondKeys).toEqual(expect.arrayContaining([situationBase, situationOverride]))
        getSpy.mockRestore()
    })

    it('applies lens mark defaults for ROOM# when resolveRoomLensMarkDefaults is true', async () => {
        const roomWithLens = new StandardRoom(
            deIndentWML(`
            <Room key=(one) uuid=(ROOM#r1)>
                <Lens key=(lens) uuid=(LENS#lens1) />
                <Situation key=(s1) uuid=(SITUATION#s1) />
            </Room>
        `)
        )
        const lens = new StandardLens(
            deIndentWML(`
            <Lens key=(lens) uuid=(LENS#lens1)>
                <Mark key=(illumination) uuid=(MARK#illumination)>
                    <Default>lighted</Default>
                </Mark>
            </Lens>
        `)
        )
        const situation = new StandardSituation(
            deIndentWML(`
            <Situation key=(s1) uuid=(SITUATION#s1)>
                <Mark key=(illumination) uuid=(MARK#illumination)>
                    <Match>dim</Match>
                </Mark>
            </Situation>
        `)
        )
        const situationId = 'SITUATION#s1' as const
        const authoritativeMap = new Map<EphemeraId, AuthoritativeComponentData>([
            [roomU, { ComponentId: roomU, byAssets: [{ AssetId: assetA, component: roomWithLens as unknown as StandardComponent }] }],
            [situationId, { ComponentId: situationId, byAssets: [{ AssetId: assetA, component: situation as unknown as StandardComponent }] }],
            [lensU, { ComponentId: lensU, byAssets: [{ AssetId: assetA, component: lens as unknown as StandardComponent }] }],
        ])
        const aggregate = makeAggregate(authoritativeMap)
        const set = await assembleComponentExamplesAtPerspective({
            input: { hostUniversalKey: roomU, mergeParticipationOrder: [assetA] },
            aggregate,
        })
        const example = set.get(situationId)
        expect(example?.markState.markValue).toEqual([
            { mark: 'MARK#illumination', value: 'dim' },
        ])
    })

    it('does not request lens perspective for Feature host', async () => {
        const featureU = 'FEATURE#f1' as const
        const situationId = 'SITUATION#s1' as const
        const feature = new StandardFeature(
            deIndentWML(`
            <Feature key=(feat) uuid=(FEATURE#f1)>
                <Situation key=(s1) uuid=(SITUATION#s1)><DisplayName>F prose</DisplayName></Situation>
            </Feature>
        `)
        )
        const situation = new StandardSituation(
            deIndentWML(`<Situation key=(s1) uuid=(SITUATION#s1) />`)
        )
        const authoritativeMap = new Map<EphemeraId, AuthoritativeComponentData>([
            [featureU, { ComponentId: featureU, byAssets: [{ AssetId: assetA, component: feature as unknown as StandardComponent }] }],
            [situationId, { ComponentId: situationId, byAssets: [{ AssetId: assetA, component: situation as unknown as StandardComponent }] }],
        ])
        const aggregate = makeAggregate(authoritativeMap)
        const getSpy = jest.spyOn(aggregate, 'get')
        await assembleComponentExamplesAtPerspective({
            input: {
                hostUniversalKey: featureU,
                mergeParticipationOrder: [assetA],
                options: { resolveRoomLensMarkDefaults: false },
            },
            aggregate,
        })
        const secondKeys = getSpy.mock.calls[1]?.[0].map((p) => p.universalKey) ?? []
        expect(secondKeys).not.toContain(lensU)
        expect(secondKeys).toEqual([situationId])
        getSpy.mockRestore()
    })

    it('does not request lens perspective for Object host', async () => {
        const objectU = 'OBJECT#o1' as const
        const situationId = 'SITUATION#s1' as const
        const object = objectFromWML(`
            <Asset uuid=(Test)>
                <Object key=(thing) uuid=(OBJECT#o1)>
                    <ShortName>roller skates</ShortName>
                    <Situation key=(s1) uuid=(SITUATION#s1)><DisplayName>O prose</DisplayName></Situation>
                </Object>
            </Asset>
        `)
        const situation = new StandardSituation(
            deIndentWML(`<Situation key=(s1) uuid=(SITUATION#s1) />`)
        )
        const authoritativeMap = new Map<EphemeraId, AuthoritativeComponentData>([
            [objectU, { ComponentId: objectU, byAssets: [{ AssetId: assetA, component: object as unknown as StandardComponent }] }],
            [situationId, { ComponentId: situationId, byAssets: [{ AssetId: assetA, component: situation as unknown as StandardComponent }] }],
        ])
        const aggregate = makeAggregate(authoritativeMap)
        const getSpy = jest.spyOn(aggregate, 'get')
        const set = await assembleComponentExamplesAtPerspective({
            input: {
                hostUniversalKey: objectU,
                mergeParticipationOrder: [assetA],
                options: { resolveRoomLensMarkDefaults: false },
            },
            aggregate,
        })
        expect(authoredExampleSetSituationIds(set)).toEqual([situationId])
        const secondKeys = getSpy.mock.calls[1]?.[0].map((p) => p.universalKey) ?? []
        expect(secondKeys).not.toContain(lensU)
        expect(secondKeys).toEqual([situationId])
        getSpy.mockRestore()
    })

    it('does not request lens perspective for Character host', async () => {
        const characterU = 'CHARACTER#c1' as const
        const situationId = 'SITUATION#s1' as const
        const character = new StandardCharacter(
            deIndentWML(`
            <Character key=(char) uuid=(CHARACTER#c1)>
                <Situation key=(s1) uuid=(SITUATION#s1)><DisplayName>C prose</DisplayName></Situation>
            </Character>
        `)
        )
        const situation = new StandardSituation(
            deIndentWML(`<Situation key=(s1) uuid=(SITUATION#s1) />`)
        )
        const authoritativeMap = new Map<EphemeraId, AuthoritativeComponentData>([
            [characterU, { ComponentId: characterU, byAssets: [{ AssetId: assetA, component: character as unknown as StandardComponent }] }],
            [situationId, { ComponentId: situationId, byAssets: [{ AssetId: assetA, component: situation as unknown as StandardComponent }] }],
        ])
        const aggregate = makeAggregate(authoritativeMap)
        const getSpy = jest.spyOn(aggregate, 'get')
        const set = await assembleComponentExamplesAtPerspective({
            input: {
                hostUniversalKey: characterU,
                mergeParticipationOrder: [assetA],
                options: { resolveRoomLensMarkDefaults: false },
            },
            aggregate,
        })
        expect(authoredExampleSetSituationIds(set)).toEqual([situationId])
        const secondKeys = getSpy.mock.calls[1]?.[0].map((p) => p.universalKey) ?? []
        expect(secondKeys).not.toContain(lensU)
        expect(secondKeys).toEqual([situationId])
        getSpy.mockRestore()
    })

    it('assembles a situation facet for an Object host across ASSET#IMPROVISATION merge participation', async () => {
        const objectU = 'OBJECT#o2' as const
        const situationId = 'SITUATION#s2' as const
        const object = objectFromWML(`
            <Asset uuid=(Test)>
                <Object key=(thing) uuid=(OBJECT#o2)>
                    <ShortName>lantern</ShortName>
                    <Situation key=(s2) uuid=(SITUATION#s2)><DisplayName>Improvised prose</DisplayName></Situation>
                </Object>
            </Asset>
        `)
        const situation = new StandardSituation(
            deIndentWML(`<Situation key=(s2) uuid=(SITUATION#s2) />`)
        )
        const authoritativeMap = new Map<EphemeraId, AuthoritativeComponentData>([
            [objectU, { ComponentId: objectU, byAssets: [{ AssetId: IMPROVISATION_ASSET_ID, component: object as unknown as StandardComponent }] }],
            [situationId, { ComponentId: situationId, byAssets: [{ AssetId: IMPROVISATION_ASSET_ID, component: situation as unknown as StandardComponent }] }],
        ])
        const aggregate = makeAggregate(authoritativeMap)
        const set = await assembleComponentExamplesAtPerspective({
            input: { hostUniversalKey: objectU, mergeParticipationOrder: [IMPROVISATION_ASSET_ID] },
            aggregate,
        })
        expect(authoredExampleSetSituationIds(set)).toEqual([situationId])
        expect(set.get(situationId)?.renderedContent).toBeDefined()
    })
})

describe('assemble parity (explicit mergeParticipationOrder)', () => {
    const roomU = 'ROOM#r1' as const
    const assetA = 'ASSET#a1' as const
    const assetB = 'ASSET#b2' as const
    const situationBase = 'SITUATION#base' as const
    const situationOverride = 'SITUATION#override' as const

    it('matches situationFacetToCacheShape for each merged facet', async () => {
        const baseRoom = new StandardRoom(
            deIndentWML(`
            <Room key=(one) uuid=(ROOM#r1)>
                <Situation key=(base) uuid=(SITUATION#base) />
            </Room>
        `)
        )
        const overrideRoom = new StandardRoom(
            deIndentWML(`
            <Room key=(one) uuid=(ROOM#r1)>
                <Situation key=(override) uuid=(SITUATION#override) />
            </Room>
        `)
        )
        const baseSituation = new StandardSituation(
            deIndentWML(`<Situation key=(base) uuid=(SITUATION#base) />`)
        )
        const overrideSituation = new StandardSituation(
            deIndentWML(`<Situation key=(override) uuid=(SITUATION#override) />`)
        )

        const mergeOrder = [assetA, assetB] as const
        const roomByAssets = [
            { AssetId: assetA, component: baseRoom as unknown as StandardComponent },
            { AssetId: assetB, component: overrideRoom as unknown as StandardComponent },
        ]
        const hostPerspective = aggregatePerspectiveExplicit({
            universalKey: roomU,
            mergeParticipationOrder: mergeOrder,
        })
        const mergedHost = mergeAuthoritativeAcrossParticipationOrder(hostPerspective, {
            ComponentId: roomU,
            byAssets: roomByAssets,
        }) as StandardRoom

        const authoritativeMap = new Map<EphemeraId, AuthoritativeComponentData>([
            [roomU, { ComponentId: roomU, byAssets: roomByAssets }],
            [situationBase, { ComponentId: situationBase, byAssets: [{ AssetId: assetA, component: baseSituation as unknown as StandardComponent }] }],
            [situationOverride, {
                ComponentId: situationOverride,
                byAssets: [{ AssetId: assetB, component: overrideSituation as unknown as StandardComponent }],
            }],
        ])
        const aggregate = createComponentAggregateCacheHandler(
            inMemoryComponentAggregateInternalCacheSlice({ authoritativeByUniversal: authoritativeMap })
        )
        const set = await assembleComponentExamplesAtPerspective({
            input: { hostUniversalKey: roomU, mergeParticipationOrder: mergeOrder },
            aggregate,
        })

        for (const facet of mergedHost.situations.items) {
            const situationId = facet.reference.universalKey as typeof situationBase
            const situationPerspective = aggregatePerspectiveExplicit({
                universalKey: situationId,
                mergeParticipationOrder: mergeOrder,
            })
            const authoritative = authoritativeMap.get(situationId)!
            const mergedSituation = mergeAuthoritativeAcrossParticipationOrder(
                situationPerspective,
                authoritative
            ) as StandardSituation
            const expected = situationFacetToCacheShape(mergedSituation, facet.payload)
            const actual = set.get(situationId)
            expect(actual?.markState).toEqual(expected.markState)
            expect(actual?.renderedContent).toEqual(expected.renderedContent)
            expect(actual?.provenance).toEqual(expected.provenance)
        }
    })
})
