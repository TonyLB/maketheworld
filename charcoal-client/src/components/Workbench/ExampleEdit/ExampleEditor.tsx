import React, { FunctionComponent, useCallback, useMemo } from "react"
import { useWorkbenchAsset } from "../foundations/useWorkbenchAsset"
import StandardExample from "@tonylb/mtw-wml/ts/standardize/components/example";
import { Box, Button, Typography } from "@mui/material";
import { MakeTheWorldAccordion } from "../../UI";
import { StandardLiteral } from "@tonylb/mtw-wml/ts/standardize/literal";
import { StandardRender } from "@tonylb/mtw-wml/ts/standardize/render";
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize";
import { TopLevelStandardLiteralEditor } from "../foundations/StandardLiteral";
import { StandardRenderEditor } from "../foundations/StandardRender";
import { ComponentUUID } from "@tonylb/mtw-base/ts/schema";

type ExampleEditorProps = {
    componentId: ComponentUUID;
}

export const ExampleEditor: FunctionComponent<ExampleEditorProps> = ({ componentId }) => {
    const { standardForm, localStandardForm, updateStandard, readonly } = useWorkbenchAsset()
    const component = useMemo<StandardExample>(() => {
        const component = standardForm.byUniversalId[componentId]
        if (component && component instanceof StandardExample) {
            return component
        }
        return new StandardExample({
            universalKey: componentId,
            tag: 'Example'
        })
    }, [standardForm, componentId])
    const inherited = !Boolean(localStandardForm.byUniversalId[componentId])

    const handleShortNameChange = useCallback(
        (newShortName: StandardLiteral) => {
            if (!componentId || readonly) return
            const currentExample = standardForm.byUniversalId[componentId]
            if (!currentExample || !(currentExample instanceof StandardExample)) return
            const newValue = newShortName._payload?.plain?.toJSON() ?? ''
            const currentValue = currentExample.shortName?._payload?.plain?.toJSON() ?? ''
            if (currentValue === newValue || (!currentValue && !newValue)) return
            updateStandard({
                type: 'update',
                update: (draft: StandardForm) => {
                    const ex = draft.byUniversalId[componentId]
                    if (ex && ex instanceof StandardExample) {
                        ex._payload._shortName = newValue ? newShortName : undefined
                    }
                    return draft
                }
            })
        },
        [componentId, standardForm, updateStandard, readonly]
    )

    const handleDisplayNameChange = useCallback(
        (newDisplayName: StandardRender) => {
            if (!componentId || readonly) return
            const currentExample = standardForm.byUniversalId[componentId]
            if (!currentExample || !(currentExample instanceof StandardExample)) return
            const newValue = newDisplayName.toJSON() ?? []
            const currentValue = currentExample.displayName?.toJSON() ?? []
            if (JSON.stringify(currentValue) === JSON.stringify(newValue)) return
            updateStandard({
                type: 'update',
                update: (draft: StandardForm) => {
                    const ex = draft.byUniversalId[componentId]
                    if (ex && ex instanceof StandardExample) {
                        const isEmpty = !newValue || (Array.isArray(newValue) && newValue.length === 0)
                        ex._payload._displayName = isEmpty ? undefined : newDisplayName
                    }
                    return draft
                }
            })
        },
        [componentId, standardForm, updateStandard, readonly]
    )

    const handleSummaryChange = useCallback(
        (newSummary: StandardRender) => {
            if (!componentId || readonly) return
            const currentExample = standardForm.byUniversalId[componentId]
            if (!currentExample || !(currentExample instanceof StandardExample)) return
            const newValue = newSummary.toJSON() ?? []
            const currentValue = currentExample.summary?.toJSON() ?? []
            if (JSON.stringify(currentValue) === JSON.stringify(newValue)) return
            updateStandard({
                type: 'update',
                update: (draft: StandardForm) => {
                    const ex = draft.byUniversalId[componentId]
                    if (ex && ex instanceof StandardExample) {
                        const isEmpty = !newValue || (Array.isArray(newValue) && newValue.length === 0)
                        ex._payload._summary = isEmpty ? undefined : newSummary
                    }
                    return draft
                }
            })
        },
        [componentId, standardForm, updateStandard, readonly]
    )

    const handleDescriptionChange = useCallback(
        (newDescription: StandardRender) => {
            if (!componentId || readonly) return
            const currentExample = standardForm.byUniversalId[componentId]
            if (!currentExample || !(currentExample instanceof StandardExample)) return
            const newValue = newDescription.toJSON() ?? []
            const currentValue = currentExample.description?.toJSON() ?? []
            if (JSON.stringify(currentValue) === JSON.stringify(newValue)) return
            updateStandard({
                type: 'update',
                update: (draft: StandardForm) => {
                    const ex = draft.byUniversalId[componentId]
                    if (ex && ex instanceof StandardExample) {
                        const isEmpty = !newValue || (Array.isArray(newValue) && newValue.length === 0)
                        ex._payload._description = isEmpty ? undefined : newDescription
                    }
                    return draft
                }
            })
        },
        [componentId, standardForm, updateStandard, readonly]
    )

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {inherited && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                        Inherited from another asset
                    </Typography>
                    <Button size="small" variant="outlined" onClick={() => {}}>
                        Unlock for editing
                    </Button>
                </Box>
            )}
            <TopLevelStandardLiteralEditor
                value={component.shortName ?? new StandardLiteral('')}
                onChange={handleShortNameChange}
                label="Short Name"
                placeholder="Example short name..."
                size="small"
                readonly={readonly}
            />
            <MakeTheWorldAccordion title="Conditions">
                <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                    Mark facets will be shown here once facet rendering is implemented.
                </Typography>
            </MakeTheWorldAccordion>
            <MakeTheWorldAccordion title="Appearance" defaultExpanded>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
                    <StandardRenderEditor
                        title="Display Name"
                        value={component.displayName ?? new StandardRender([])}
                        onChange={handleDisplayNameChange}
                        validLinkTags={['Feature', 'Knowledge']}
                        toolbar={true}
                        placeholder="Enter a Display Name"
                        tag="DisplayName"
                    />
                    <StandardRenderEditor
                        title="Summary"
                        value={component.summary ?? new StandardRender([])}
                        onChange={handleSummaryChange}
                        validLinkTags={['Feature', 'Knowledge']}
                        toolbar={true}
                        placeholder="Enter a Summary"
                        tag="Summary"
                    />
                    <StandardRenderEditor
                        title="Description"
                        value={component.description ?? new StandardRender([])}
                        onChange={handleDescriptionChange}
                        validLinkTags={['Feature', 'Knowledge']}
                        toolbar={true}
                        placeholder="Enter a Description"
                        tag="Description"
                    />
                </Box>
            </MakeTheWorldAccordion>
        </Box>
    )
}

export default ExampleEditor
