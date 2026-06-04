import React, { FunctionComponent, useCallback } from "react"
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
    FacetListSessionEditor,
    FacetRowHandlers,
    SingleLineFacetRow
} from "../../foundations/FacetList"
import { useWorkbenchAsset } from "../../foundations/useWorkbenchAsset"
import { useWorkbenchComponent } from "../../foundations/WorkbenchComponent"
import { StandardLens } from "@tonylb/mtw-wml/ts/standardize/components/worldState"
import { pushBreadcrumb } from "../../../../slices/UI/workbench"
import { LensMarkFacetPayloadEditor } from "./LensMarkFacetPayloadEditor"
import { lensMarkFacetAccessor } from "./lensMarkFacetAccessors"

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

const rebuildLensMarkFacetList = (items: StandardLensMarkFacet[]): LensMarkFacetList =>
    new LensMarkFacetList(items)

export const LensMarkFacetsEditor: FunctionComponent = () => {
    const { standardForm } = useWorkbenchAsset()
    const { readonly: sessionReadonly } = useWorkbenchComponent<StandardLens>()
    const dispatch = useDispatch()

    const renderFacetRow = useCallback(
        (
            facet: StandardLensMarkFacet,
            _index: number,
            handlers: FacetRowHandlers
        ) => {
            const universalKey = facet.reference.universalKey as ComponentUUID | undefined

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
                                    disabled={handlers.readonly}
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
                                markId={universalKey}
                            />
                        </Box>
                    }
                    onRemove={handlers.onRemove}
                    readonly={handlers.readonly}
                />
            )
        },
        [dispatch, standardForm]
    )

    return (
        <FacetListSessionEditor<StandardLens, StandardLensMarkFacet, LensMarkFacetList>
            title="Marks"
            facetListAccessor={lensMarkFacetAccessor}
            rebuildFacetList={rebuildLensMarkFacetList}
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
            renderFacetRow={renderFacetRow}
            affordance={{
                addLabel: "Create new Mark",
                referenceExistingLabel: "Reference existing Mark",
                enableReferenceExisting: true,
                enableImport: true
            }}
            emptyStateText="No marks. Add one to describe points of interest."
            disabled={sessionReadonly}
        />
    )
}

export default LensMarkFacetsEditor
