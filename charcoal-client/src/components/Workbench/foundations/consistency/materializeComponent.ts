import type { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { isSchemaImportMappingType } from '@tonylb/mtw-base/ts/schema/metaData'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { componentTagFromUniversalKey } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/abstract'
import { standardComponentFactory } from '@tonylb/mtw-wml/ts/standardize/componentFactory'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'
import StandardObject from '@tonylb/mtw-wml/ts/standardize/components/object'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'

import { addImportToDraft } from '../../../../slices/personalAssets/addImportToDraft'

export type MaterializeSpec = {
    universalKey: ComponentUUID
    /** When set, import path (`addImportToDraft`); otherwise create/stub via factory. */
    fromAsset?: AssetUUID
}

/**
 * Ensure `draft.byUniversalId` contains the component before a reference is meaningful.
 * Derives tag from `universalKey` prefix (D9); callers do not pass tag separately.
 */
export function materializeComponent(
    draft: StandardForm,
    spec: MaterializeSpec
): StandardReference {
    const { universalKey, fromAsset } = spec
    const tag = componentTagFromUniversalKey(universalKey)

    if (fromAsset) {
        if (!isSchemaImportMappingType(tag)) {
            throw new Error(
                `Cannot import component type ${tag} (${universalKey}); import supports Room, Area, Feature, Knowledge, Map, Moment, Message, Lens only`
            )
        }
        const ref = addImportToDraft(draft, { fromAsset, uuid: universalKey, tag })
        if (!ref) {
            throw new Error(`Could not materialize import for ${universalKey}`)
        }
        return ref
    }

    const existing = draft.byUniversalId[universalKey]
    if (existing) {
        const ref = existing.reference
        if (!ref) {
            throw new Error(`Component ${universalKey} has no reference`)
        }
        return ref
    }

    const { component } = standardComponentFactory({ tag, universalKey })
    if (!component) {
        throw new Error(`Could not create component for tag ${tag}`)
    }
    // Convenience default, not a validity guard: a new Object starts labelled so it isn't blank.
    const seeded = component instanceof StandardObject
        ? component.withShortName(new StandardLiteral('object', { tag: 'ShortName' }))
        : component
    draft.byUniversalId[universalKey] = seeded
    const ref = seeded.reference
    if (!ref) {
        throw new Error(`Could not create reference for ${universalKey}`)
    }
    return ref
}
