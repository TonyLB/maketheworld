/**
 * Filter for Example-associated component events.
 * Used so mtw.assets.componentExamples only processes Component Updated / Component Removed
 * for components that can affect Example lifecycle (Example itself or parents that reference Examples/Situations).
 *
 * For Room (Phase 3): association is driven only by Situations, not by Examples.
 * For Feature and Knowledge: association remains via examples field (unchanged).
 * "Example" in the filter name is legacy; for Room we use situations-only.
 */
import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

/** Component tags that are Example-associated: Example, or parents (Room, Feature, Knowledge). */
export const EXAMPLE_ASSOCIATED_TAGS: ReadonlySet<string> = new Set([
    'Example',
    'Room',
    'Feature',
    'Knowledge',
])

/** Tags that reference Examples (Feature, Knowledge) or Situations (Room). */
export const EXAMPLE_PARENT_TAGS: ReadonlySet<string> = new Set(['Room', 'Feature', 'Knowledge'])

/**
 * Returns true if the component is Example-associated and the event is relevant:
 * - Example: always (any change/removal is example-related).
 * - Room: only when it has a situations field with non-zero length (situations-only; not examples).
 * - Feature, Knowledge: only when they have an examples field with non-zero length.
 */
export function isExampleAssociatedComponent(component: StandardComponent): boolean {
    if (component.tag === 'Example') {
        return true
    }
    if (component.tag === 'Room') {
        const situations = (component as { situations?: { items?: unknown[] } }).situations
        return Boolean(situations?.items && situations.items.length > 0)
    }
    if (component.tag === 'Feature' || component.tag === 'Knowledge') {
        const examples = (component as { examples?: { payload?: unknown[] } }).examples
        return Boolean(examples?.payload && examples.payload.length > 0)
    }
    return false
}
