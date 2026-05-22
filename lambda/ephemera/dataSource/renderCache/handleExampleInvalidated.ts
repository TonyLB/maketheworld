/**
 * ExampleInvalidated handler: component-scoped catalog bumps and Situation adjacency fan-out.
 */
import type { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { assetStackIncludesEditAssetId } from '@tonylb/mtw-gateways/ts/assets/components/componentExamples'
import {
    isEphemeraFeatureId,
    isEphemeraKnowledgeId,
    isEphemeraRoomId,
    type EphemeraSituationId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import type {
    ComponentExamplesInvalidatedEvent,
    ComponentScopedExampleInvalidatedEvent,
    SituationScopedExampleInvalidatedEvent,
} from '@tonylb/mtw-interfaces/ts/eventBridge/assets/componentExamples'
import {
    isComponentScopedExampleInvalidated,
    isSituationScopedExampleInvalidated,
} from '@tonylb/mtw-interfaces/ts/eventBridge/assets/componentExamples'
import { parseSituationAdjacencyDataCategory, type EphemeraCacheComponentId } from './baseClasses'
import { catalogRowMatchesEditAssetId } from './catalogGuards'
import {
    conditionalInvalidateCatalogRow,
    getCatalogRow,
    queryCatalogRowsForComponent,
} from './catalogRow'
import {
    deleteAllAdjacencyLinksForSituation,
    queryAdjacencyLinksForSituation,
} from './situationAdjacency'

const asCacheHostId = (id: ComponentUUID): EphemeraCacheComponentId | undefined => {
    if (isEphemeraRoomId(id) || isEphemeraFeatureId(id) || isEphemeraKnowledgeId(id)) {
        return id
    }
    return undefined
}

const handleComponentScopedInvalidation = async (
    event: ComponentScopedExampleInvalidatedEvent
): Promise<void> => {
    for (const componentId of event.componentIds) {
        const hostId = asCacheHostId(componentId)
        if (!hostId) {
            continue
        }
        const rows = await queryCatalogRowsForComponent(hostId)
        const targets = rows.filter((row) => catalogRowMatchesEditAssetId(row, event.editAssetId))
        await Promise.all(targets.map((row) => conditionalInvalidateCatalogRow(row)))
    }
}

const handleSituationScopedInvalidation = async (
    event: SituationScopedExampleInvalidatedEvent
): Promise<void> => {
    const situationId = event.situationId as EphemeraSituationId
    const links = await queryAdjacencyLinksForSituation(situationId)

    if (links.length === 0) {
        return
    }

    const entityRemoved = event.entityRemoved === true
    const linksToBump = entityRemoved
        ? links
        : links.filter((link) => assetStackIncludesEditAssetId(link.assetStack, event.editAssetId))

    await Promise.all(
        linksToBump.map(async (link) => {
            const parsed = parseSituationAdjacencyDataCategory(link.DataCategory)
            if (!parsed) {
                return
            }
            const catalogRow = await getCatalogRow(parsed.hostEphemeraId, parsed.perspectiveKey)
            if (!catalogRow) {
                return
            }
            await conditionalInvalidateCatalogRow(catalogRow)
        })
    )

    if (entityRemoved) {
        await deleteAllAdjacencyLinksForSituation(situationId)
    }
}

export const handleExampleInvalidated = async (
    event: ComponentExamplesInvalidatedEvent
): Promise<void> => {
    if (isComponentScopedExampleInvalidated(event)) {
        await handleComponentScopedInvalidation(event)
        return
    }
    if (isSituationScopedExampleInvalidated(event)) {
        await handleSituationScopedInvalidation(event)
    }
}
