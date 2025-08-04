import React, { FunctionComponent, useCallback, useEffect, useMemo } from 'react'
import { useOnboardingCheckpoint } from '../Onboarding/useOnboarding'

import Box from '@mui/material/Box'
import KnowledgeIcon from '@mui/icons-material/School'

import useAutoPin from '../../slices/UI/navigationTabs/useAutoPin'
import { useNavigate, useParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { socketDispatchPromise } from '../../slices/lifeLine'
import { getCachedPerception } from '../../slices/perceptionCache'
import Spinner from '../Spinner'
import ComponentDescription from '../Message/ComponentDescription'
import { EphemeraActionId, EphemeraCharacterId, EphemeraFeatureId, EphemeraKnowledgeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { getPlayer } from '../../slices/player'
import { getStatus } from '../../slices/personalAssets'

type KnowledgeProps = {
}

export const Knowledge: FunctionComponent<KnowledgeProps> = () => {
    const { KnowledgeId = 'knowledgeRoot' } = useParams()
    useOnboardingCheckpoint('navigateKnowledge')
    useOnboardingCheckpoint('knowledgeDetail', { condition: KnowledgeId !== 'knowledgeRoot'})
    useAutoPin({ href: `/Knowledge/`, label: `Knowledge`, iconName: 'Knowledge', type: 'Knowledge' })
    const { Settings: { guestId }, Assets } = useSelector(getPlayer)
    const dispatch = useDispatch()
    useEffect(() => {
        dispatch(socketDispatchPromise({
            message: 'link',
            CharacterId: `CHARACTER#${guestId}`,
            to: `KNOWLEDGE#${KnowledgeId}`,
            directResponse: true
        }))
    }, [KnowledgeId, dispatch])
    const { fetched, wmlContent, parsedWML, componentUUID, Target } = useSelector(getCachedPerception({ EphemeraId: `KNOWLEDGE#${KnowledgeId}` }))
    const navigate = useNavigate()
    const onClickLink = useCallback((to: EphemeraKnowledgeId | EphemeraCharacterId | EphemeraFeatureId | EphemeraActionId) => {
        const knowledgeId = to.split('#')?.[1]
        if (knowledgeId) {
            if (knowledgeId === 'knowledgeRoot') {
                navigate('/Knowledge/')
            }
            else {
                navigate(`/Knowledge/${knowledgeId}/`)
            }
        }
    }, [navigate])

    return <Box sx={{ flexGrow: 1, padding: "10px" }}>
        {
            fetched && parsedWML && componentUUID
                ? <ComponentDescription
                    message={{
                        DisplayProtocol: 'PerceptionMessage',
                        wmlContent,
                        componentUUID,
                        MessageId: 'stub',
                        CreatedTime: 0,
                        Target: Target ?? 'SESSION#anonymous'
                    }}
                    parsedWML={parsedWML}
                    componentUUID={componentUUID}
                    icon={<KnowledgeIcon />}
                    onClickLink={onClickLink}
                />
                : <Spinner size={150} border={10} />
        }
    </Box>
}

export default Knowledge
