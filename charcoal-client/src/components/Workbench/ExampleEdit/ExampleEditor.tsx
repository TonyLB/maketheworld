import React, { FunctionComponent, useCallback, useMemo } from "react"
import { useSelector } from "react-redux"
import { useWorkbenchAsset } from "../foundations/useWorkbenchAsset"
import StandardExample from "@tonylb/mtw-wml/ts/standardize/components/example";
import { Box, Button, Typography } from "@mui/material";
import { MakeTheWorldAccordion } from "../../UI";
import { StandardLiteral } from "@tonylb/mtw-wml/ts/standardize/literal";
import { StandardRender } from "@tonylb/mtw-wml/ts/standardize/render";
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize";
import { defaultedEquals } from "@tonylb/mtw-wml/ts/standardize/components/utils";
import { TopLevelStandardLiteralEditor } from "../foundations/StandardLiteral";
import { StandardRenderEditor } from "../foundations/StandardRender";
import { ComponentUUID } from "@tonylb/mtw-base/ts/schema";
import { getCurrentComponentId, getCurrentComponentLayerId } from "../../../slices/UI/workbench";

/**
 * Example payload editor. Reads the current Example id from the workbench: when in
 * layered context (e.g. Room → Example) uses the layer id; otherwise the top breadcrumb.
 */
export const ExampleEditor: FunctionComponent = () => {
    const { standardForm, localStandardForm, updateStandard, readonly } = useWorkbenchAsset()
    const componentId = (useSelector(getCurrentComponentLayerId) ?? useSelector(getCurrentComponentId)) as ComponentUUID | null

    const component = useMemo<StandardExample>(() => {
        if (!componentId) return new StandardExample({ universalKey: '' as ComponentUUID, tag: 'Example' })
        const component = standardForm.byUniversalId[componentId]
        if (component && component instanceof StandardExample) {
            return component
        }
        return new StandardExample({
            universalKey: componentId,
            tag: 'Example'
        })
    }, [standardForm, componentId])
    const inherited = componentId ? !Boolean(localStandardForm.byUniversalId[componentId]) : false

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
        (newDisplayName: StandardLiteral) => {
            if (!componentId || readonly) return
            const currentExample = standardForm.byUniversalId[componentId]
            if (!currentExample || !(currentExample instanceof StandardExample)) return
            const newValue = newDisplayName._payload?.plain?.toJSON() ?? ''
            const currentValue = currentExample.displayName?._payload?.plain?.toJSON() ?? ''
            if (currentValue === newValue || (!currentValue && !newValue)) return
            updateStandard({
                type: 'update',
                update: (draft: StandardForm) => {
                    const ex = draft.byUniversalId[componentId]
                    if (ex && ex instanceof StandardExample) {
                        ex._payload._displayName = newValue ? newDisplayName : undefined
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
            if (defaultedEquals(currentExample.summary, newSummary)) return
            updateStandard({
                type: 'update',
                update: (draft: StandardForm) => {
                    const ex = draft.byUniversalId[componentId]
                    if (ex && ex instanceof StandardExample) {
                        ex._payload._summary = newSummary.isEmpty() ? undefined : newSummary
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
            if (defaultedEquals(currentExample.description, newDescription)) return
            updateStandard({
                type: 'update',
                update: (draft: StandardForm) => {
                    const ex = draft.byUniversalId[componentId]
                    if (ex && ex instanceof StandardExample) {
                        ex._payload._description = newDescription.isEmpty() ? undefined : newDescription
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
                    <TopLevelStandardLiteralEditor
                        value={component.displayName ?? new StandardLiteral('')}
                        onChange={handleDisplayNameChange}
                        label="Display Name"
                        placeholder="Enter a Display Name"
                        size="small"
                        readonly={readonly}
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
