import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { relationKindAndLabelFrom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

import type { MessageBus } from '../../../../messageBus/baseClasses'
import type { PositionsPublishedPayload } from '../../publishedEvents'
import type { MutationKernelStep } from '../kernel/kernelStep'
import { commitStepSequence } from '../kernel/commitStepSequence'
import type { RelationalApplyResult, RelationalIngressArgs } from './types'

export type ApplyObjectRelationalChangeDependencies = {
    messageBus: MessageBus
    streamEvent: StreamEventFunction<PositionsPublishedPayload>
    transactWrite?: typeof ephemeraDB.transactWrite
}

/**
 * The relational route's commit path: one `commitStepSequence` call over the single
 * `establishRelation`/`dissolveRelation` step this route produces.
 *
 * Migrate slice (2026-07-23) collapsed the older split here
 * (`applyObjectRelationalChangeWithTransfer.ts` vs. `planHostRelationalPatch.ts` +
 * `applyHostRelationalPatch.ts`, all three retired from this call site) into a
 * two-branch sequence builder: a satisfied `sameHost` produced `[establishRelation]`,
 * and a *repaired* one produced `[dissolveRelation*, transferMembership,
 * establishRelation]` --- re-deriving the repair transfer's carry closure and boundary
 * sweep fresh at commit time from a `transferFromHostId` carried across the wire.
 *
 * **PV1-3b-9 (2026-09-01) retired that second branch entirely**, along with the wire
 * field that fed it. A relation whose endpoints are in different shards is no longer
 * something to fix by moving an endpoint; it is a crossing, built as legs at Plan stage.
 * So this route commits one step and never moves membership. Transfers still exist ---
 * `executeObjectMove` owns them, and still does its own cross-snapshot recheck --- they
 * are simply not something establishing a relation can trigger as a side effect.
 */
export const applyObjectRelationalChange = async (
    args: RelationalIngressArgs,
    deps: ApplyObjectRelationalChangeDependencies
): Promise<RelationalApplyResult> => {
    const relationalStep: MutationKernelStep = {
        kind: args.operation === 'establish' ? 'establishRelation' : 'dissolveRelation',
        subjectId: args.subjectId,
        targetId: args.targetId,
        hostId: args.hostId,
        ...relationKindAndLabelFrom(args),
    }

    // Every object this sequence can reference is on `hostId` --- the route no longer carries
    // a repair transfer that would put the subject somewhere else at commit time.
    const getCurrentHost = (): EphemeraMembershipHostId | undefined => args.hostId

    const result = await commitStepSequence(
        { steps: [relationalStep] },
        {
            messageBus: deps.messageBus,
            streamEvent: deps.streamEvent,
            getCurrentHost,
            ...(deps.transactWrite !== undefined ? { transactWrite: deps.transactWrite } : {}),
        }
    )

    if (!result.ok) {
        console.error(`[mtw.ephemera.positions] applyObjectRelationalChange failed: ${result.errorMessage}`)
        return { ok: false, errorCode: result.errorCode, errorMessage: result.errorMessage }
    }

    return { ok: true, changed: true, beatAnchorTime: result.beatAnchorTime }
}
