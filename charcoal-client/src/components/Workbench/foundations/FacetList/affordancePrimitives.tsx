import React, { FunctionComponent } from "react"
import IconButton from "@mui/material/IconButton"
import DeleteIcon from "@mui/icons-material/Delete"

export interface FacetListAffordanceRemoveProps {
    onRemove: () => void
    disabled?: boolean
}

export const FacetListAffordanceRemove: FunctionComponent<FacetListAffordanceRemoveProps> = ({
    onRemove,
    disabled = false
}) => (
    <IconButton
        aria-label="remove"
        onClick={(e) => {
            e.stopPropagation()
            if (!disabled) onRemove()
        }}
        disabled={disabled}
        color="error"
        size="small"
        sx={{ flexShrink: 0 }}
    >
        <DeleteIcon fontSize="small" />
    </IconButton>
)

export const FacetListAffordance = {
    Remove: FacetListAffordanceRemove
} as const
