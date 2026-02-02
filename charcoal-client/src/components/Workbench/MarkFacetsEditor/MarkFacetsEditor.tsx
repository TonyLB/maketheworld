import React, { FunctionComponent } from "react"
import { ComponentUUID } from "@tonylb/mtw-base/ts/schema"
import { MarkFacetList, StandardMarkFacet } from "@tonylb/mtw-wml/ts/standardize/keys/facets/mark"
import StandardReference from "@tonylb/mtw-wml/ts/standardize/components/reference"
import {
    FacetListEditorGeneric,
    FacetRowHandlers,
    SingleLineFacetRow
} from "../foundations/FacetList"
import { MarkFacetPayloadEditor } from "./MarkFacetPayloadEditor"

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
}) => (
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

export default MarkFacetsEditor
