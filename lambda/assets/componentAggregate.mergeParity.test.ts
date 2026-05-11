/**
 * Parity between aggregate gateway merge and legacy `merge*AcrossStack` in `exampleEnrichment.ts`.
 * `aggregatePerspectiveExplicit` accepts only Ephemera universal keys; `LENS#` is not in that set,
 * so `mergeLensAcrossStack` is not duplicated here (same fold semantics as Room/Example).
 */
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import StandardExample from '@tonylb/mtw-wml/ts/standardize/components/example'
import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'

import {
    aggregatePerspectiveExplicit,
    createComponentAggregateGateway,
    mergeAuthoritativeAcrossParticipationOrder,
} from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import { inMemoryComponentAggregateInternalCacheSlice } from '@tonylb/mtw-gateways/ts/assets/components/aggregate/testHarness'

import { mergeExampleAcrossStack, mergeRoomAcrossStack } from './componentExamples/exampleEnrichment'

describe('component aggregate merge parity (gateway vs merge*AcrossStack)', () => {
    describe('mergeRoomAcrossStack', () => {
        const roomU = 'ROOM#rParity1' as const
        const assetBase = 'ASSET#aaParity1' as const
        const assetOverlay = 'ASSET#bbParity2' as const

        const baseRoom = new StandardRoom(
            deIndentWML(`
            <Room key=(one) uuid=(ROOM#rParity1)>
                <Situation key=(base) uuid=(SITUATION#sParityBase) />
            </Room>
        `)
        )
        const overlayRoom = new StandardRoom(
            deIndentWML(`
            <Room key=(one) uuid=(ROOM#rParity1)>
                <Situation key=(overlay) uuid=(SITUATION#sParityOver) />
            </Room>
        `)
        )

        it('matches mergeAuthoritativeAcrossParticipationOrder for two layers', () => {
            const assetStack = [assetBase, assetOverlay]
            const byAssets = [
                { AssetId: assetBase, component: baseRoom as unknown as StandardComponent },
                { AssetId: assetOverlay, component: overlayRoom as unknown as StandardComponent },
            ]
            const legacy = mergeRoomAcrossStack(byAssets, assetStack)
            expect(legacy).toBeDefined()

            const authoritative = {
                ComponentId: roomU,
                byAssets,
            }
            const perspective = aggregatePerspectiveExplicit({
                universalKey: roomU,
                mergeParticipationOrder: assetStack,
            })
            const gatewayMerged = mergeAuthoritativeAcrossParticipationOrder(perspective, authoritative)

            expect(schemaToWML([legacy!.schema])).toEqual(schemaToWML([(gatewayMerged as StandardRoom).schema]))
        })

        it('matches mergeAuthoritativeAcrossParticipationOrder for three layers', () => {
            const assetMid = 'ASSET#ccParity3' as const
            const midRoom = new StandardRoom(
                deIndentWML(`
                <Room key=(one) uuid=(ROOM#rParity1)>
                    <Situation key=(mid) uuid=(SITUATION#sParityMid) />
                </Room>
            `)
            )
            const assetStack = [assetBase, assetMid, assetOverlay]
            const byAssets = [
                { AssetId: assetBase, component: baseRoom as unknown as StandardComponent },
                { AssetId: assetMid, component: midRoom as unknown as StandardComponent },
                { AssetId: assetOverlay, component: overlayRoom as unknown as StandardComponent },
            ]
            const legacy = mergeRoomAcrossStack(byAssets, assetStack)
            expect(legacy).toBeDefined()

            const authoritative = {
                ComponentId: roomU,
                byAssets,
            }
            const perspective = aggregatePerspectiveExplicit({
                universalKey: roomU,
                mergeParticipationOrder: assetStack,
            })
            const gatewayMerged = mergeAuthoritativeAcrossParticipationOrder(perspective, authoritative)

            expect(schemaToWML([legacy!.schema])).toEqual(schemaToWML([(gatewayMerged as StandardRoom).schema]))
        })
    })

    describe('mergeExampleAcrossStack', () => {
        const exampleU = 'EXAMPLE#exParity1' as const
        const assetBase = 'ASSET#ddParity4' as const
        const assetOverlay = 'ASSET#eeParity5' as const

        const baseExample = new StandardExample(
            deIndentWML(`
            <Example key=(ex) uuid=(EXAMPLE#exParity1)>
                <Description>Base prose</Description>
            </Example>
        `)
        )
        const overlayExample = new StandardExample(
            deIndentWML(`
            <Example key=(ex) uuid=(EXAMPLE#exParity1)>
                <Description>Overlay prose</Description>
            </Example>
        `)
        )

        it('matches mergeAuthoritativeAcrossParticipationOrder', () => {
            const assetStack = [assetBase, assetOverlay]
            const byAssets = [
                { AssetId: assetBase, component: baseExample as unknown as StandardComponent },
                { AssetId: assetOverlay, component: overlayExample as unknown as StandardComponent },
            ]
            const legacy = mergeExampleAcrossStack(byAssets, assetStack)
            expect(legacy).toBeDefined()

            const authoritative = {
                ComponentId: exampleU,
                byAssets,
            }
            const perspective = aggregatePerspectiveExplicit({
                universalKey: exampleU,
                mergeParticipationOrder: assetStack,
            })
            const gatewayMerged = mergeAuthoritativeAcrossParticipationOrder(perspective, authoritative)

            expect(schemaToWML([legacy!.schema])).toEqual(
                schemaToWML([(gatewayMerged as StandardExample).schema])
            )
        })
    })

    describe('assembleMergedComponent wiring', () => {
        const roomU = 'ROOM#rParity2' as const
        const assetBase = 'ASSET#ffParity6' as const
        const assetOverlay = 'ASSET#ggParity7' as const

        const baseRoom = new StandardRoom(
            deIndentWML(`
            <Room key=(one) uuid=(ROOM#rParity2)>
                <Situation key=(base) uuid=(SITUATION#sWireBase) />
            </Room>
        `)
        )
        const overlayRoom = new StandardRoom(
            deIndentWML(`
            <Room key=(one) uuid=(ROOM#rParity2)>
                <Situation key=(overlay) uuid=(SITUATION#sWireOver) />
            </Room>
        `)
        )

        it('matches mergeAuthoritativeAcrossParticipationOrder for the same InternalCache-shaped slice', async () => {
            const assetStack = [assetBase, assetOverlay]
            const byAssets = [
                { AssetId: assetBase, component: baseRoom as unknown as StandardComponent },
                { AssetId: assetOverlay, component: overlayRoom as unknown as StandardComponent },
            ]
            const authoritative = {
                ComponentId: roomU,
                byAssets,
            }
            const perspective = aggregatePerspectiveExplicit({
                universalKey: roomU,
                mergeParticipationOrder: assetStack,
            })
            const direct = mergeAuthoritativeAcrossParticipationOrder(perspective, authoritative)

            const slice = inMemoryComponentAggregateInternalCacheSlice({
                authoritativeByUniversal: new Map([[roomU, authoritative]]),
                verticalsByUniversal: new Map([[roomU, { universalKey: roomU, hops: [] }]]),
            })
            const { gateway } = createComponentAggregateGateway(slice)
            const assembled = await gateway.assembleMergedComponent(perspective)

            expect(schemaToWML([(assembled.merged as StandardRoom).schema])).toEqual(
                schemaToWML([(direct as StandardRoom).schema])
            )
        })
    })
})
