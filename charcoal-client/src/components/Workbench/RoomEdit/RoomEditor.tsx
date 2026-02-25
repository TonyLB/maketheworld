import React, { FunctionComponent, useMemo, useCallback } from 'react'
import { Box, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material'
import VisibilityIcon from '@mui/icons-material/Visibility'

import { useWorkbenchAsset } from '../foundations/useWorkbenchAsset'
import ExitEditor from './ExitEditor'
import LensEditor from './LensEditor'
import FeatureListEditor from './FeatureListEditor'
import { useOnboardingCheckpoint } from '../../Onboarding/useOnboarding'

import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { useSelector, useDispatch } from 'react-redux'
import { getCurrentComponentId, pushBreadcrumb } from '../../../slices/UI/workbench'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import { StandardLens } from '@tonylb/mtw-wml/ts/standardize/components/worldState'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardLiteral } from '@tonylb/mtw-wml/ts/standardize/literal'
import { ReferenceList } from '@tonylb/mtw-wml/ts/standardize/keys/referenceList'
import { TopLevelStandardLiteralEditor } from '../foundations/StandardLiteral'
import Spacer from '../WorkbenchSpacer'
import { ReferenceListEditor } from '../foundations/ReferenceList'

export const RoomEditor: FunctionComponent = () => {
    const dispatch = useDispatch()
    const { standardForm, updateStandard, readonly } = useWorkbenchAsset()
    const currentComponentId = useSelector(getCurrentComponentId)

    const universalKey = useMemo<ComponentUUID | undefined>(() => {
        if (!currentComponentId) return undefined
        return currentComponentId as ComponentUUID
    }, [currentComponentId])

    const room = useMemo<StandardRoom | undefined>(() => {
        if (!universalKey) return undefined
        const c = standardForm.byUniversalId[universalKey]
        if (c && c instanceof StandardRoom) return c
        return undefined
    }, [universalKey, standardForm])

    const singleLens = useMemo(() => {
        if (!room) return null
        const lensRefs = room.lenses.payload || []
        if (lensRefs.length !== 1) return null
        const ref = lensRefs[0]
        if (!ref?.universalKey) return null
        const c = standardForm.byUniversalId[ref.universalKey]
        if (c && c instanceof StandardLens) return c
        return null
    }, [room, standardForm])

    const canOpenPreview = useMemo(() => {
        if (!singleLens) return false
        const markRefs = singleLens.marks.payload || []
        return markRefs.length >= 1
    }, [singleLens])

    const handlePreviewClick = useCallback(() => {
        if (!universalKey || !canOpenPreview || readonly) return
        dispatch(pushBreadcrumb({
            id: `preview:${universalKey}`,
            kind: 'component',
            componentId: `preview:${universalKey}`
        }))
    }, [universalKey, canOpenPreview, readonly, dispatch])

    useOnboardingCheckpoint('navigateRoom', { requireSequence: true })
    useOnboardingCheckpoint('navigateAssetWithImport', { requireSequence: true })

    const examplesListContext = useCallback(
        (form: StandardForm) => {
            const base = form.byUniversalId[universalKey!]
            if (!base || !(base instanceof StandardRoom)) return null
            const examples = base._payload._examples ?? new ReferenceList([])
            return {
                referenceList: examples,
                setReferenceList: (list: ReferenceList) => {
                    base._payload._examples = list
                }
            }
        },
        [universalKey]
    )

    const handleExamplesItemClick = useCallback(
        (id: string) => {
            if (!room || readonly) return
            dispatch(pushBreadcrumb({ id: id as ComponentUUID, kind: 'component', componentId: id as ComponentUUID }))
        },
        [room, readonly, dispatch, universalKey]
    )

    const guidanceListContext = useCallback(
        (form: StandardForm) => {
            const base = form.byUniversalId[universalKey!]
            if (!base || !(base instanceof StandardRoom)) return null
            const guidance = base._payload._guidance ?? new ReferenceList([])
            return {
                referenceList: guidance,
                setReferenceList: (list: ReferenceList) => {
                    base._payload._guidance = list
                }
            }
        },
        [universalKey]
    )

    const handleGuidanceItemClick = useCallback(
        (id: string) => {
            if (!room || readonly) return
            dispatch(pushBreadcrumb({ id: id as ComponentUUID, kind: 'component', componentId: id as ComponentUUID }))
        },
        [room, readonly, dispatch, universalKey]
    )

    if (!universalKey || !(universalKey in standardForm.byUniversalId) || !room) {
        return <Box />
    }

    return (
        <Box sx={{ width: "100%", display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
            <Box sx={{ flexGrow: 1, position: "relative", width: "100%", overflowY: 'auto' }}>
                <Box sx={{ padding: 2 }}>
                    <Box sx={{
                        marginLeft: '0.5em',
                        marginTop: '0.5em',
                        display: 'flex',
                        flexDirection: 'column',
                        rowGap: '0.25em',
                        width: "calc(100% - 0.5em)",
                        position: 'relative'
                    }}>
                        <TopLevelStandardLiteralEditor
                            value={room.shortName ?? new StandardLiteral('')}
                            onChange={(newShortName) => {
                                updateStandard({
                                    type: 'update',
                                    update: (incoming: StandardForm) => {
                                        const base = incoming.byUniversalId[universalKey]
                                        if (base instanceof StandardRoom) {
                                            base._payload._shortName = newShortName
                                        }
                                        return incoming
                                    }
                                })
                            }}
                            label="Short Name"
                            placeholder="Enter short name..."
                            size="small"
                        />
                        <Spacer />
                        <ExitEditor RoomId={universalKey} />
                        <LensEditor RoomId={universalKey} />
                        <FeatureListEditor RoomId={universalKey} />
                        <Box sx={{ marginTop: '0.5em' }}>
                            <ReferenceListEditor
                                title="Examples"
                                listContext={examplesListContext}
                                tag="Example"
                                disabled={readonly}
                                onItemClick={handleExamplesItemClick}
                            />
                        </Box>
                        <Box sx={{ marginTop: '0.5em' }}>
                            <ReferenceListEditor
                                title="Guidance"
                                listContext={guidanceListContext}
                                tag="Guidance"
                                disabled={readonly}
                                onItemClick={handleGuidanceItemClick}
                            />
                        </Box>
                        <Box sx={{ marginTop: '0.5em' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>Preview</Typography>
                            {canOpenPreview ? (
                                <ListItemButton
                                    onClick={handlePreviewClick}
                                    disabled={readonly}
                                    sx={{ borderRadius: 1, border: '1px solid', borderColor: 'divider' }}
                                >
                                    <ListItemIcon sx={{ minWidth: 36 }}>
                                        <VisibilityIcon fontSize="small" />
                                    </ListItemIcon>
                                    <ListItemText primary="Open Preview" secondary="Propose mark state and see cached result" />
                                </ListItemButton>
                            ) : (
                                <Typography variant="body2" color="text.secondary">
                                    Add a Lens with Marks to use Preview.
                                </Typography>
                            )}
                        </Box>
                    </Box>
                </Box>
            </Box>
        </Box>
    )
}

export default RoomEditor
