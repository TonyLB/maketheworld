import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { MessageBus } from '../../../../messageBus/baseClasses'
import type { PositionsPublishedPayload } from '../../publishedEvents'
import { applyObjectSetTransfer, type ApplyObjectSetTransferDependencies } from './applyObjectSetTransfer'
import type { DropSetApplyResult, ObjectSetDropApplyArgs } from './types'

export type ApplyObjectSetDropDependencies = {
    messageBus: MessageBus;
    streamEvent: StreamEventFunction<PositionsPublishedPayload>;
} & Pick<ApplyObjectSetTransferDependencies, 'getPositionGraph' | 'transactWrite'>

/**
 * Object-*set*-aware drop apply --- thin directional wrapper over
 * `applyObjectSetTransfer` (Pipeline A -> B migration slice 3, 2026-07-15
 * `MultiKeyUpdate` redesign; supersedes this file's original `applyHostEffects`
 * + precomputed-`carriedEdges` implementation, Slice 1).
 */
export const applyObjectSetDrop = async (
    args: ObjectSetDropApplyArgs,
    deps: ApplyObjectSetDropDependencies
): Promise<DropSetApplyResult> =>
    applyObjectSetTransfer({ direction: 'drop', ...args }, deps)
