import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { MessageBus } from '../../../../messageBus/baseClasses'
import type { PositionsPublishedPayload } from '../../publishedEvents'
import { applyObjectSetTransfer, type ApplyObjectSetTransferDependencies } from './applyObjectSetTransfer'
import type { ObjectSetTakeHoldApplyArgs, TakeHoldSetApplyResult } from './types'

export type ApplyObjectSetTakeHoldDependencies = {
    messageBus: MessageBus;
    streamEvent: StreamEventFunction<PositionsPublishedPayload>;
} & Pick<ApplyObjectSetTransferDependencies, 'transactWrite'>

/**
 * Object-*set*-aware take-hold apply --- thin directional wrapper over
 * `applyObjectSetTransfer` (Pipeline A -> B migration slice 3, 2026-07-15
 * `MultiKeyUpdate` redesign; supersedes this file's original `applyHostEffects`
 * + precomputed-`carriedEdges` implementation, Slice 1).
 */
export const applyObjectSetTakeHold = async (
    args: ObjectSetTakeHoldApplyArgs,
    deps: ApplyObjectSetTakeHoldDependencies
): Promise<TakeHoldSetApplyResult> =>
    applyObjectSetTransfer({ direction: 'takeHold', ...args }, deps)
