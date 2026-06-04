import React, { FunctionComponent, useCallback } from "react"
import { ComponentUUID } from "@tonylb/mtw-base/ts/schema"
import { MarkFacetList, StandardMarkFacet } from "@tonylb/mtw-wml/ts/standardize/keys/facets/mark"
import StandardReference from "@tonylb/mtw-wml/ts/standardize/components/reference"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { enforceTypedKey } from "@tonylb/mtw-utilities/ts/types"
import { v4 as uuidv4 } from "uuid"
import {
    FacetListEditorGeneric,
    FacetListSessionEditor,
    FacetRowHandlers,
    SingleLineFacetRow
} from "../foundations/FacetList"
import { useWorkbenchAsset } from "../foundations/useWorkbenchAsset"
import { useWorkbenchComponent } from "../foundations/WorkbenchComponent"
import StandardGuidance from "@tonylb/mtw-wml/ts/standardize/components/guidance"
import { MarkFacetPayloadEditor } from "./MarkFacetPayloadEditor"
import type { ScopedInstrumentationOptions } from "../../../testing/scopedInstrumentation"
import {
    appendMarkFacetIfNew,
    associateMarkFacetOnDraft,
    guidanceMarkFacetAccessor
} from "./markFacetAccessors"

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

const rebuildMarkFacetList = (items: StandardMarkFacet[]): MarkFacetList => new MarkFacetList(items)

export type MarkFacetsEditorSessionProps = {
    options?: ScopedInstrumentationOptions
}

export type MarkFacetsEditorControlledProps = {
    componentId: ComponentUUID
    marks: MarkFacetList
    onChange?: (marks: MarkFacetList) => void
    readonly?: boolean
    options?: ScopedInstrumentationOptions
}

export type MarkFacetsEditorProps = MarkFacetsEditorSessionProps | MarkFacetsEditorControlledProps

function isControlledProps(
    props: MarkFacetsEditorProps
): props is MarkFacetsEditorControlledProps {
    return "marks" in props && props.marks !== undefined
}

const MarkFacetsEditorSession: FunctionComponent<MarkFacetsEditorSessionProps> = ({ options }) => {
    const { standardForm } = useWorkbenchAsset()
    const { readonly: sessionReadonly } = useWorkbenchComponent<StandardGuidance>()

    const renderFacetRow = useCallback(
        (facet: StandardMarkFacet, _index: number, handlers: FacetRowHandlers) => (
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
        ),
        [standardForm, options]
    )

    return (
        <FacetListSessionEditor<StandardGuidance, StandardMarkFacet, MarkFacetList>
            title="Marks"
            facetListAccessor={guidanceMarkFacetAccessor}
            rebuildFacetList={rebuildMarkFacetList}
            createFacetWithPayload={(facet: StandardMarkFacet, newPayload: unknown) =>
                new StandardMarkFacet({ reference: facet.reference, payload: newPayload as string })
            }
            tag="Mark"
            renderFacetRow={renderFacetRow}
            affordance={{
                addLabel: "Create new Mark",
                referenceExistingLabel: "Reference existing Mark",
                enableReferenceExisting: true,
                enableImport: true
            }}
            emptyStateText="No marks specified (applies to all situations)"
            disabled={sessionReadonly}
        />
    )
}

const MarkFacetsEditorControlled: FunctionComponent<MarkFacetsEditorControlledProps> = ({
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
            associateMarkFacetOnDraft(componentId, ref, draft)
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

export const MarkFacetsEditor: FunctionComponent<MarkFacetsEditorProps> = (props) => {
    if (isControlledProps(props)) {
        return <MarkFacetsEditorControlled {...props} />
    }
    return <MarkFacetsEditorSession {...props} />
}

export default MarkFacetsEditor
