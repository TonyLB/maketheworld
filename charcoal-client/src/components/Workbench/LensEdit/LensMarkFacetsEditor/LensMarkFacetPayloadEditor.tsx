import React, { FunctionComponent } from "react"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import { ComponentUUID } from "@tonylb/mtw-base/ts/schema"
import {
    StandardLensMarkFacet,
    LensMarkFacetPayload
} from "@tonylb/mtw-wml/ts/standardize/keys/facets/lensMark"
import { StandardLiteral } from "@tonylb/mtw-wml/ts/standardize/literal"
import { StandardLiteralEditor } from "../../foundations/StandardLiteral"
import { MarkInlineEditorWithSession } from "../../MarkEdit/InlineEditor"

export interface LensMarkFacetPayloadEditorProps {
    facet: StandardLensMarkFacet
    onChange: (payload: LensMarkFacetPayload) => void
    readonly?: boolean
    /** Human-readable label for the referenced Mark when markId is absent. Display only, not identity. */
    referenceDisplayName?: string
    /** When provided, renders MarkInlineEditorWithSession for the Mark shortName. */
    markId?: ComponentUUID
}

export const LensMarkFacetPayloadEditor: FunctionComponent<LensMarkFacetPayloadEditorProps> = ({
    facet,
    onChange,
    readonly = false,
    referenceDisplayName,
    markId
}) => {
    const label = referenceDisplayName ?? "Mark"
    const value = facet.payload.default ?? new StandardLiteral("", { tag: "Default" })

    return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
            {markId ? (
                <Box sx={{ minWidth: 0, flexShrink: 0, maxWidth: "40%" }}>
                    <MarkInlineEditorWithSession markId={markId} />
                </Box>
            ) : (
                <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
                    {label}:
                </Typography>
            )}
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
