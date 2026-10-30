import { defineAttemptTemplate, fixedWord, words } from '../../../deterministicTemplate/deterministicTemplate'
import { CommandAttempt } from '../../../commandAttempt'
import { mintActionId, PositionAttemptAction } from '../../../commandAttempt/action'
import type { NarrationUnit } from '../../../commandAttempt/narrationUnit'
import { mintEdgeRefs } from '../../../../positions/manipulation/relational/edgeRefs'
import { objectSpanRef } from './planStep'
import type { EdgeRelationEntry, Referent } from './planStep'
import { qualifierObjectPhraseElement } from './qualifierPrepositions'

/**
 * The manner the tie templates write: the fixed text of the `Custom` edge's label, never the
 * player's words. Other manners (`glue`, `nail`) wait for the manner iteration.
 */
const TIED_TO = 'tied to'

/**
 * The tie triple between `subject` and `target`: the manner edge (`Custom` `tied to`), the
 * `SecuredTo` it justifies, and the `Justifies` from the first to the second, which names both by ref.
 */
const tieTriple = (subject: Referent, target: Referent) => ({
    manner: { edgeRef: 'tyingEdge', from: subject, to: target, relationKind: 'Custom', relationLabel: TIED_TO },
    secured: { edgeRef: 'secureEdge', from: subject, to: target, relationKind: 'SecuredTo' },
    justifies: { from: { edgeRef: 'tyingEdge' }, to: { edgeRef: 'secureEdge' }, relationKind: 'Justifies' },
} satisfies Record<string, EdgeRelationEntry>)

/** One line to everyone who can see the actor or either object, before the change: the verb form and the closed phrase. */
const narrationOver = (actionId: string, verbForm: string, subjectRef: string, phrase: string, targetRef: string): NarrationUnit => ({
    covers: [actionId],
    variants: [{
        audience: { refs: ['actor', subjectRef, targetRef], phase: 'before' },
        parts: [
            { slot: 'actor' },
            { text: ` ${verbForm} ` },
            { ref: subjectRef },
            { text: ` ${phrase} ` },
            { ref: targetRef },
        ],
    }],
})

/**
 * `tie X to Y`: writes the tie triple (`assignEdgeRelations`), unconditionally. X is then secured to
 * Y, and a move of either is blocked until it is untied.
 *
 * **The naive implementation of securing.** A closed verb is a stand-in: the LLM Plan fallback
 * inherits the route, producing the same change from open phrasing.
 */
export const tieTemplate = defineAttemptTemplate({
    name: 'relation',
    pattern: [fixedWord('verb', { tie: 'ties' }), qualifierObjectPhraseElement('subject'), words('to'), qualifierObjectPhraseElement('target')] as const,
    build({ verb: { value: verbForm }, subject: subjectSpan, target: targetSpan }, command) {
        const { manner, secured, justifies } = tieTriple(
            objectSpanRef(subjectSpan.text, subjectSpan.stableRefKey),
            objectSpanRef(targetSpan.text, targetSpan.stableRefKey)
        )
        const entries = [manner, secured, justifies]
        const actionId = mintActionId()
        return CommandAttempt.create('relation', command, [
            new PositionAttemptAction(actionId, [], { kind: 'change', primitive: 'assignEdgeRelations', entries, mintedEdgeIds: mintEdgeRefs(entries) }),
        ], [narrationOver(actionId, verbForm, subjectSpan.stableRefKey, 'to', targetSpan.stableRefKey)])
    },
})

/**
 * `untie X from Y`: removes whatever of the tie triple holds (`dissolveEdgeRelations`, every entry
 * optional), and refuses only when none does. The `Justifies` is listed first: dissolving either edge
 * it names would take it too, and it would then be absent when its own step ran.
 *
 * **The naive implementation of unsecuring**, as `tieTemplate` is of securing.
 */
export const untieTemplate = defineAttemptTemplate({
    name: 'relation',
    pattern: [fixedWord('verb', { untie: 'unties' }), qualifierObjectPhraseElement('subject'), words('from'), qualifierObjectPhraseElement('target')] as const,
    build({ verb: { value: verbForm }, subject: subjectSpan, target: targetSpan }, command) {
        const { manner, secured, justifies } = tieTriple(
            objectSpanRef(subjectSpan.text, subjectSpan.stableRefKey),
            objectSpanRef(targetSpan.text, targetSpan.stableRefKey)
        )
        const actionId = mintActionId()
        return CommandAttempt.create('relation', command, [
            new PositionAttemptAction(actionId, [], {
                kind: 'change',
                primitive: 'dissolveEdgeRelations',
                entries: [justifies, secured, manner].map((entry) => ({ ...entry, mustBePresent: false })),
            }),
        ], [narrationOver(actionId, verbForm, subjectSpan.stableRefKey, 'from', targetSpan.stableRefKey)])
    },
})
