import React, { FunctionComponent } from "react"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import {
    StandardLensMarkFacet,
    LensMarkFacetPayload
} from "@tonylb/mtw-wml/ts/standardize/keys/facets/lensMark"
import { StandardLiteral } from "@tonylb/mtw-wml/ts/standardize/literal"
import { StandardLiteralEditor } from "../../foundations/StandardLiteral"

export interface LensMarkFacetPayloadEditorProps {
    facet: StandardLensMarkFacet
    onChange: (payload: LensMarkFacetPayload) => void
    readonly?: boolean
    /** Human-readable label for the referenced Mark (e.g. shortName). Falls back to key/universalKey when absent. */
    referenceDisplayName?: string
}

export const LensMarkFacetPayloadEditor: FunctionComponent<LensMarkFacetPayloadEditorProps> = ({
    facet,
    onChange,
    readonly = false,
    referenceDisplayName
}) => {
    const ref = facet.reference
    const label = referenceDisplayName ?? ref.key ?? ref.universalKey ?? "Mark"
    const value = facet.payload.default ?? new StandardLiteral("", { tag: "Default" })

    return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
            <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
                {label}:
            </Typography>
            <StandardLiteralEditor
                value={value}
                onChange={(newLiteral: StandardLiteral) => {
                    const v = newLiteral?._payload?.plain?.toJSON() ?? ""
                    onChange(
                        new LensMarkFacetPayload(v.trim() ? { default: newLiteral.toJSON() } : {})
                    )
                }}
                placeholder="Default value"
                readonly={readonly}
                fullWidth
                size="small"
                variant="outlined"
            />
        </Box>
    )
}

export default LensMarkFacetPayloadEditor
