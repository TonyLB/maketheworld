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
import "../../theme/extensions"

const GAP_MIN_WIDTH = 96

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
     * When provided, renders only the inline-edit UI for each item (e.g. shortName field).
     * The list owns row layout: [ edit slot | gap | affordances ]. The editor must not render delete or other list-owned controls.
     */
    renderItemEditor?: (id: string) => ReactNode

    /**
     * When provided, the gap between edit slot and affordances is clickable; click navigates to the detailed editor for that item.
     */
    onItemClick?: (id: string) => void
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
    renderItemEditor,
    onItemClick
}) => {
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
                            sx={(theme) => {
                                const ex = (theme.palette as { extras?: { sectionHeaderBackground?: string; sectionBorder?: string } }).extras
                                return {
                                    border: `1px solid ${ex?.sectionBorder ?? "#e0e0e0"}`,
                                    borderRadius: "8px",
                                    marginBottom: "8px",
                                    backgroundColor: ex?.sectionHeaderBackground ?? "#ffcc80",
                                    flexDirection: "column",
                                    alignItems: "stretch"
                                }
                            }}
                        >
                            {renderItemEditor ? (
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        width: "100%",
                                        padding: 1,
                                        gap: 0
                                    }}
                                >
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        {renderItemEditor(id)}
                                    </Box>
                                    {onItemClick ? (
                                        <Box
                                            component="button"
                                            type="button"
                                            onClick={() => {
                                                if (disabled) return
                                                onItemClick(id)
                                            }}
                                            disabled={disabled}
                                            aria-label="Open detailed editor"
                                            sx={{
                                                flexShrink: 0,
                                                minWidth: GAP_MIN_WIDTH,
                                                height: 40,
                                                cursor: "pointer",
                                                border: "none",
                                                background: "transparent",
                                                padding: 0
                                            }}
                                        />
                                    ) : (
                                        <Box sx={{ flexShrink: 0, minWidth: GAP_MIN_WIDTH }} />
                                    )}
                                    {onItemRemove && (
                                        <IconButton
                                            aria-label="remove"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                if (disabled || !onItemRemove) return
                                                onItemRemove(id)
                                            }}
                                            disabled={disabled}
                                            color="error"
                                            size="small"
                                            sx={{ flexShrink: 0 }}
                                        >
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    )}
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
                                                if (disabled || !onItemRemove) return
                                                onItemRemove(id)
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
