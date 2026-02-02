import React, { FunctionComponent, ReactNode } from "react"
import Box from "@mui/material/Box"
import ListItem from "@mui/material/ListItem"
import { FacetListAffordance } from "./affordancePrimitives"
import "../../../../theme/extensions"

export interface SingleLineFacetRowProps {
    /**
     * Content to show in the payload area. Wrapper does not interpret it.
     */
    payloadSlot: ReactNode
    /**
     * Called when remove is clicked. When omitted or when readonly, remove is not rendered.
     */
    onRemove?: () => void
    readonly?: boolean
}

export const SingleLineFacetRow: FunctionComponent<SingleLineFacetRowProps> = ({
    payloadSlot,
    onRemove,
    readonly = false
}) => (
    <ListItem
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
        <Box
            sx={{
                display: "flex",
                alignItems: "center",
                width: "100%",
                padding: 1,
                gap: 0
            }}
        >
            <Box sx={{ flex: 1, minWidth: 0 }}>{payloadSlot}</Box>
            {onRemove && !readonly && (
                <FacetListAffordance.Remove onRemove={onRemove} disabled={readonly} />
            )}
        </Box>
    </ListItem>
)

export default SingleLineFacetRow
