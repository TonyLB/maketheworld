import React, { FunctionComponent } from "react"
import Box from "@mui/material/Box"
import TextField from "@mui/material/TextField"
import Typography from "@mui/material/Typography"
import { StandardMarkFacet } from "@tonylb/mtw-wml/ts/standardize/keys/facets/mark"

export interface MarkFacetPayloadEditorProps {
    facet: StandardMarkFacet
    onChange: (newPayload: string) => void
    readonly?: boolean
}

const payloadDisplay = (facet: StandardMarkFacet): string => {
    const payload = facet.payload
    if (!payload) return ""
    const json = (payload as { toJSON?: () => unknown }).toJSON?.()
    return typeof json === "string" ? json : String(json ?? "")
}

export const MarkFacetPayloadEditor: FunctionComponent<MarkFacetPayloadEditorProps> = ({
    facet,
    onChange,
    readonly = false
}) => {
    const ref = facet.reference
    const label = ref.key ?? ref.universalKey ?? "Mark"
    const value = payloadDisplay(facet)

    return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
            <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
                {label}:
            </Typography>
            <TextField
                size="small"
                placeholder="Match value"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={readonly}
                fullWidth
                variant="outlined"
                sx={{ minWidth: 0 }}
            />
        </Box>
    )
}

export default MarkFacetPayloadEditor
