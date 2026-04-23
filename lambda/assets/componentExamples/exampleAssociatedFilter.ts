/**
 * Filter for Example-associated component events.
 * Used so mtw.assets.componentExamples only processes Component Updated / Component Removed
 * for components that can affect Example lifecycle (Example itself or parents that reference Examples).
 *
 * Room prose is not tracked via this Example-lifecycle filter (Situation / render instead).
 */
import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

/** Component tags that are Example-associated: Example, or parents (Feature, Knowledge). */
export const EXAMPLE_ASSOCIATED_TAGS: ReadonlySet<string> = new Set([
    'Example',
    'Feature',
    'Knowledge',
])

/** Tags that reference Examples (Feature, Knowledge). */
export const EXAMPLE_PARENT_TAGS: ReadonlySet<string> = new Set(['Feature', 'Knowledge'])

/**
 * Returns true if the component is Example-associated and the event is relevant:
 * - Example: always (any change/removal is example-related).
 * - Feature, Knowledge: only when they have an examples field with non-zero length.
 */
export function isExampleAssociatedComponent(component: StandardComponent): boolean {
    if (component.tag === 'Example') {
        return true
    }
    if (component.tag === 'Feature' || component.tag === 'Knowledge') {
        const examples = (component as { examples?: { payload?: unknown[] } }).examples
        return Boolean(examples?.payload && examples.payload.length > 0)
    }
    return false
}
