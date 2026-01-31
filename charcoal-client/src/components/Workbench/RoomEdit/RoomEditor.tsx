import React, { FunctionComponent, useMemo, useCallback } from 'react'
import { Box } from '@mui/material'

import { useWorkbenchAsset } from '../foundations/useWorkbenchAsset'
import DraftLockout from '../DraftLockout'
import ExitEditor from './ExitEditor'
import LensEditor from './LensEditor'
import FeatureListEditor from './FeatureListEditor'
import { useOnboardingCheckpoint } from '../../Onboarding/useOnboarding'

import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { useSelector, useDispatch } from 'react-redux'
import { getCurrentComponentId, navigateToComponentLayer } from '../../../slices/UI/workbench'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
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
            dispatch(navigateToComponentLayer(universalKey!, id as ComponentUUID))
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
                    </Box>
                </Box>
                <DraftLockout />
            </Box>
        </Box>
    )
}

export default RoomEditor
