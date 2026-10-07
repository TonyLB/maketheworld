import { v4 as uuidv4 } from 'uuid'

import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { MessageBus } from '../../../messageBus/baseClasses'
import { sendMessageBundleDeclared, sendMessageSlotReported } from '../../messageOrchestration/subscribedEvents'
import type { NarrationAudience, NarrationUnit } from '../../actions/commandAttempt/narrationUnit'
import { fillNarrationTemplate } from './kernel/narrationTemplate'
import type { MutationKernelCaptures } from './kernel/types'

export type DeliverNarrationUnitsArgs = {
    /** In delivery order (AN-4): the attempt's authored units interleaved with any bridge units, in the attempt's own action order. */
    units: readonly NarrationUnit[]
    /** The commit's own captured rosters --- the same map `presentStepSequence` reads narrate steps against. */
    captures: MutationKernelCaptures
    /** The attempt's own bundle id, so a bridge and an authored unit's lines interleave in one declared bundle (AN-4). */
    bundleId: string
    messageBus: MessageBus
    /** The acting character's display name, for every variant's actor slot. */
    actorName: string
    /** Display label per ref, for every variant's `ref` parts --- resolved once per attempt by the caller. */
    labels: Record<string, string>
    /**
     * Resolves one variant's declared audience to the capture ids whose rosters make up its roster.
     * Plural (AN-8): an audience's roster is the deduplicated union of every room its refs resolve
     * to, and `applyStepSequenceCore` overwrites a capture id's roster rather than appending to it,
     * so a multi-room audience needs one capture id per room, not one shared id.
     */
    resolveCaptureId: (unit: NarrationUnit, audience: NarrationAudience) => string[]
}

/**
 * The attempt's only narration delivery path (`AGENT.attemptNarration.planning.md`, slice 3, AN-4):
 * walks the attempt's narration units in order, and within each unit, its witness variants, filling
 * each variant's parts from the caller's `actorName` and `labels` and publishing one `WorldMessage`
 * per variant. Declares its own messageOrchestration bundle slots (one per variant, in delivery order) so `CreatedTime`/`MessageId` ordering falls out for free,
 * reusing the attempt's own `bundleId` the same way `commitAttempt.ts` already does for the plan it
 * commits. Runs only after a successful commit (`captures` only exists then); this function takes
 * no verdict of its own.
 */
export const deliverNarrationUnits = (args: DeliverNarrationUnitsArgs): void => {
    const entries = args.units.flatMap((unit) => unit.variants.map((variant) => ({
        slotId: `narrate:${uuidv4()}`,
        captureIds: args.resolveCaptureId(unit, variant.audience),
        template: { kind: 'template' as const, parts: variant.parts, actorName: args.actorName, labels: args.labels },
    })))

    if (entries.length === 0) {
        return
    }

    sendMessageBundleDeclared(args.messageBus, args.bundleId, {
        bundleId: args.bundleId,
        slots: entries.map(({ slotId }) => ({ slotId, expectedPublishType: 'WorldMessage' as const })),
    })

    for (const { slotId, captureIds, template } of entries) {
        const targets = new Set<EphemeraCharacterId>()
        for (const captureId of captureIds) {
            /** Same hard-error invariant `presentStepSequence` enforces: no live-roster fallback. */
            if (!args.captures.has(captureId)) {
                throw new Error(
                    `deliverNarrationUnits: a narration unit's audience resolved to captureId '${captureId}', which the commit produced no capture for`
                )
            }
            for (const target of args.captures.get(captureId) ?? []) {
                targets.add(target)
            }
        }

        sendMessageSlotReported(args.messageBus, args.bundleId, {
            bundleId: args.bundleId,
            slotId,
            message: {
                type: 'PublishMessage',
                targets: [...targets],
                displayProtocol: 'WorldMessage',
                message: [fillNarrationTemplate(template)],
                createdTime: 0,
            },
        })
    }
}
