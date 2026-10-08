import type { TemplateNarrationSpec } from './kernelStep'

/**
 * Renders a template to its copy at flush time. An empty actor name falls back to `'Someone'`
 * here, so every template gets the same fallback.
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
