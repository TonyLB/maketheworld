import React, { FunctionComponent } from "react"
import Box from "@mui/material/Box"
import StandardMark from "@tonylb/mtw-wml/ts/standardize/components/worldState"
import { StandardLiteral } from "@tonylb/mtw-wml/ts/standardize/literal"
import { StandardRender } from "@tonylb/mtw-wml/ts/standardize/render"
import WorkbenchStandardLiteralEditor from "./StandardLiteralEditor"
import WorkbenchStandardRenderEditor from "./StandardRenderEditor"
import WorkbenchTitledBox from "./WorkbenchTitledBox"

export interface MarkInlineEditorProps {
    mark: StandardMark
    onShortNameChange: (value: StandardLiteral) => void
    onDescriptionChange: (value: StandardRender) => void
    disabled?: boolean
}

export const MarkInlineEditor: FunctionComponent<MarkInlineEditorProps> = ({
    mark,
    onShortNameChange,
    onDescriptionChange,
    disabled = false
}) => {
    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <WorkbenchTitledBox title="Short Name">
                <Box sx={{ padding: "0.5em" }}>
                    <WorkbenchStandardLiteralEditor
                        value={mark.shortName ?? new StandardLiteral("")}
                        onChange={onShortNameChange}
                        placeholder="Mark short name..."
                        size="small"
                        readonly={disabled}
                    />
                </Box>
            </WorkbenchTitledBox>
            <WorkbenchTitledBox title="Description">
                <Box sx={{ padding: "0.5em" }}>
                    <WorkbenchStandardRenderEditor
                        value={mark.description ?? new StandardRender([])}
                        onChange={onDescriptionChange}
                        validLinkTags={[]}
                        toolbar={false}
                    />
                </Box>
            </WorkbenchTitledBox>
        </Box>
    )
}

export default MarkInlineEditor
