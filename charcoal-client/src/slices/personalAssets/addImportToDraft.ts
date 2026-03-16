import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/keys/reference'
import { standardComponentFactory } from '@tonylb/mtw-wml/ts/standardize/componentFactory'
import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import type { SchemaImportMapping } from '@tonylb/mtw-base/ts/schema/metaData'
import type { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'

export type AddImportToDraftParams = {
    fromAsset: AssetUUID
    uuid: ComponentUUID
    tag: SchemaImportMapping['type']
}

/**
 * Mutates the given StandardForm draft to add or update an imported component (sets or updates
 * `from`). Returns the component's reference so the caller can place it in a list or slot.
 * Use inside an updateStandard update callback, e.g.:
 *
 *   updateStandard(assetId)({
 *     type: 'update',
 *     update: (draft) => {
 *       const ref = addImportToDraft(draft, { fromAsset, uuid, tag })
 *       const descriptor = getTopLevelAddToReferenceList(draft)
 *       if (ref) descriptor.setReferenceList(descriptor.referenceList.assureItem(ref))
 *       return draft
 *     }
 *   })
 */
export function addImportToDraft(draft: StandardForm, params: AddImportToDraftParams): StandardReference | undefined {
    const { fromAsset, uuid, tag } = params
    let component: StandardComponent

    if (uuid in draft.byUniversalId) {
        const existingComponent = draft.byUniversalId[uuid]
        component = existingComponent.clone().withImport(fromAsset)
        draft.byUniversalId[uuid] = component
    } else {
        const { component: newComponent } = standardComponentFactory({ tag, universalKey: uuid })
        if (!newComponent) {
            throw new Error(`Could not create component for tag ${tag}`)
        }
        component = newComponent.withImport(fromAsset)
        draft.byUniversalId[uuid] = component
    }

    return component.reference ?? undefined
}
