import React, { FunctionComponent, useMemo, useCallback, useState, useRef, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { Box, Typography } from '@mui/material'

import { getAssetZone } from '../../slices/player'
import { useOnboardingCheckpoint } from '../Onboarding/useOnboarding'
import { useWorkbenchAsset } from './foundations/useWorkbenchAsset'
import { StandardLiteralEditor } from './foundations/StandardLiteral'
import { StandardRenderEditor } from './foundations/StandardRender'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'
import { StandardRender } from '@tonylb/mtw-wml/ts/standardize/render'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { defaultedEquals } from '@tonylb/mtw-wml/ts/standardize/components/utils'
import { useDebouncedOnChange } from '../../hooks/useDebounce'
import { MakeTheWorldAccordion } from '../UI'
import { TopLevelEditor } from './foundations/ReferenceList'

export const AssetEditForm: FunctionComponent = () => {
    const { updateStandard, standardForm, readonly, AssetId } = useWorkbenchAsset()
    const zone = useSelector(getAssetZone(AssetId))
    useOnboardingCheckpoint('navigateBackToDraft', { requireSequence: true, condition: zone === 'Draft' })

    // Asset-level metadata editing (ShortName and Summary) - only for drafts
    const shortName = useMemo(() => 
        standardForm.shortName ?? new StandardLiteral(''), 
        [standardForm.shortName]
    )
    
    // Determine if Metadata accordion should default to open
    // Open if ShortName is not defined or is empty (to prompt user to enter it)
    const metadataDefaultExpanded = useMemo(() => {
        if (!standardForm.shortName) {
            return true // No ShortName defined, open accordion to prompt entry
        }
        const shortNameValue = shortName._payload?.plain?.toJSON() ?? ''
        return shortNameValue.trim() === '' // Empty ShortName, open accordion to prompt entry
    }, [standardForm.shortName, shortName])
    
    const [summary, setSummary] = useState(standardForm.summary ?? new StandardRender([]))
    const summaryRef = useRef(summary)
    
    useEffect(() => {
        summaryRef.current = summary
    }, [summary])
    
    useEffect(() => {
        const newSummary = standardForm.summary ?? new StandardRender([])
        const currentSummary = summaryRef.current
        if (!defaultedEquals(newSummary, currentSummary)) {
            setSummary(newSummary)
        }
    }, [standardForm.summary])

    const handleShortNameChange = useCallback((value: StandardLiteral) => {
        updateStandard({
            type: 'update',
            update: (draft: StandardForm) => {
                draft._shortName = value._payload?.plain?.toJSON() ? value : undefined
                return draft
            }
        })
    }, [updateStandard])

    useDebouncedOnChange({
        value: summary,
        delay: 1000,
        onChange: (value: StandardRender) => {
            updateStandard({
                type: 'update',
                update: (draft: StandardForm) => {
                    draft._summary = value.isEmpty() ? undefined : value
                    return draft
                }
            })
        }
    })

    return (
        <Box sx={{ position: "relative", display: 'flex', flexDirection: 'column', width: "100%", height: "100%" }}>
            <Box sx={{ display: 'flex', position: "relative", width: "100%", flexGrow: 1, overflowY: "auto" }}>
                <Box sx={{ marginLeft: 2, marginRight: 2, width: "calc(100% - 32px)" }}>
                    {!readonly && (
                        <MakeTheWorldAccordion title="Metadata" defaultExpanded={metadataDefaultExpanded}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <StandardLiteralEditor
                                    value={shortName}
                                    onChange={handleShortNameChange}
                                    label="Short Name"
                                    placeholder="Enter a short name for this draft"
                                    variant="outlined"
                                    readonly={readonly}
                                />
                                <Box>
                                    <Typography variant="subtitle2" sx={{ marginBottom: "0.5em" }}>Summary</Typography>
                                    <Box sx={{
                                        backgroundColor: 'background.paper',
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        borderRadius: '4px',
                                        padding: '0.5em'
                                    }}>
                                        <StandardRenderEditor
                                            value={summary}
                                            onChange={setSummary}
                                            validLinkTags={[]}
                                            toolbar={false}
                                            tag="Summary"
                                        />
                                    </Box>
                                </Box>
                            </Box>
                        </MakeTheWorldAccordion>
                    )}
                    
                    <TopLevelEditor title="Components" defaultExpanded={true} />
                </Box>
            </Box>
        </Box>
    )
}

export default AssetEditForm
