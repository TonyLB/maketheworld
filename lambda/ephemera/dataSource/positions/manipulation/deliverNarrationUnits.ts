import { v4 as uuidv4 } from 'uuid'

import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { MessageBus } from '../../../messageBus/baseClasses'
import type { NarrationAudience, NarrationUnit } from '../../actions/commandAttempt/narrationUnit'
import { fillNarrationTemplate } from './kernel/narrationTemplate'
import type { MutationKernelCaptures } from './kernel/types'

export type DeliverNarrationUnitsArgs = {
    /** In delivery order: the attempt's authored units, in the attempt's own action order. */
    units: readonly NarrationUnit[]
    /** The commit's own captured rosters --- the same map `presentStepSequence` reads narrate steps against. */
    captures: MutationKernelCaptures
    /** The commit's beat anchor: line *n* is stamped `beatAnchorTime + firstPresentationIndex + n`. */
    beatAnchorTime: number
    /** The first presentation index the committed plan did not use (`commitAndPresentStepSequence`'s `nextPresentationIndex`). */
    firstPresentationIndex: number
    messageBus: MessageBus
    /** The acting character's display name, for every variant's actor slot. */
    actorName: string
    /** Display label per ref, for every variant's `ref` parts --- resolved once per attempt by the caller. */
    labels: Record<string, string>
    /**
     * Resolves one variant's declared audience to the capture ids whose rosters make up its roster.
     * Plural: an audience's roster is the deduplicated union of every room its refs resolve
     * to, and `applyStepSequenceCore` overwrites a capture id's roster rather than appending to it,
     * so a multi-room audience needs one capture id per room, not one shared id.
     */
    resolveCaptureId: (unit: NarrationUnit, audience: NarrationAudience) => string[]
}

/**
 * The attempt's only narration delivery path (`positions/AGENT.contract.md`, An attempt narrates
 * through its narration units):
 * walks the attempt's narration units in order, and within each unit, its witness variants, filling
 * each variant's parts from the caller's `actorName` and `labels` and publishing one `WorldMessage`
 * per variant, directly on the bus. Each line is stamped `beatAnchorTime + index`, continuing after
 * the committed plan's own presentation steps, so transcript order is the delivery order. Runs only after a successful commit (`captures` only exists then); this function takes
 * no verdict of its own.
 */
export const deliverNarrationUnits = (args: DeliverNarrationUnitsArgs): void => {
    const entries = args.units.flatMap((unit) => unit.variants.map((variant) => ({
        captureIds: args.resolveCaptureId(unit, variant.audience),
        template: { kind: 'template' as const, parts: variant.parts, actorName: args.actorName, labels: args.labels },
    })))

    entries.forEach(({ captureIds, template }, offset) => {
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

        args.messageBus.publish({
            type: 'PublishMessage',
            targets: [...targets],
            displayProtocol: 'WorldMessage',
            message: [fillNarrationTemplate(template)],
            messageId: `MESSAGE#${uuidv4()}`,
            createdTime: args.beatAnchorTime + args.firstPresentationIndex + offset,
        })
    })
}
