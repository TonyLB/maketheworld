import type { NarrationPart, TemplateNarrationSpec } from './kernelStep'

/**
 * Bridge narration for a `transferMembership` step: the old take/drop/give family copy, represented
 * in the template format. Narration belongs to whatever creates an action, not to positions, so this
 * is not a floor and grows no new verbs; it is deleted once an author covers object moves. The verb
 * is chosen by the compiler from the move's delta (`objectMoveVerb` in
 * `compile/compilePositionKernelOp.ts`); this module only maps a verb to the literal text between
 * the actor and the moved entity.
 */
export const defaultTransferMembershipParts = (
    verb: 'takeHold' | 'drop' | 'give',
    movedId: string
): NarrationPart[] => {
    const verbText = verb === 'takeHold'
        ? ' picks up '
        : verb === 'drop'
        ? ' drops '
        : ' gives '
    return [{ slot: 'actor' }, { text: verbText }, { ref: movedId }]
}

/**
 * Renders a template to its copy at flush time. An empty actor name falls back to `'Someone'`
 * here, not in the default, so every template (authored ones included) gets the same fallback.
 *
 * A `ref` with no label is a hard error: labels are resolved by the caller before compile (an
 * unresolvable name already falls back to a placeholder there), so a miss means the template and
 * its labels were built apart and disagree.
 */
export const fillNarrationTemplate = (spec: TemplateNarrationSpec): string => {
    const actor = spec.actorName || 'Someone'
    return spec.parts
        .map((part) => {
            if ('text' in part) {
                return part.text
            }
            if ('slot' in part) {
                return actor
            }
            const label = spec.labels[part.ref]
            if (label === undefined) {
                throw new Error(`fillNarrationTemplate: template refers to '${part.ref}', which has no label`)
            }
            return label
        })
        .join('')
}
