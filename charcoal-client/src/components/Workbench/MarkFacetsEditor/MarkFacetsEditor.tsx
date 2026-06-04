import React, { FunctionComponent, useCallback } from "react"
import { ComponentUUID } from "@tonylb/mtw-base/ts/schema"
import { MarkFacetList, StandardMarkFacet } from "@tonylb/mtw-wml/ts/standardize/keys/facets/mark"
import StandardReference from "@tonylb/mtw-wml/ts/standardize/components/reference"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import StandardGuidance from "@tonylb/mtw-wml/ts/standardize/components/guidance"
import StandardSituation from "@tonylb/mtw-wml/ts/standardize/components/situation"
import { enforceTypedKey } from "@tonylb/mtw-utilities/ts/types"
import { v4 as uuidv4 } from "uuid"
import {
    FacetListEditorGeneric,
    FacetRowHandlers,
    SingleLineFacetRow
} from "../foundations/FacetList"
import { useWorkbenchAsset } from "../foundations/useWorkbenchAsset"
import { MarkFacetPayloadEditor } from "./MarkFacetPayloadEditor"
import type { ScopedInstrumentationOptions } from "../../../testing/scopedInstrumentation"

function markDisplayName(facet: StandardMarkFacet, standardForm: StandardForm): string | undefined {
    const universalKey = facet.reference.universalKey
    if (!universalKey) return undefined
    const component = standardForm.byUniversalId[universalKey]
    if (!component || !(component as { shortName?: unknown }).shortName) return undefined
    const shortNameData = (component as { shortName?: { _payload?: { plain?: { toJSON?: () => unknown } } } })
        .shortName?._payload?.plain?.toJSON?.()
    if (typeof shortNameData === "string" && shortNameData.trim().length) return shortNameData
    return undefined
}

function appendMarkFacetIfNew(
    marks: MarkFacetList,
    ref: StandardReference
): MarkFacetList | null {
    const universalKeyFromRef = ref.universalKey as ComponentUUID
    const already = marks.items.some(
        (f) => f.reference.universalKey === universalKeyFromRef
    )
    if (already) {
        return null
    }
    const newFacet = new StandardMarkFacet({
        reference: ref.toJSON(),
        payload: ""
    })
    return new MarkFacetList([...marks.items, newFacet])
}

export interface MarkFacetsEditorProps {
    componentId: ComponentUUID
    marks: MarkFacetList
    onChange?: (marks: MarkFacetList) => void
    readonly?: boolean
    options?: ScopedInstrumentationOptions
}

export const MarkFacetsEditor: FunctionComponent<MarkFacetsEditorProps> = ({
    componentId,
    marks,
    onChange,
    readonly = false,
    options
}) => {
    const { standardForm, materializeComponentInAsset } = useWorkbenchAsset()

    const isMarkExcluded = useCallback(
        (id: ComponentUUID) => marks.items.some((f) => f.reference.universalKey === id),
        [marks.items]
    )

    const markAssociation = useCallback(
        (ref: StandardReference, draft: StandardForm) => {
            const base = draft.byUniversalId[componentId]
            if (!base || (!(base instanceof StandardGuidance) && !(base instanceof StandardSituation))) {
                return
            }
            const next = appendMarkFacetIfNew(base.marks, ref)
            if (next) {
                base._payload._marks = next
            }
        },
        [componentId]
    )

    const onAssociateReference = useCallback(
        (ref: StandardReference) => {
            if (readonly) {
                return
            }
            const next = appendMarkFacetIfNew(marks, ref)
            if (next) {
                onChange?.(next)
            }
        },
        [readonly, marks, onChange]
    )

    const requestCreate = useCallback(
        (onCreated: (ref: StandardReference) => void) => {
            if (readonly) {
                return
            }
            const markKey = enforceTypedKey("MARK")
            const newMarkId = markKey(uuidv4()) as ComponentUUID

            void (async () => {
                const ref = await materializeComponentInAsset({ universalKey: newMarkId })
                onCreated(ref)
            })()
        },
        [readonly, materializeComponentInAsset]
    )

    return (
        <FacetListEditorGeneric<StandardMarkFacet>
            title="Marks"
            facets={marks.items}
            onFacetsChange={(newItems: StandardMarkFacet[]) => onChange?.(new MarkFacetList(newItems))}
            createFacetWithPayload={(facet: StandardMarkFacet, newPayload: unknown) =>
                new StandardMarkFacet({ reference: facet.reference, payload: newPayload as string })
            }
            tag="Mark"
            association={markAssociation}
            requestCreate={requestCreate}
            onAssociateReference={onAssociateReference}
            affordance={{
                addLabel: "Create new Mark",
                referenceExistingLabel: "Reference existing Mark",
                enableReferenceExisting: true,
                enableImport: true
            }}
            renderFacetRow={(facet: StandardMarkFacet, index: number, handlers: FacetRowHandlers) => (
                <SingleLineFacetRow
                    payloadSlot={
                        <MarkFacetPayloadEditor
                            facet={facet}
                            onChange={handlers.onChangePayload}
                            readonly={handlers.readonly}
                            referenceDisplayName={markDisplayName(facet, standardForm)}
                            options={options}
                        />
                    }
                    onRemove={handlers.onRemove}
                    readonly={handlers.readonly}
                />
            )}
            readonly={readonly}
            emptyStateText="No marks specified (applies to all situations)"
            isExcluded={isMarkExcluded}
        />
    )
}

export default MarkFacetsEditor
