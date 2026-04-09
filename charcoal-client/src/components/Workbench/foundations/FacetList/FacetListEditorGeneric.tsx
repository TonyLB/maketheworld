import React, { useCallback } from "react"
import Box from "@mui/material/Box"
import List from "@mui/material/List"
import ListItem from "@mui/material/ListItem"
import Typography from "@mui/material/Typography"

import { MakeTheWorldAccordion } from "../../../UI"
import type { ComponentTag } from "../ReferenceList/ReferenceListEditor"
import { ComponentUUID } from "@tonylb/mtw-base/ts/schema"
import { useAddReferenceImport } from "../ReferenceList/AddReferenceImportControl"
import StandardReference from "@tonylb/mtw-wml/ts/standardize/components/reference"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import "../../../../theme/extensions"

export interface FacetRowHandlers {
    onRemove: () => void
    onChangePayload: (newPayload: unknown) => void
    readonly: boolean
}

export interface FacetListEditorGenericProps<TFacet> {
    title: string
    facets: TFacet[]
    onFacetsChange: (newFacets: TFacet[]) => void
    createFacetWithPayload?: (facet: TFacet, newPayload: unknown) => TFacet
    tag: ComponentTag
    renderFacetRow: (facet: TFacet, index: number, handlers: FacetRowHandlers) => React.ReactNode
    readonly?: boolean
    addLabel?: string
    emptyStateText?: string
    isExcluded?: (id: ComponentUUID) => boolean
    association: (ref: StandardReference, draft: StandardForm) => void
    requestCreate: (onCreated: (ref: StandardReference) => void) => void
    affordance?: {
        addLabel?: string
        referenceExistingLabel?: string
        enableReferenceExisting?: boolean
        enableImport?: boolean
    }
}

export function FacetListEditorGeneric<TFacet>({
    title,
    facets,
    onFacetsChange,
    createFacetWithPayload,
    tag,
    renderFacetRow,
    readonly = false,
    addLabel,
    emptyStateText,
    isExcluded,
    association,
    requestCreate,
    affordance
}: FacetListEditorGenericProps<TFacet>): React.ReactElement {
    const disabled = !!readonly

    const enableReferenceExisting = affordance?.enableReferenceExisting ?? true
    const enableImport = affordance?.enableImport ?? true
    const addButtonLabel = affordance?.addLabel ?? addLabel ?? `Add ${tag}`
    const refExistingLabel =
        affordance?.referenceExistingLabel ?? `Reference existing ${tag}`

    const safeIsExcluded = useCallback(
        (id: ComponentUUID) => (isExcluded ? isExcluded(id) : false),
        [isExcluded]
    )

    const {
        actionRows,
        selectorDialog: referenceSelectorDialog,
        importDialog
    } = useAddReferenceImport({
        tag,
        isExcluded: safeIsExcluded,
        association,
        requestCreate,
        labels: { add: addButtonLabel, referenceExisting: refExistingLabel },
        enableReferenceExisting,
        enableImport,
        disabled
    })

    const getHandlers = useCallback(
        (index: number, facet: TFacet): FacetRowHandlers => ({
            onRemove: () => {
                if (readonly) return
                const newFacets = facets.filter((_, i) => i !== index)
                onFacetsChange(newFacets)
            },
            onChangePayload: (newPayload: unknown) => {
                if (readonly || !createFacetWithPayload) return
                const newFacets = facets.map((f, i) =>
                    i === index ? createFacetWithPayload(f, newPayload) : f
                )
                onFacetsChange(newFacets)
            },
            readonly: !!readonly
        }),
        [facets, createFacetWithPayload, onFacetsChange, readonly]
    )

    const hasItems = facets.length > 0
    const defaultEmptyText = "No items yet."

    return (
        <>
            <MakeTheWorldAccordion title={title} defaultExpanded={hasItems}>
                <List>
                    {hasItems ? (
                        facets.map((facet, index) => (
                            <React.Fragment key={index}>
                                {renderFacetRow(facet, index, getHandlers(index, facet))}
                            </React.Fragment>
                        ))
                    ) : (
                        <ListItem>
                            <Box
                                sx={{
                                    width: "100%",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    gap: 1
                                }}
                            >
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ textAlign: "center" }}
                                >
                                    {emptyStateText ?? defaultEmptyText}
                                </Typography>
                            </Box>
                        </ListItem>
                    )}
                    {!readonly && actionRows}
                </List>
            </MakeTheWorldAccordion>
            {referenceSelectorDialog}
            {importDialog}
        </>
    )
}

export default FacetListEditorGeneric
