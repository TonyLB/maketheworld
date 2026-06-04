import React, { FunctionComponent, ReactNode, useCallback } from "react"
import Box from "@mui/material/Box"
import List from "@mui/material/List"
import ListItem from "@mui/material/ListItem"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemIcon from "@mui/material/ListItemIcon"
import ListItemText from "@mui/material/ListItemText"
import IconButton from "@mui/material/IconButton"
import Typography from "@mui/material/Typography"
import DeleteIcon from "@mui/icons-material/Delete"
import DeleteForeverIcon from "@mui/icons-material/DeleteForever"

import { MakeTheWorldAccordion } from "../../../UI"
import { ReferenceList } from "@tonylb/mtw-wml/ts/standardize/keys/referenceList"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { removeReferenceFromListById } from "./referenceListMutations"
import "../../../../theme/extensions"

export interface ReferenceListItem {
    id: string
    title: string
    subtitle?: string
    icon?: ReactNode
}

export interface ReferenceListContext {
    referenceList: ReferenceList
    standardForm: StandardForm
}

export interface ReferenceListEditorGenericProps {
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
     */
    summary?: ReactNode

    /**
     * Whether the accordion should be expanded by default.
     */
    defaultExpanded?: boolean

    /**
     * Disable all interactions (click, remove).
     */
    disabled?: boolean

    /**
     * Row styling: `contained` (default) = bordered cards; `table` = flat list rows.
     */
    variant?: "contained" | "table"

    /**
     * Called when a list item is clicked.
     */
    onItemClick?: (id: string) => void

    /**
     * Used for Remove when onItemRemove is not provided.
     * Generic derives remove handler: filters referenceList by id.
     */
    updateReferenceList?: (mutate: (ctx: ReferenceListContext) => void) => void

    /**
     * Called when the delete icon on an item is clicked.
     * When provided, takes precedence over updateReferenceList for remove.
     * Use when remove needs async confirm before disassociate (e.g. TopLevel orphan preview).
     */
    onItemRemove?: (id: string) => void

    /**
     * Called when the purge icon is clicked (explicit removeComponent from asset).
     * When provided, shows a second action beside row remove / disassociate.
     */
    onItemPurge?: (id: string) => void

    /**
     * Slot for Add/Import rows. Wrapper supplies the actual UI.
     */
    actionAffordances?: ReactNode
}

export const ReferenceListEditorGeneric: FunctionComponent<ReferenceListEditorGenericProps> = ({
    title,
    items,
    summary,
    defaultExpanded = false,
    disabled = false,
    variant = "contained",
    onItemClick,
    updateReferenceList,
    onItemRemove,
    onItemPurge,
    actionAffordances
}) => {
    const getItemRemoveHandler = useCallback(
        (id: string) => {
            if (onItemRemove) {
                return () => onItemRemove(id)
            }
            if (updateReferenceList) {
                return () => {
                    updateReferenceList(({ referenceList }) => {
                        removeReferenceFromListById(referenceList, id)
                    })
                }
            }
            return undefined
        },
        [onItemRemove, updateReferenceList]
    )

    const hasRemove = Boolean(onItemRemove ?? updateReferenceList)
    const hasPurge = Boolean(onItemPurge)
    const hasRowActions = hasRemove || hasPurge

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
            if (disabled) {
                return
            }
            const handler = getItemRemoveHandler(id)
            if (handler) {
                handler()
            }
        },
        [disabled, getItemRemoveHandler]
    )

    const handleItemPurge = useCallback(
        (id: string) => (event: React.MouseEvent) => {
            event.stopPropagation()
            if (disabled || !onItemPurge) {
                return
            }
            onItemPurge(id)
        },
        [disabled, onItemPurge]
    )

    const rowSecondaryActions = useCallback(
        (id: string) =>
            hasRowActions ? (
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
                    {hasPurge && (
                        <IconButton
                            edge="end"
                            aria-label="purge from asset"
                            onClick={handleItemPurge(id)}
                            disabled={disabled}
                            color="error"
                            size="small"
                        >
                            <DeleteForeverIcon fontSize="small" />
                        </IconButton>
                    )}
                    {hasRemove && (
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
                    )}
                </Box>
            ) : undefined,
        [hasRowActions, hasPurge, hasRemove, disabled, handleItemPurge, handleItemRemove]
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
                                secondaryAction={rowSecondaryActions(id)}
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
                                    sx={{ paddingRight: hasRowActions ? "5rem" : undefined }}
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
                                {hasRowActions && (
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            paddingRight: 1
                                        }}
                                    >
                                        {rowSecondaryActions(id)}
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
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ textAlign: "center" }}
                            >
                                No items yet.
                            </Typography>
                        </Box>
                    </ListItem>
                )}
                {actionAffordances}
            </List>
        </MakeTheWorldAccordion>
    )
}

export default ReferenceListEditorGeneric
