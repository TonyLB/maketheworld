import React, { FunctionComponent, useCallback, useState } from "react"
import {
    Box,
    Typography,
    Button,
    List,
    ListItem,
    ListItemText,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField
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
    const [addDialogOpen, setAddDialogOpen] = useState(false)
    const [selectorOpen, setSelectorOpen] = useState(false)
    const [selectedMarkId, setSelectedMarkId] = useState<ComponentUUID | null>(null)
    const [matchValue, setMatchValue] = useState("")

    const handleAddMark = useCallback(() => {
        setSelectedMarkId(null)
        setMatchValue("")
        setAddDialogOpen(true)
    }, [])

    const handleRemoveMark = useCallback(
        (index: number) => {
            if (readonly || !onChange) return
            const newItems = marks.items.filter((_, i) => i !== index)
            onChange(new MarkFacetList(newItems))
        },
        [marks.items, onChange, readonly]
    )

    const handleSelectMark = useCallback((universalKey: ComponentUUID) => {
        setSelectedMarkId(universalKey)
        setSelectorOpen(false)
    }, [])

    const handleAddConfirm = useCallback(() => {
        if (!selectedMarkId || !onChange || readonly) return
        const reference = new StandardReference({ tag: "Mark", universalKey: selectedMarkId })
        const newFacet = new StandardMarkFacet({ reference, payload: matchValue })
        const newList = new MarkFacetList([...marks.items, newFacet])
        onChange(newList)
        setAddDialogOpen(false)
        setSelectedMarkId(null)
        setMatchValue("")
    }, [selectedMarkId, matchValue, marks.items, onChange, readonly])

    const handleAddDialogClose = useCallback(() => {
        setAddDialogOpen(false)
        setSelectedMarkId(null)
        setMatchValue("")
    }, [])

    const canAdd = Boolean(selectedMarkId) && Boolean(onChange) && !readonly

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

            <Dialog open={addDialogOpen} onClose={handleAddDialogClose} maxWidth="sm" fullWidth>
                <DialogTitle>Add Mark</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
                        <Box>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                Mark component
                            </Typography>
                            <Button
                                variant="outlined"
                                size="small"
                                onClick={() => setSelectorOpen(true)}
                            >
                                {selectedMarkId ? "Mark selected" : "Select Mark..."}
                            </Button>
                        </Box>
                        <TextField
                            label="Match"
                            value={matchValue}
                            onChange={(e) => setMatchValue(e.target.value)}
                            placeholder="Match value for this Mark"
                            size="small"
                            fullWidth
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleAddDialogClose}>Cancel</Button>
                    <Button onClick={handleAddConfirm} variant="contained" disabled={!canAdd}>
                        Add
                    </Button>
                </DialogActions>
            </Dialog>

            <ComponentSelectorDialog
                open={selectorOpen}
                onClose={() => setSelectorOpen(false)}
                tag="Mark"
                onSelect={handleSelectMark}
            />
        </Box>
    )
}

export default MarkFacetsEditor
