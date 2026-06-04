import React, { FunctionComponent, useMemo, useCallback } from 'react'
import { Box } from '@mui/material'

import { useWorkbenchAsset } from '../foundations/useWorkbenchAsset'
import DefaultRenderEditor from '../foundations/DefaultRenderEditor'
import ExitEditor from './ExitEditor'
import LensHeader from '../LensEdit/LensHeader'
import FeatureListEditor from './FeatureListEditor'
import RoomSituationsListEditor from './RoomSituationsListEditor'
import { useOnboardingCheckpoint } from '../../Onboarding/useOnboarding'

import { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { useSelector, useDispatch } from 'react-redux'
import { getCurrentComponentId, pushBreadcrumb } from '../../../slices/UI/workbench'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import { StandardLens } from '@tonylb/mtw-wml/ts/standardize/components/worldState'
import {
    WorkbenchComponentProvider,
    WorkbenchShortNameField
} from '../foundations/WorkbenchComponent'
import Spacer from '../WorkbenchSpacer'
import { ReferenceListSessionEditor } from '../foundations/ReferenceList'
import { roomGuidanceListAccessor } from './roomReferenceListAccessors'
import RoomStateAffordance from './RoomStateAffordance'

export const RoomEditor: FunctionComponent = () => {
    const dispatch = useDispatch()
    const { standardForm, readonly } = useWorkbenchAsset()
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
        const lensRefs = room.lens.payload || []
        if (lensRefs.length !== 1) return null
        const ref = lensRefs[0]
        if (!ref?.universalKey) return null
        const c = standardForm.byUniversalId[ref.universalKey]
        if (c && c instanceof StandardLens) return c
        return null
    }, [room, standardForm])

    const hasLens = !!singleLens

    useOnboardingCheckpoint('navigateRoom', { requireSequence: true })
    useOnboardingCheckpoint('navigateAssetWithImport', { requireSequence: true })

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
        <WorkbenchComponentProvider
            componentId={universalKey}
            guard={(c): c is StandardRoom => c instanceof StandardRoom}
        >
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
                            <WorkbenchShortNameField />
                            <Spacer />
                            <DefaultRenderEditor />
                            <ExitEditor RoomId={universalKey} />
                            <FeatureListEditor RoomId={universalKey} />
                            <LensHeader
                                RoomId={universalKey}
                                onEditLens={(lensId) =>
                                    dispatch(pushBreadcrumb({ id: lensId, kind: 'component', componentId: lensId }))
                                }
                            />
                            {hasLens && (
                                <>
                                    <RoomStateAffordance RoomId={universalKey} />
                                    {/* Room Examples are not shown in the UI; supplanted by Situation facets. */}
                                    <Box sx={{ marginTop: '0.5em' }}>
                                        <ReferenceListSessionEditor
                                            title="Guidance"
                                            listAccessor={roomGuidanceListAccessor}
                                            tag="Guidance"
                                            disabled={readonly}
                                            onItemClick={handleGuidanceItemClick}
                                        />
                                    </Box>
                                    <RoomSituationsListEditor RoomId={universalKey} />
                                </>
                            )}
                        </Box>
                    </Box>
                </Box>
            </Box>
        </WorkbenchComponentProvider>
    )
}

export default RoomEditor
