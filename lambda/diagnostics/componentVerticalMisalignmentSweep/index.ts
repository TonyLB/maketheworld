import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge'
import { v4 as uuidv4 } from 'uuid'
import type { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import {
    DiagnosticsComponentVerticalMisalignedFindingEvent,
    DiagnosticsEventSerializer,
} from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'
import {
    ImportVerticalConsistencyAnalyzer,
    type ImportVerticalConsistencyAnalyzerDeps,
} from '@tonylb/mtw-gateways/ts/assets/components/verticals'
import internalCache from '../internalCache'
import { aggregateMisalignmentStatuses } from './classification'
import { exhaustivePartitionLoader } from './exhaustivePartitionLoader'
import { createNodeDataSourceEnvironment } from '@tonylb/mtw-lambda-patterns/ts/dataSource/nodeEnvironment'
import { publishStreamEvent, StreamEventPublisherSerializer } from '@tonylb/mtw-lambda-patterns/ts/dataSource/streamEventPublisher'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { AssetKey } from '@tonylb/mtw-utilities/ts/types'
import type { StandardComponentData } from '@tonylb/mtw-wml/ts/standardize/baseClasses'
import { isStandardNDJSONLine } from '@tonylb/mtw-wml/ts/standardize/baseClasses'
import { standardComponentFactory } from '@tonylb/mtw-wml/ts/standardize/componentFactory'

async function analyzeUniversalPartition(universalKey: EphemeraId): Promise<
    'aligned' | 'missing' | 'orphan' | 'stale'
> {
    const deps: ImportVerticalConsistencyAnalyzerDeps = {
        authoritativeComponentData: exhaustivePartitionLoader,
        metaImportProjection: internalCache.ComponentVerticals,
    }

    const analyzer = new ImportVerticalConsistencyAnalyzer(deps)
    await analyzer.check(universalKey)
    return analyzer.getClassification()
}

/**
 * Compare authoritative component `_from` hops to projected `Meta::Import::...` for every universal
 * component touched by this asset. Emits {@link DiagnosticsComponentVerticalMisalignedFindingEvent} when misaligned.
 */
export const componentVerticalMisalignmentSweep = async (params: {
    assetId: string
    diagnosticRunId?: string
    nowMs?: number
}): Promise<{ emitted: boolean; status?: 'missing' | 'orphan' | 'stale' }> => {
    const eventBusName = process.env.EVENT_BUS_NAME
    if (!eventBusName) {
        throw new Error('componentVerticalMisalignmentSweep requires EVENT_BUS_NAME')
    }

    const assetId = AssetKey(params.assetId)
    const nowMs = params.nowMs ?? Date.now()
    const diagnosticRunId = params.diagnosticRunId ?? uuidv4()

    const rows =
        (await assetDB.query<StandardComponentData & { AssetId: string; DataCategory: string }>({
            IndexName: 'DataCategoryIndex',
            Key: { DataCategory: assetId },
            allFields: true,
        })) || []

    const universalKeys = new Set<EphemeraId>()
    for (const line of rows) {
        if (!isStandardNDJSONLine(line)) {
            continue
        }
        const { component } = standardComponentFactory(line)
        const uk = component?.universalKey
        if (uk) {
            universalKeys.add(uk as EphemeraId)
        }
    }

    const partitionStatuses = await Promise.all(
        [...universalKeys].sort().map((uk) => analyzeUniversalPartition(uk))
    )

    const status = aggregateMisalignmentStatuses(partitionStatuses)
    if (!status) {
        return { emitted: false }
    }

    const internalEvent: DiagnosticsComponentVerticalMisalignedFindingEvent = {
        type: 'Component Vertical Misaligned Finding',
        assetId,
        status,
        diagnosticRunId,
        timestamp: new Date(nowMs).toISOString(),
    }

    const serializer = new DiagnosticsEventSerializer(createNodeDataSourceEnvironment())
    const header = {
        dataSourceKey: 'mtw.diagnostics' as const,
        streamKey: 'global',
        timestamp: nowMs,
        type: 'Component Vertical Misaligned Finding' as const,
    }
    const { eventBridgeEvent } = publishStreamEvent({
        header,
        content: internalEvent,
        serializer: serializer as StreamEventPublisherSerializer<typeof header>,
    })
    const ebClient = new EventBridgeClient({ region: process.env.AWS_REGION })
    await ebClient.send(
        new PutEventsCommand({
            Entries: [
                {
                    Source: eventBridgeEvent.Source,
                    DetailType: eventBridgeEvent.DetailType,
                    EventBusName: eventBusName,
                    Detail: JSON.stringify(eventBridgeEvent.Detail),
                },
            ],
        })
    )

    return { emitted: true, status }
}
