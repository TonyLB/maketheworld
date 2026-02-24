/**
 * Filter for Example-associated component events.
 * Used so mtw.assets.componentExamples only processes Component Updated / Component Removed
 * for components that can affect Example lifecycle (Example itself or parents that reference Examples).
 *
 * Component Updated events carry a component-level diff (edit representation). For Room, Feature, and
 * Knowledge, the diff's `examples` field has non-zero length only when the change touched the
 * examples list. So we require that for parents; Example components always pass.
 */
import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

/** Component tags that are Example-associated: Example, or parents that reference Examples (Room, Feature, Knowledge). */
export const EXAMPLE_ASSOCIATED_TAGS: ReadonlySet<string> = new Set([
    'Example',
    'Room',
    'Feature',
    'Knowledge',
])

/** Tags that reference Examples; for these we require examples field with non-zero length (diff or current state). */
export const EXAMPLE_PARENT_TAGS: ReadonlySet<string> = new Set(['Room', 'Feature', 'Knowledge'])

/**
 * Returns true if the component is Example-associated and the event is relevant:
 * - Example: always (any change/removal is example-related).
 * - Room, Feature, Knowledge: only when they have an `examples` field with non-zero length
 *   (on Component Updated this is the diff of the examples list; on Component Removed this is
 *   the removed component's examples). Events for other types or parents with no example refs are ignored.
 */
export function isExampleAssociatedComponent(component: StandardComponent): boolean {
    if (component.tag === 'Example') {
        return true
    }
    if (!EXAMPLE_PARENT_TAGS.has(component.tag)) {
        return false
    }
    const examples = (component as { examples?: { payload?: unknown[] } }).examples
    return Boolean(examples?.payload && examples.payload.length > 0)
}
