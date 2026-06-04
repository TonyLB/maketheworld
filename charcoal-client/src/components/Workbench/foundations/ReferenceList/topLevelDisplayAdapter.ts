import type { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import StandardImage from '@tonylb/mtw-wml/ts/standardize/components/image'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import StandardReference from '@tonylb/mtw-wml/ts/standardize/components/reference'
import { ReferenceList } from '@tonylb/mtw-wml/ts/standardize/keys/referenceList'
import { referenceSortOrder } from '@tonylb/mtw-wml/ts/standardize/keys/reference'
import { componentDisplayLabel } from '../../../../lib/componentDisplayLabel'

import type { ReferenceListItem } from './ReferenceListEditorGeneric'

export type TopLevelRowKind = 'pinned' | 'displayOnly'

export type TopLevelDisplayItem = ReferenceListItem & {
    rowKind: TopLevelRowKind
}

const PINNED_SUBTITLE = 'Pinned'
const DISPLAY_ONLY_SUBTITLE = 'Visible in asset'

function itemFromReference(
    ref: StandardReference,
    standardForm: StandardForm,
    rowKind: TopLevelRowKind
): TopLevelDisplayItem | undefined {
    const universalKey = ref.universalKey
    if (!universalKey) {
        return undefined
    }
    const component = standardForm.byUniversalId[universalKey] as StandardComponent | undefined
    if (component instanceof StandardImage) {
        return undefined
    }
    const title = component
        ? (componentDisplayLabel(component, { standardForm, fallbackLabel: 'Untitled' }) ?? 'Untitled')
        : 'Untitled'
    return {
        id: universalKey,
        title,
        subtitle: rowKind === 'pinned' ? PINNED_SUBTITLE : DISPLAY_ONLY_SUBTITLE,
        rowKind
    }
}

/**
 * Union of asset-level organization children (display) and explicit roster pins on working.topLevel.
 */
export function buildTopLevelDisplayItems({
    standardForm,
    pinnedList,
    excludeImages = true
}: {
    standardForm: StandardForm
    pinnedList: ReferenceList
    excludeImages?: boolean
}): TopLevelDisplayItem[] {
    const organization = standardForm._getSchemaOrganization()
    const displayRefs = organization.getChildrenOfParent(undefined)
    const pinnedRefs = pinnedList.payload.filter((ref) => ref.ref >= 1)

    const byId = new Map<ComponentUUID, TopLevelDisplayItem>()

    for (const ref of displayRefs) {
        if (excludeImages && ref.tag === 'Image') {
            continue
        }
        const item = itemFromReference(ref, standardForm, 'displayOnly')
        if (item) {
            byId.set(item.id as ComponentUUID, item)
        }
    }

    for (const ref of pinnedRefs) {
        if (excludeImages && ref.tag === 'Image') {
            continue
        }
        const item = itemFromReference(ref, standardForm, 'pinned')
        if (item) {
            byId.set(item.id as ComponentUUID, item)
        }
    }

    const refsForSort = [...byId.values()].map((item) => {
        const comp = standardForm.byUniversalId[item.id as ComponentUUID]
        return comp?.reference ?? new StandardReference(item.id as ComponentUUID)
    })

    refsForSort.sort(referenceSortOrder)

    return refsForSort
        .map((ref) => {
            const key = ref.universalKey
            return key ? byId.get(key) : undefined
        })
        .filter((item): item is TopLevelDisplayItem => item !== undefined)
}
