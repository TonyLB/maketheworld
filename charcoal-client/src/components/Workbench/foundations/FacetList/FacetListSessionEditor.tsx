import React, { FunctionComponent, useCallback, useMemo } from "react"

import { ComponentUUID } from "@tonylb/mtw-base/ts/schema"
import { enforceTypedKey } from "@tonylb/mtw-utilities/ts/types"
import StandardReference from "@tonylb/mtw-wml/ts/standardize/components/reference"
import type { StandardComponent } from "@tonylb/mtw-wml/ts/standardize/components/baseClasses"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { v4 as uuidv4 } from "uuid"

import { useWorkbenchComponent } from "../WorkbenchComponent"
import { useWorkbenchAsset } from "../useWorkbenchAsset"
import type { ComponentTag } from "../ReferenceList/ReferenceListEditor"
import {
    FacetListEditorGeneric,
    type FacetListEditorGenericProps,
    type FacetRowHandlers
} from "./FacetListEditorGeneric"

export type FacetListSessionAccessor<TParent extends StandardComponent, TFacetList, TFacet> = {
    getFacetList: (parent: TParent) => TFacetList
    setFacetList: (parent: TParent, list: TFacetList) => void
    appendReferenceIfNew: (list: TFacetList, ref: StandardReference) => TFacetList | null
}

type FacetListWithItems<TFacet> = {
    items: TFacet[]
}

const appendFacetOnParent = <TParent extends StandardComponent, TFacetList, TFacet>(
    parent: TParent,
    accessor: FacetListSessionAccessor<TParent, TFacetList, TFacet>,
    ref: StandardReference
): void => {
    const list = accessor.getFacetList(parent)
    const next = accessor.appendReferenceIfNew(list, ref)
    if (next) {
        accessor.setFacetList(parent, next)
    }
}

export interface FacetListSessionEditorProps<
    TParent extends StandardComponent,
    TFacet,
    TFacetList extends FacetListWithItems<TFacet>
> extends Pick<
    FacetListEditorGenericProps<TFacet>,
    | "title"
    | "createFacetWithPayload"
    | "tag"
    | "renderFacetRow"
    | "addLabel"
    | "emptyStateText"
    | "affordance"
> {
    facetListAccessor: FacetListSessionAccessor<TParent, TFacetList, TFacet>
    rebuildFacetList: (items: TFacet[]) => TFacetList
    disabled?: boolean
    isExcludedExtra?: (id: ComponentUUID) => boolean
}

/**
 * Context-only facet list editor for WorkbenchComponentProvider sessions.
 * Thin wrapper over FacetListEditorGeneric; facetListAccessor maps to facets +
 * onFacetsChange on parent working.
 */
export const FacetListSessionEditor = <
    TParent extends StandardComponent,
    TFacet,
    TFacetList extends FacetListWithItems<TFacet>
>({
    title,
    facetListAccessor,
    rebuildFacetList,
    createFacetWithPayload,
    tag,
    renderFacetRow,
    addLabel,
    emptyStateText,
    affordance,
    disabled: disabledProp,
    isExcludedExtra
}: FacetListSessionEditorProps<TParent, TFacet, TFacetList>): React.ReactElement | null => {
    const {
        working,
        updateComponent,
        readonly: sessionReadonly,
        missing
    } = useWorkbenchComponent<TParent>()
    const { materializeComponentInAsset } = useWorkbenchAsset()

    const disabled = disabledProp ?? sessionReadonly

    const facetList = useMemo(() => {
        if (!working) {
            return rebuildFacetList([])
        }
        return facetListAccessor.getFacetList(working)
    }, [working, facetListAccessor, rebuildFacetList])

    const facets = facetList.items

    const onFacetsChange = useCallback(
        (newItems: TFacet[]) => {
            if (disabled || missing) {
                return
            }
            updateComponent((draft) => {
                facetListAccessor.setFacetList(draft, rebuildFacetList(newItems))
            })
        },
        [disabled, missing, updateComponent, facetListAccessor, rebuildFacetList]
    )

    const onAssociateReference = useCallback(
        (ref: StandardReference) => {
            if (disabled || missing) {
                return
            }
            updateComponent((draft) => {
                appendFacetOnParent(draft, facetListAccessor, ref)
            })
        },
        [disabled, missing, updateComponent, facetListAccessor]
    )

    const association = useCallback(
        (ref: StandardReference, draft: StandardForm) => {
            if (!working?.universalKey) {
                return
            }
            const parentInDraft = draft.byUniversalId[working.universalKey]
            if (parentInDraft) {
                appendFacetOnParent(parentInDraft as TParent, facetListAccessor, ref)
            }
        },
        [working, facetListAccessor]
    )

    const requestCreate = useCallback(
        (onCreated: (ref: StandardReference) => void) => {
            if (disabled || missing) {
                return
            }
            const enforceKey = enforceTypedKey(
                tag.toUpperCase() as
                    | "ASSET"
                    | "AREA"
                    | "CHARACTER"
                    | "ROOM"
                    | "FEATURE"
                    | "KNOWLEDGE"
                    | "MAP"
                    | "MESSAGE"
                    | "MOMENT"
                    | "IMAGE"
                    | "MARK"
                    | "LENS"
                    | "SITUATION"
            )
            const uuid = tag === "Situation" ? `situation-${Date.now()}` : uuidv4()
            const universalKey = enforceKey(uuid) as ComponentUUID

            void (async () => {
                const ref = await materializeComponentInAsset({ universalKey })
                onCreated(ref)
            })()
        },
        [disabled, missing, tag, materializeComponentInAsset]
    )

    const isExcluded = useCallback(
        (id: ComponentUUID) => {
            if (facets.some((f) => {
                const facetRef = (f as { reference?: { universalKey?: ComponentUUID } }).reference
                return facetRef?.universalKey === id
            })) {
                return true
            }
            return isExcludedExtra ? isExcludedExtra(id) : false
        },
        [facets, isExcludedExtra]
    )

    if (missing || !working) {
        return null
    }

    return (
        <FacetListEditorGeneric<TFacet>
            title={title}
            facets={facets}
            onFacetsChange={onFacetsChange}
            createFacetWithPayload={createFacetWithPayload}
            tag={tag}
            renderFacetRow={renderFacetRow}
            readonly={disabled}
            addLabel={addLabel}
            emptyStateText={emptyStateText}
            isExcluded={isExcluded}
            association={association}
            requestCreate={requestCreate}
            onAssociateReference={onAssociateReference}
            affordance={affordance}
        />
    )
}

export default FacetListSessionEditor as FunctionComponent<
    FacetListSessionEditorProps<StandardComponent, unknown, FacetListWithItems<unknown>>
>

export type { FacetRowHandlers }
