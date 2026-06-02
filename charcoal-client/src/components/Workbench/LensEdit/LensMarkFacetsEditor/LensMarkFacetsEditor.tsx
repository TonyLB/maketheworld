import React, { FunctionComponent, useCallback } from "react"
import Box from "@mui/material/Box"
import IconButton from "@mui/material/IconButton"
import LinkIcon from "@mui/icons-material/Link"
import { useDispatch } from "react-redux"
import { ComponentUUID } from "@tonylb/mtw-base/ts/schema"
import { v4 as uuidv4 } from "uuid"
import { enforceTypedKey } from "@tonylb/mtw-utilities/ts/types"
import {
    LensMarkFacetList,
    StandardLensMarkFacet,
    LensMarkFacetPayload
} from "@tonylb/mtw-wml/ts/standardize/keys/facets/lensMark"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import StandardReference from "@tonylb/mtw-wml/ts/standardize/components/reference"
import { StandardLens } from "@tonylb/mtw-wml/ts/standardize/components/worldState"
import {
    FacetListEditorGeneric,
    FacetRowHandlers,
    SingleLineFacetRow
} from "../../foundations/FacetList"
import { useWorkbenchAsset } from "../../foundations/useWorkbenchAsset"
import { standardComponentFactory } from "@tonylb/mtw-wml/ts/standardize/componentFactory"
import { pushBreadcrumb } from "../../../../slices/UI/workbench"
import { LensMarkFacetPayloadEditor } from "./LensMarkFacetPayloadEditor"

function lensMarkDisplayName(facet: StandardLensMarkFacet, standardForm: StandardForm): string | undefined {
    const universalKey = facet.reference.universalKey
    if (!universalKey) return undefined
    const component = standardForm.byUniversalId[universalKey]
    if (!component || !(component as { shortName?: unknown }).shortName) return undefined
    const shortNameData = (component as { shortName?: { _payload?: { plain?: { toJSON?: () => unknown } } } })
        .shortName?._payload?.plain?.toJSON?.()
    if (typeof shortNameData === "string" && shortNameData.trim().length) return shortNameData
    return undefined
}

export interface LensMarkFacetsEditorProps {
    lensId: ComponentUUID
    marks: LensMarkFacetList
    onChange?: (marks: LensMarkFacetList) => void
    readonly?: boolean
}

export const LensMarkFacetsEditor: FunctionComponent<LensMarkFacetsEditorProps> = ({
    lensId,
    marks,
    onChange,
    readonly = false
}) => {
    const { standardForm, updateStandard } = useWorkbenchAsset()
    const dispatch = useDispatch()

    const isMarkExcluded = useCallback(
        (id: ComponentUUID) => marks.items.some((f) => f.reference.universalKey === id),
        [marks.items]
    )

    const markAssociation = useCallback(
        (ref: StandardReference, draft: StandardForm) => {
            const base = draft.byUniversalId[lensId]
            if (!base || !(base instanceof StandardLens)) {
                return
            }
            const universalKeyFromRef = ref.universalKey as ComponentUUID
            const already = base.marks.items.some(
                (f) => f.reference.universalKey === universalKeyFromRef
            )
            if (already) {
                return
            }
            const newFacet = new StandardLensMarkFacet({
                reference: ref.toJSON(),
                payload: {}
            })
            base._payload._marks = new LensMarkFacetList([...base.marks.items, newFacet])
        },
        [lensId]
    )

    const requestCreate = useCallback(
        (onCreated: (ref: StandardReference) => void) => {
            if (readonly) {
                return
            }
            const markKey = enforceTypedKey("MARK")
            const newMarkId = markKey(uuidv4()) as ComponentUUID
            const ref = new StandardReference({ universalKey: newMarkId, tag: "Mark" })

            updateStandard({
                type: "update",
                update: (draft: StandardForm) => {
                    const { component } = standardComponentFactory({
                        tag: "Mark",
                        universalKey: newMarkId
                    })
                    if (!component) {
                        return draft
                    }
                    draft.byUniversalId[newMarkId] = component
                    markAssociation(ref, draft)
                    return draft
                }
            })

            onCreated(ref)
        },
        [markAssociation, readonly, updateStandard]
    )

    return (
        <>
            <FacetListEditorGeneric<StandardLensMarkFacet>
                title="Marks"
                facets={marks.items}
                onFacetsChange={(newItems: StandardLensMarkFacet[]) =>
                    onChange?.(new LensMarkFacetList(newItems))
                }
                createFacetWithPayload={(
                    facet: StandardLensMarkFacet,
                    newPayload: unknown
                ) =>
                    new StandardLensMarkFacet({
                        reference: facet.reference.toJSON(),
                        payload:
                            (newPayload as LensMarkFacetPayload).toJSON?.() ??
                            (newPayload as Record<string, unknown>)
                    })
                }
                tag="Mark"
                association={markAssociation}
                requestCreate={requestCreate}
                affordance={{
                    addLabel: "Create new Mark",
                    referenceExistingLabel: "Reference existing Mark",
                    enableReferenceExisting: true,
                    enableImport: true
                }}
                renderFacetRow={(
                    facet: StandardLensMarkFacet,
                    index: number,
                    handlers: FacetRowHandlers
                ) => {
                    const universalKey = facet.reference.universalKey as
                        | ComponentUUID
                        | undefined

                    return (
                        <SingleLineFacetRow
                            payloadSlot={
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 0.5,
                                        minWidth: 0,
                                        width: "100%"
                                    }}
                                >
                                    {universalKey && (
                                        <IconButton
                                            size="small"
                                            aria-label="Open Mark"
                                            onClick={() =>
                                                dispatch(
                                                    pushBreadcrumb({
                                                        id: universalKey,
                                                        kind: "component",
                                                        componentId: universalKey
                                                    })
                                                )
                                            }
                                            disabled={readonly}
                                            sx={{ flexShrink: 0 }}
                                        >
                                            <LinkIcon fontSize="small" />
                                        </IconButton>
                                    )}
                                    <LensMarkFacetPayloadEditor
                                        facet={facet}
                                        onChange={handlers.onChangePayload}
                                        readonly={handlers.readonly}
                                        referenceDisplayName={lensMarkDisplayName(
                                            facet,
                                            standardForm
                                        )}
                                        markId={universalKey}
                                    />
                                </Box>
                            }
                            onRemove={handlers.onRemove}
                            readonly={handlers.readonly}
                        />
                    )
                }}
                readonly={readonly}
                emptyStateText="No marks. Add one to describe points of interest."
                isExcluded={isMarkExcluded}
            />
        </>
    )
}

export default LensMarkFacetsEditor
