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
     * When provided, renders an editing pane below each item's header.
     * Receives the item id (e.g. universalKey) and returns the editor content.
     */
    renderItemEditor?: (id: string) => ReactNode
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
    const handleItemRemove = useCallback(
        (id: string) => (event: React.MouseEvent) => {
            event.stopPropagation()
            if (disabled || !onItemRemove) {
                return
            }
            onItemRemove(id)
        },
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
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    width: "100%",
                                    paddingLeft: 1,
                                    paddingTop: 1,
                                    paddingBottom: renderItemEditor ? 0 : 1
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
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            paddingRight: 1
                                        }}
                                    >
                                        <IconButton
                                            edge="end"
                                            aria-label="remove"
                                            onClick={handleItemRemove(id)}
                                            disabled={disabled}
                                            color="error"
                                            size="small"
                                        >
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </Box>
                                )}
                            </Box>
                            {renderItemEditor && (
                                <Box
                                    sx={{
                                        width: "100%",
                                        paddingLeft: 1,
                                        paddingRight: 1,
                                        paddingBottom: 1,
                                        paddingTop: 0.5
                                    }}
                                >
                                    {renderItemEditor(id)}
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
