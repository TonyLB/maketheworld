import { helpTemplate, homeTemplate, lookTemplate, predictTemplate } from './bareWordTemplates'
import { relationalTemplateRegistry } from './relationalTemplates'
import type { DeterministicTemplate, DeterministicTemplateMatch } from './deterministicTemplate'

/**
 * Ordered, first-match-wins; agnostic to which factory produced each entry
 * (a future non-pattern-driven implementation could sit in this same array).
 */
export const deterministicTemplateRegistry: DeterministicTemplate[] = [
    lookTemplate,
    helpTemplate,
    homeTemplate,
    predictTemplate,
    ...relationalTemplateRegistry,
]

export function matchDeterministicTemplate(command: string): DeterministicTemplateMatch {
    for (const template of deterministicTemplateRegistry) {
        const result = template.matchString(command)
        if (result.type !== 'noMatch') {
            return result
        }
    }
    return { type: 'noMatch' }
}
