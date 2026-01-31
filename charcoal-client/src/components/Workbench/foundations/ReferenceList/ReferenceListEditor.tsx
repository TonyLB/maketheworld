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
import ImportExportIcon from "@mui/icons-material/ImportExport"

import { MakeTheWorldAccordion } from "../../../UI"
import "../../../../theme/extensions"

export interface ReferenceListItem {
    id: string
    title: string
    subtitle?: string
    icon?: ReactNode
}

export interface ReferenceListEditorProps {
    /**
     * Title for the accordion header.
     */
    title: string

    /**
     * Items to render inside the list.
     */
    items: ReferenceListItem[]

    /**
     * Optional summary string or node shown in the accordion header when collapsed.
     * Passed through to `MakeTheWorldAccordion.summary`.
     */
    summary?: ReactNode

    /**
     * Whether the accordion should be expanded by default.
     * Passed through to `MakeTheWorldAccordion.defaultExpanded`.
     */
    defaultExpanded?: boolean

    /**
     * Disable all interactions (click, add, remove).
     */
    disabled?: boolean

    /**
     * Called when a list item is clicked.
     */
    onItemClick?: (id: string) => void

    /**
     * Called when the delete icon on an item is clicked.
     */
    onItemRemove?: (id: string) => void

    /**
     * Called when the \"Add\" row is clicked.
     */
    onAddClick?: () => void

    /**
     * Label for the \"Add\" row.
     * Defaults to \"Add\" if not provided.
     */
    addLabel?: string

    /**
     * Message to show when there are no items.
     */
    emptyStateText?: string

    /**
     * Row styling: `contained` (default) = bordered cards; `table` = flat list rows.
     */
    variant?: "contained" | "table"

    /**
     * Called when the Import row is clicked.
     * When provided, an Import row is shown after the Add row.
     * Parent typically wires to open ImportComponentDialog (or equivalent).
     */
    onImportClick?: () => void

    /**
     * Label for the Import row.
     * Defaults to "Import" if not provided.
     */
    importLabel?: string
}

export const ReferenceListEditor: FunctionComponent<ReferenceListEditorProps> = ({
    title,
    items,
    summary,
    defaultExpanded = false,
    disabled = false,
    onItemClick,
    onItemRemove,
    onAddClick,
    addLabel = "Add",
    emptyStateText,
    variant = "contained",
    onImportClick,
    importLabel = "Import"
}) => {
    const handleItemClick = useCallback(
        (id: string) => () => {
            if (disabled || !onItemClick) {
                return
            }
            onItemClick(id)
        },
        [disabled, onItemClick]
    )

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

    const handleImportClick = useCallback(
        () => {
            if (disabled || !onImportClick) {
                return
            }
            onImportClick()
        },
        [disabled, onImportClick]
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
                    items.map(({ id, title: itemTitle, subtitle, icon }) =>
                        variant === "table" ? (
                            <ListItem
                                key={id}
                                disablePadding
                                secondaryAction={
                                    onItemRemove ? (
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
                                    ) : undefined
                                }
                            >
                                <ListItemButton
                                    onClick={handleItemClick(id)}
                                    disabled={disabled || !onItemClick}
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
                                    />
                                </ListItemButton>
                            </ListItem>
                        ) : (
                            <ListItem
                                key={id}
                                disablePadding
                                sx={(theme) => {
                                    const ex = (theme.palette as { extras?: { sectionHeaderBackground?: string; sectionBorder?: string } }).extras
                                    return {
                                        border: `1px solid ${ex?.sectionBorder ?? "#e0e0e0"}`,
                                        borderRadius: "8px",
                                        marginBottom: "8px",
                                        backgroundColor: ex?.sectionHeaderBackground ?? "#ffcc80"
                                    }
                                }}
                            >
                                <ListItemButton
                                    onClick={handleItemClick(id)}
                                    disabled={disabled || !onItemClick}
                                    sx={{ paddingRight: onItemRemove ? "3rem" : undefined }}
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
                                    />
                                </ListItemButton>
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
                            </ListItem>
                        )
                    )
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
                {onImportClick && (
                    <ListItem>
                        <ListItemButton
                            onClick={handleImportClick}
                            disabled={disabled}
                            sx={{ justifyContent: "center" }}
                            aria-label="Import component from another asset"
                        >
                            <ListItemIcon>
                                <ImportExportIcon />
                            </ListItemIcon>
                            <ListItemText primary={importLabel} />
                        </ListItemButton>
                    </ListItem>
                )}
            </List>
        </MakeTheWorldAccordion>
    )
}

export default ReferenceListEditor
