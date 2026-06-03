import React, { FunctionComponent, useMemo } from 'react'
import { useSelector } from 'react-redux'
import { Box } from '@mui/material'

import { getAssetZone } from '../../slices/player'
import { useOnboardingCheckpoint } from '../Onboarding/useOnboarding'
import { useWorkbenchAsset } from './foundations/useWorkbenchAsset'
import { literalPlainString } from './foundations/workbenchMutations'
import {
    WorkbenchAssetMetaProvider,
    useWorkbenchAssetMeta
} from './foundations/WorkbenchAssetMeta/useWorkbenchAssetMeta'
import { WorkbenchAssetShortNameField } from './foundations/WorkbenchAssetMeta/WorkbenchAssetShortNameField'
import { WorkbenchAssetSummaryField } from './foundations/WorkbenchAssetMeta/WorkbenchAssetSummaryField'
import { MakeTheWorldAccordion } from '../UI'
import { TopLevelEditor } from './foundations/ReferenceList'

const AssetEditFormBody: FunctionComponent = () => {
    const { readonly } = useWorkbenchAsset()
    const { working } = useWorkbenchAssetMeta()

    const metadataDefaultExpanded = useMemo(() => {
        if (!working?.shortName) {
            return true
        }
        const shortNameValue = literalPlainString(working.shortName)
        return shortNameValue.trim() === ''
    }, [working?.shortName])

    return (
        <Box sx={{ position: 'relative', display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
            <Box sx={{ display: 'flex', position: 'relative', width: '100%', flexGrow: 1, overflowY: 'auto' }}>
                <Box sx={{ marginLeft: 2, marginRight: 2, width: 'calc(100% - 32px)' }}>
                    {!readonly && (
                        <MakeTheWorldAccordion title="Metadata" defaultExpanded={metadataDefaultExpanded}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <WorkbenchAssetShortNameField />
                                <WorkbenchAssetSummaryField />
                            </Box>
                        </MakeTheWorldAccordion>
                    )}

                    <TopLevelEditor title="Components" defaultExpanded={true} />
                </Box>
            </Box>
        </Box>
    )
}

export const AssetEditForm: FunctionComponent = () => {
    const { readonly, AssetId } = useWorkbenchAsset()
    const zone = useSelector(getAssetZone(AssetId))
    useOnboardingCheckpoint('navigateBackToDraft', { requireSequence: true, condition: zone === 'Draft' })

    return (
        <WorkbenchAssetMetaProvider>
            <AssetEditFormBody />
        </WorkbenchAssetMetaProvider>
    )
}

export default AssetEditForm
