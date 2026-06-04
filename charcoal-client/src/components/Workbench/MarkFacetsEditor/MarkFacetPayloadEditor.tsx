import React, { FunctionComponent, useState, useEffect, useMemo, useCallback } from "react"
import Box from "@mui/material/Box"
import TextField from "@mui/material/TextField"
import Typography from "@mui/material/Typography"
import { StandardMarkFacet } from "@tonylb/mtw-wml/ts/standardize/keys/facets/mark"
import { useDebouncedOnChange } from "../../../hooks/useDebounce"
import type { ScopedInstrumentationOptions } from "../../../testing/scopedInstrumentation"

export interface MarkFacetPayloadEditorProps {
    facet: StandardMarkFacet
    onChange: (newPayload: string) => void
    readonly?: boolean
    /** Human-readable label for the referenced Mark (e.g. shortName). Display only, not identity. */
    referenceDisplayName?: string
    options?: ScopedInstrumentationOptions
}

/** Extract displayable string from Mark facet payload (Plain string, or Remove/Replace object from round-trip). */
const payloadDisplay = (facet: StandardMarkFacet): string => {
    const payload = facet.payload
    if (!payload) return ""
    const json = (payload as { toJSON?: () => unknown }).toJSON?.()
    if (typeof json === "string") return json
    if (json && typeof json === "object" && "payload" in json) return String((json as { payload: unknown }).payload ?? "")
    if (json && typeof json === "object" && "match" in json) return String((json as { match: unknown }).match ?? "")
    return String(json ?? "")
}

export const MarkFacetPayloadEditor: FunctionComponent<MarkFacetPayloadEditorProps> = ({
    facet,
    onChange,
    readonly = false,
    referenceDisplayName,
    options
}) => {
    const label = referenceDisplayName ?? "Mark"

    const incomingValue = useMemo(() => payloadDisplay(facet), [facet])
    const [localValue, setLocalValue] = useState<string>(incomingValue)

    useEffect(() => {
        setLocalValue(incomingValue)
    }, [incomingValue])

    useDebouncedOnChange({
        value: localValue,
        delay: 1000,
        onChange: (newValue: string) => {
            if (readonly) return
            if (newValue === incomingValue) return
            onChange(newValue)
        },
        options
    })

    const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setLocalValue(event.target.value)
    }, [])

    return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
            <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
                {label}:
            </Typography>
            <TextField
                size="small"
                placeholder="Match value"
                value={localValue}
                onChange={handleChange}
                disabled={readonly}
                fullWidth
                variant="outlined"
                sx={{ minWidth: 0 }}
            />
        </Box>
    )
}

export default MarkFacetPayloadEditor
