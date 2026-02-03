import React, { FunctionComponent } from "react"
import { ComponentUUID } from "@tonylb/mtw-base/ts/schema"
import { MarkFacetList, StandardMarkFacet } from "@tonylb/mtw-wml/ts/standardize/keys/facets/mark"
import StandardReference from "@tonylb/mtw-wml/ts/standardize/components/reference"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import {
    FacetListEditorGeneric,
    FacetRowHandlers,
    SingleLineFacetRow
} from "../foundations/FacetList"
import { useWorkbenchAsset } from "../foundations/useWorkbenchAsset"
import { MarkFacetPayloadEditor } from "./MarkFacetPayloadEditor"

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

export interface MarkFacetsEditorProps {
    componentId: ComponentUUID
    marks: MarkFacetList
    onChange?: (marks: MarkFacetList) => void
    readonly?: boolean
}

export const MarkFacetsEditor: FunctionComponent<MarkFacetsEditorProps> = ({
    componentId,
    marks,
    onChange,
    readonly = false
}) => {
    const { standardForm } = useWorkbenchAsset()
    return (
        <FacetListEditorGeneric<StandardMarkFacet>
            title="Marks"
            facets={marks.items}
            onFacetsChange={(newItems: StandardMarkFacet[]) => onChange?.(new MarkFacetList(newItems))}
            createEmptyFacet={(universalKey: ComponentUUID) =>
                new StandardMarkFacet({
                    reference: new StandardReference({ tag: "Mark", universalKey }),
                    payload: ""
                })
            }
            createFacetWithPayload={(facet: StandardMarkFacet, newPayload: unknown) =>
                new StandardMarkFacet({ reference: facet.reference, payload: newPayload as string })
            }
            tag="Mark"
            renderFacetRow={(facet: StandardMarkFacet, index: number, handlers: FacetRowHandlers) => (
                <SingleLineFacetRow
                    payloadSlot={
                        <MarkFacetPayloadEditor
                            facet={facet}
                            onChange={handlers.onChangePayload}
                            readonly={handlers.readonly}
                            referenceDisplayName={markDisplayName(facet, standardForm)}
                        />
                    }
                    onRemove={handlers.onRemove}
                    readonly={handlers.readonly}
                />
            )}
            readonly={readonly}
            emptyStateText="No marks specified (applies to all situations)"
            isExcluded={(id: ComponentUUID) => marks.items.some((f) => f.reference.universalKey === id)}
        />
    )
}

export default MarkFacetsEditor
