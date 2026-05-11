import type { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import type { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { defaultComponentFromTag } from '@tonylb/mtw-wml/ts/standardize/baseClasses'
import { standardComponentFactory } from '@tonylb/mtw-wml/ts/standardize/componentFactory'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

import { tagFromEphemeraWrappedId } from '../assetMeta/defaults'
import type { AuthoritativeComponentData } from '../assetMeta/dynamoStandardComponents'

import type { AggregatePerspective } from './input'
import { AggregateInputError } from './input'

function defaultStubForUniversalComponent(universalKey: EphemeraId): StandardComponent {
    const tag = tagFromEphemeraWrappedId(universalKey)
    const defaultData = defaultComponentFromTag(tag, undefined, universalKey as ComponentUUID)
    const { component } = standardComponentFactory(defaultData)
    if (!component) {
        throw new AggregateInputError(
            `No default component for universal key ${universalKey} (tag ${String(tag)})`
        )
    }
    return component
}

function componentByAssetMap(authoritative: AuthoritativeComponentData): Map<AssetUUID, StandardComponent> {
    const map = new Map<AssetUUID, StandardComponent>()
    for (const { AssetId, component } of authoritative.byAssets) {
        map.set(AssetId, component)
    }
    return map
}

/**
 * Folds {@link StandardComponent.merge} along {@link AggregatePerspective.mergeParticipationOrder}
 * (ascending index: first id is the base; later ids overlay), matching `merge*AcrossStack` in
 * `lambda/assets/componentExamples/exampleEnrichment.ts`.
 */
export function mergeAuthoritativeAcrossParticipationOrder(
    perspective: AggregatePerspective,
    authoritative: AuthoritativeComponentData
): StandardComponent {
    const { universalKey, mergeParticipationOrder } = perspective
    if (mergeParticipationOrder.length === 0) {
        throw new AggregateInputError('Empty merge participation order')
    }
    if (authoritative.ComponentId !== universalKey) {
        throw new AggregateInputError(
            `Authoritative ComponentId ${authoritative.ComponentId} does not match perspective universalKey ${universalKey}`
        )
    }
    const byAsset = componentByAssetMap(authoritative)
    const layers: StandardComponent[] = mergeParticipationOrder.map((assetId) =>
        byAsset.get(assetId) ?? defaultStubForUniversalComponent(universalKey)
    )
    let merged = layers[0]!
    for (let i = 1; i < layers.length; i++) {
        const next = layers[i]!
        const after = merged.merge(next)
        if (after === undefined) {
            throw new AggregateInputError(
                `StandardComponent.merge returned undefined when merging participation index ${i} (${String(next.tag)})`
            )
        }
        merged = after
    }
    return merged
}
