import React, { FunctionComponent, ReactNode, useCallback } from "react"
import Box from "@mui/material/Box"
import List from "@mui/material/List"
import ListItem from "@mui/material/ListItem"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemIcon from "@mui/material/ListItemIcon"
import ListItemText from "@mui/material/ListItemText"
import IconButton from "@mui/material/IconButton"
import Typography from "@mui/material/Typography"
import AddIcon from "@mui/icons-material/Add"
import DeleteIcon from "@mui/icons-material/Delete"

import { MakeTheWorldAccordion } from "../UI"
import type { WorkbenchReferenceListItem } from "./WorkbenchReferenceList"

/**
 * Affordances passed into the inline editor so the editor can place them (e.g. delete) where it makes sense.
 */
export interface InlineReferenceListAffordances {
    onRemove: () => void
    disabled: boolean
}

export interface WorkbenchInlineReferenceListProps {
    /**
     * Title for the accordion header.
     */
    title: string

    /**
     * Items to render inside the list.
     */
    items: WorkbenchReferenceListItem[]

    /**
     * Optional summary string or node shown in the accordion header when collapsed.
     */
    summary?: ReactNode

    /**
     * Whether the accordion should be expanded by default.
     */
    defaultExpanded?: boolean

    /**
     * Disable all interactions (add, remove, and inline editing).
     */
    disabled?: boolean

    /**
     * Called when the delete icon on an item is clicked.
     */
    onItemRemove?: (id: string) => void

    /**
     * Called when the "Add" row is clicked.
     */
    onAddClick?: () => void

    /**
     * Label for the "Add" row.
     * Defaults to "Add" if not provided.
     */
    addLabel?: string

    /**
     * Message to show when there are no items.
     */
    emptyStateText?: string

    /**
     * When provided, renders the full item content (no separate header row).
     * Receives the item id and affordances (onRemove, disabled); the editor decides where to render them for a compact layout.
     */
    renderItemEditor?: (id: string, affordances: InlineReferenceListAffordances) => ReactNode
}

export const WorkbenchInlineReferenceList: FunctionComponent<WorkbenchInlineReferenceListProps> = ({
    title,
    items,
    summary,
    defaultExpanded = false,
    disabled = false,
    onItemRemove,
    onAddClick,
    addLabel = "Add",
    emptyStateText,
    renderItemEditor
}) => {
    const getAffordances = useCallback(
        (id: string): InlineReferenceListAffordances => ({
            onRemove: () => {
                if (disabled || !onItemRemove) return
                onItemRemove(id)
            },
            disabled
        }),
        [disabled, onItemRemove]
    )

    const handleAddClick = useCallback(
        () => {
            if (disabled || !onAddClick) {
                return
            }
            onAddClick()
        },
        [disabled, onAddClick]
    )

    const hasItems = items.length > 0

    return (
        <MakeTheWorldAccordion
            title={title}
            summary={summary}
            defaultExpanded={defaultExpanded}
            disabled={disabled}
        >
            <List>
                {hasItems ? (
                    items.map(({ id, title: itemTitle, subtitle, icon }) => (
                        <ListItem
                            key={id}
                            disablePadding
                            sx={{
                                border: "1px solid #e0e0e0",
                                borderRadius: "8px",
                                marginBottom: "8px",
                                backgroundColor: "white",
                                flexDirection: "column",
                                alignItems: "stretch"
                            }}
                        >
                            {renderItemEditor ? (
                                <Box
                                    sx={{
                                        width: "100%",
                                        padding: 1
                                    }}
                                >
                                    {renderItemEditor(id, getAffordances(id))}
                                </Box>
                            ) : (
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        width: "100%",
                                        padding: 1
                                    }}
                                >
                                    {icon && (
                                        <ListItemIcon sx={{ minWidth: 32 }}>
                                            {icon}
                                        </ListItemIcon>
                                    )}
                                    <ListItemText
                                        primary={
                                            <Typography variant="body1" noWrap>
                                                {itemTitle}
                                            </Typography>
                                        }
                                        secondary={
                                            subtitle ? (
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                    noWrap
                                                >
                                                    {subtitle}
                                                </Typography>
                                            ) : undefined
                                        }
                                        sx={{ flex: 1, minWidth: 0 }}
                                    />
                                    {onItemRemove && (
                                        <IconButton
                                            aria-label="remove"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                getAffordances(id).onRemove()
                                            }}
                                            disabled={disabled}
                                            color="error"
                                            size="small"
                                        >
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    )}
                                </Box>
                            )}
                        </ListItem>
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
                            {emptyStateText && (
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ textAlign: "center" }}
                                >
                                    {emptyStateText}
                                </Typography>
                            )}
                        </Box>
                    </ListItem>
                )}
                {onAddClick && (
                    <ListItem>
                        <ListItemButton
                            onClick={handleAddClick}
                            disabled={disabled}
                            sx={{ justifyContent: "center" }}
                        >
                            <ListItemIcon>
                                <AddIcon />
                            </ListItemIcon>
                            <ListItemText primary={addLabel} />
                        </ListItemButton>
                    </ListItem>
                )}
            </List>
        </MakeTheWorldAccordion>
    )
}

export default WorkbenchInlineReferenceList
