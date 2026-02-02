import React, { FunctionComponent, useCallback, useState } from "react"
import {
    Box,
    Typography,
    Button,
    List,
    ListItem,
    ListItemText,
    IconButton
} from "@mui/material"
import DeleteIcon from "@mui/icons-material/Delete"
import AddIcon from "@mui/icons-material/Add"
import { ComponentUUID } from "@tonylb/mtw-base/ts/schema"
import { MarkFacetList, StandardMarkFacet } from "@tonylb/mtw-wml/ts/standardize/keys/facets/mark"
import StandardReference from "@tonylb/mtw-wml/ts/standardize/components/reference"
import { ComponentSelectorDialog } from "../foundations/ComponentSelector"

export interface MarkFacetsEditorProps {
    componentId: ComponentUUID
    marks: MarkFacetList
    onChange?: (marks: MarkFacetList) => void
    readonly?: boolean
}

const matchDisplay = (facet: StandardMarkFacet): string => {
    const payload = facet.payload
    if (!payload) return ""
    const json = (payload as { toJSON?: () => unknown }).toJSON?.()
    return typeof json === "string" ? json : String(json ?? "")
}

export const MarkFacetsEditor: FunctionComponent<MarkFacetsEditorProps> = ({
    componentId,
    marks,
    onChange,
    readonly = false
}) => {
    const [selectorOpen, setSelectorOpen] = useState(false)

    const handleAddMark = useCallback(() => {
        setSelectorOpen(true)
    }, [])

    const handleAddMarkSelect = useCallback(
        (universalKey: ComponentUUID) => {
            if (readonly || !onChange) return
            const reference = new StandardReference({ tag: "Mark", universalKey })
            const newFacet = new StandardMarkFacet({ reference, payload: "" })
            onChange(new MarkFacetList([...marks.items, newFacet]))
        },
        [marks.items, onChange, readonly]
    )

    const handleRemoveMark = useCallback(
        (index: number) => {
            if (readonly || !onChange) return
            const newItems = marks.items.filter((_, i) => i !== index)
            onChange(new MarkFacetList(newItems))
        },
        [marks.items, onChange, readonly]
    )

    return (
        <Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Typography variant="subtitle1">Marks</Typography>
                {!readonly && (
                    <Button
                        startIcon={<AddIcon />}
                        onClick={handleAddMark}
                        size="small"
                    >
                        Add Mark
                    </Button>
                )}
            </Box>

            <List>
                {marks.items.map((facet, index) => {
                    const ref = facet.reference
                    const primary = ref.key ?? ref.universalKey ?? "Mark"
                    const secondary = `Match: ${matchDisplay(facet)}`
                    return (
                        <ListItem
                            key={`${componentId}-mark-${index}`}
                            secondaryAction={
                                !readonly && (
                                    <IconButton
                                        edge="end"
                                        aria-label="remove mark"
                                        onClick={() => handleRemoveMark(index)}
                                    >
                                        <DeleteIcon />
                                    </IconButton>
                                )
                            }
                        >
                            <ListItemText primary={primary} secondary={secondary} />
                        </ListItem>
                    )
                })}
            </List>

            {marks.items.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                    No marks specified (applies to all situations)
                </Typography>
            )}

            <ComponentSelectorDialog
                open={selectorOpen}
                onClose={() => setSelectorOpen(false)}
                tag="Mark"
                onSelect={handleAddMarkSelect}
                isExcluded={(id) => marks.items.some((f) => f.reference.universalKey === id)}
            />
        </Box>
    )
}

export default MarkFacetsEditor
