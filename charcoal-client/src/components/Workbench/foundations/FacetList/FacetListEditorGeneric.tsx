import React, { FunctionComponent, useCallback, useState } from "react"
import Box from "@mui/material/Box"
import List from "@mui/material/List"
import ListItem from "@mui/material/ListItem"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemIcon from "@mui/material/ListItemIcon"
import ListItemText from "@mui/material/ListItemText"
import Typography from "@mui/material/Typography"
import AddIcon from "@mui/icons-material/Add"

import { MakeTheWorldAccordion } from "../../../UI"
import { ComponentSelectorDialog } from "../ComponentSelector"
import type { ComponentTag } from "../ReferenceList/ReferenceListEditor"
import { ComponentUUID } from "@tonylb/mtw-base/ts/schema"
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
    createEmptyFacet: (universalKey: ComponentUUID) => TFacet
    createFacetWithPayload?: (facet: TFacet, newPayload: unknown) => TFacet
    tag: ComponentTag
    renderFacetRow: (facet: TFacet, index: number, handlers: FacetRowHandlers) => React.ReactNode
    readonly?: boolean
    addLabel?: string
    emptyStateText?: string
    isExcluded?: (id: ComponentUUID) => boolean
}

export function FacetListEditorGeneric<TFacet>({
    title,
    facets,
    onFacetsChange,
    createEmptyFacet,
    createFacetWithPayload,
    tag,
    renderFacetRow,
    readonly = false,
    addLabel,
    emptyStateText,
    isExcluded
}: FacetListEditorGenericProps<TFacet>): React.ReactElement {
    const [selectorOpen, setSelectorOpen] = useState(false)

    const handleAddClick = useCallback(() => {
        if (readonly) return
        setSelectorOpen(true)
    }, [readonly])

    const handleSelect = useCallback(
        (universalKey: ComponentUUID) => {
            if (readonly) return
            onFacetsChange([...facets, createEmptyFacet(universalKey)])
            setSelectorOpen(false)
        },
        [facets, createEmptyFacet, onFacetsChange, readonly]
    )

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
    const defaultAddLabel = `Add ${tag}`

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
                    {!readonly && (
                        <ListItem>
                            <ListItemButton
                                onClick={handleAddClick}
                                disabled={readonly}
                                sx={{ justifyContent: "center" }}
                            >
                                <ListItemIcon>
                                    <AddIcon />
                                </ListItemIcon>
                                <ListItemText primary={addLabel ?? defaultAddLabel} />
                            </ListItemButton>
                        </ListItem>
                    )}
                </List>
            </MakeTheWorldAccordion>
            <ComponentSelectorDialog
                open={selectorOpen}
                onClose={() => setSelectorOpen(false)}
                tag={tag}
                onSelect={handleSelect}
                isExcluded={isExcluded}
            />
        </>
    )
}

export default FacetListEditorGeneric
