/**
 * Filter for the legacy `mtw.assets.componentExamples` data source.
 *
 * Today this gate only admits standalone **Example** components. **Room**, **Feature**,
 * and **Knowledge** prose is keyed by **Situation** facets and is handled in
 * [`index.ts`](./index.ts) *before* this filter runs (`emitParentSituationFacetEvents`).
 *
 * **Gap / future work:** The pipeline name, wire events (`ExampleUpdated`, etc.), and
 * this filter still reflect the old model where render-cache mirroring was driven by
 * `<Example>` children and parent `examples` reference lists. WML has moved to
 * `situations` facets on parents; F/K no longer serialize `examples` (**D6**). A
 * productive refactor should rename or replace `componentExamples`, decide what
 * events it actually tracks (situation-facet render cache vs marks-only Example),
 * and rebuild subscription filters and enrichment around that scope instead of
 * stretching "Example-associated" to cover unrelated shapes.
 */
import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

/** Tags that pass `isExampleAssociatedComponent` (standalone Example path only). */
export const EXAMPLE_ASSOCIATED_TAGS: ReadonlySet<string> = new Set(['Example'])

/**
 * Parent tags that may reference a Situation via facets (used by enrichment parent
 * discovery, not by this filter). Room is included for `getParentIdsForSituation`.
 */
export const EXAMPLE_PARENT_TAGS: ReadonlySet<string> = new Set(['Room', 'Feature', 'Knowledge'])

/**
 * Returns true only for standalone **Example** components.
 *
 * **Room**, **Feature**, and **Knowledge** return false here even when they have
 * situation facets; their updates are handled on the early branch in `index.ts`.
 */
export function isExampleAssociatedComponent(component: StandardComponent): boolean {
    return component.tag === 'Example'
}
