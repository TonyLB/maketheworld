import React, { FunctionComponent, useCallback, useMemo } from "react"

import { ComponentUUID } from "@tonylb/mtw-base/ts/schema"
import StandardMark from "@tonylb/mtw-wml/ts/standardize/components/worldState"
import type { StandardComponent } from "@tonylb/mtw-wml/ts/standardize/components/baseClasses"
import { StandardLiteral } from "@tonylb/mtw-wml/ts/standardize/literal"

import { StandardLiteralEditor } from "../foundations/StandardLiteral"
import {
    literalPlainString,
    setWorkingShortNameFromString
} from "../foundations/workbenchMutations"
import {
    WorkbenchComponentProvider,
    useWorkbenchComponent
} from "../foundations/WorkbenchComponent"

export type MarkInlineEditorProps = Record<string, never>

const markGuard = (
    component: StandardComponent | undefined
): component is StandardMark => component instanceof StandardMark

/**
 * Context-only inline editor for a Mark's shortName (D7).
 * Requires WorkbenchComponentProvider scoped to the Mark componentId.
 * Description and remove affordances are handled elsewhere (detail view, list).
 */
export const MarkInlineEditor: FunctionComponent<MarkInlineEditorProps> = () => {
    const { working, updateComponent, readonly: sessionReadonly, missing } =
        useWorkbenchComponent<StandardMark>()

    const displayLiteral = useMemo(
        () => working?.shortName ?? new StandardLiteral(""),
        [working?.shortName]
    )

    const handleChange = useCallback(
        (newLiteral: StandardLiteral) => {
            updateComponent((draft) => {
                setWorkingShortNameFromString(draft, literalPlainString(newLiteral))
            })
        },
        [updateComponent]
    )

    if (missing || !working) {
        return null
    }

    return (
        <StandardLiteralEditor
            value={displayLiteral}
            onChange={handleChange}
            placeholder="Untitled"
            size="small"
            variant="outlined"
            readonly={sessionReadonly}
            debounce={false}
        />
    )
}

export interface MarkInlineEditorWithSessionProps {
    markId: ComponentUUID
    flushDelayMs?: number
}

/**
 * Per-row Mark session wrapper for inline list edit slots and facet rows.
 * Use in InlineReferenceList renderItemEditor(id) or facet rows that edit Mark shortName.
 */
export const MarkInlineEditorWithSession: FunctionComponent<MarkInlineEditorWithSessionProps> = ({
    markId,
    flushDelayMs = 1000
}) => (
    <WorkbenchComponentProvider
        componentId={markId}
        guard={markGuard}
        flushDelayMs={flushDelayMs}
    >
        <MarkInlineEditor />
    </WorkbenchComponentProvider>
)

export default MarkInlineEditor
