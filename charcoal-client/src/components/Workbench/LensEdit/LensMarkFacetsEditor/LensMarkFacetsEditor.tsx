import React, { FunctionComponent } from "react"
import Box from "@mui/material/Box"
import IconButton from "@mui/material/IconButton"
import LinkIcon from "@mui/icons-material/Link"
import { useDispatch } from "react-redux"
import { ComponentUUID } from "@tonylb/mtw-base/ts/schema"
import {
    LensMarkFacetList,
    StandardLensMarkFacet,
    LensMarkFacetPayload
} from "@tonylb/mtw-wml/ts/standardize/keys/facets/lensMark"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import {
    FacetListEditorGeneric,
    FacetRowHandlers,
    SingleLineFacetRow
} from "../../foundations/FacetList"
import { useWorkbenchAsset } from "../../foundations/useWorkbenchAsset"
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
    marks: LensMarkFacetList
    onChange?: (marks: LensMarkFacetList) => void
    readonly?: boolean
}

export const LensMarkFacetsEditor: FunctionComponent<LensMarkFacetsEditorProps> = ({
    marks,
    onChange,
    readonly = false
}) => {
    const { standardForm } = useWorkbenchAsset()
    const dispatch = useDispatch()

    return (
        <FacetListEditorGeneric<StandardLensMarkFacet>
            title="Marks"
            facets={marks.items}
            onFacetsChange={(newItems: StandardLensMarkFacet[]) => onChange?.(new LensMarkFacetList(newItems))}
            createEmptyFacet={(universalKey: ComponentUUID) =>
                new StandardLensMarkFacet({
                    reference: { tag: "Mark", universalKey },
                    payload: {}
                })
            }
            createFacetWithPayload={(facet: StandardLensMarkFacet, newPayload: unknown) =>
                new StandardLensMarkFacet({
                    reference: facet.reference.toJSON(),
                    payload:
                        (newPayload as LensMarkFacetPayload).toJSON?.() ??
                        (newPayload as Record<string, unknown>)
                })
            }
            tag="Mark"
            renderFacetRow={(facet: StandardLensMarkFacet, index: number, handlers: FacetRowHandlers) => (
                <SingleLineFacetRow
                    payloadSlot={
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0, width: "100%" }}>
                            {facet.reference.universalKey && (
                                <IconButton
                                    size="small"
                                    aria-label="Open Mark"
                                    onClick={() =>
                                        dispatch(
                                            pushBreadcrumb({
                                                id: facet.reference.universalKey as ComponentUUID,
                                                kind: "component",
                                                componentId: facet.reference.universalKey as ComponentUUID
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
                                referenceDisplayName={lensMarkDisplayName(facet, standardForm)}
                            />
                        </Box>
                    }
                    onRemove={handlers.onRemove}
                    readonly={handlers.readonly}
                />
            )}
            readonly={readonly}
            emptyStateText="No marks. Add one to describe points of interest."
            isExcluded={(id: ComponentUUID) => marks.items.some((f) => f.reference.universalKey === id)}
        />
    )
}

export default LensMarkFacetsEditor
