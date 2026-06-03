import type { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { standardComponentFactory } from '@tonylb/mtw-wml/ts/standardize/componentFactory'
import type { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'

export const DEFAULT_SITUATION_ID: ComponentUUID = 'SITUATION#DEFAULT'
const PRIMITIVES_ASSET_ID: AssetUUID = 'ASSET#primitives'

/**
 * Ensures the given StandardForm draft has a SITUATION#DEFAULT component
 * imported from the primitives asset, so situation facets referencing it can be edited.
 * Mutates the draft in place.
 *
 * Intended for use inside an updateStandard(assetId)({ type: 'update' | 'updateLocal', update: (draft) => { ... } })
 * callback. The returned boolean indicates whether the draft was modified (e.g. the caller
 * may dispatch fetchImports(assetId) when true).
 *
 * @param draft - The StandardForm to mutate (e.g. the clone passed to the update callback).
 * @param fromAsset - Asset to import from; defaults to ASSET#primitives.
 * @returns true if the draft was modified (component added or import updated), false if no change.
 */
export function assureDefaultSituationFromPrimitives(
    draft: StandardForm,
    fromAsset: AssetUUID = PRIMITIVES_ASSET_ID
): boolean {
    const existing = draft.byUniversalId[DEFAULT_SITUATION_ID]
    if (existing?._from === fromAsset) {
        return false
    }
    const component = existing
        ? existing.clone().withImport(fromAsset)
        : (() => {
              const { component: c } = standardComponentFactory({
                  tag: 'Situation',
                  universalKey: DEFAULT_SITUATION_ID
              })
              if (!c) {
                  throw new Error('Could not create SITUATION#DEFAULT component')
              }
              return c.withImport(fromAsset)
          })()
    draft.byUniversalId[DEFAULT_SITUATION_ID] = component
    return true
}
