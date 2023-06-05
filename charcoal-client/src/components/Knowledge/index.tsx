import React, { FunctionComponent, useCallback, useEffect } from 'react'
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
import { EphemeraKnowledgeId, isEphemeraKnowledgeId } from '@tonylb/mtw-interfaces/dist/baseClasses'

type KnowledgeProps = {
}

export const Knowledge: FunctionComponent<KnowledgeProps> = () => {
    const { KnowledgeId = 'knowledgeRoot' } = useParams()
    useOnboardingCheckpoint('navigateKnowledge')
    useOnboardingCheckpoint('knowledgeDetail', { condition: KnowledgeId !== 'knowledgeRoot'})
    useAutoPin({ href: `/Knowledge/`, label: `Knowledge`, iconName: 'Knowledge', type: 'Knowledge' })
    const dispatch = useDispatch()
    useEffect(() => {
        dispatch(socketDispatchPromise({
            message: 'link',
            to: `KNOWLEDGE#${KnowledgeId}`,
        }))
    }, [KnowledgeId, dispatch])
    const { fetched, ...rest } = useSelector(getCachedPerception({ EphemeraId: `KNOWLEDGE#${KnowledgeId}` }))
    const navigate = useNavigate()
    const onClickLink = useCallback((to: EphemeraKnowledgeId) => {
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
            fetched
                ? <ComponentDescription
                    message={{
                        ...rest,
                        MessageId: 'stub',
                        DisplayProtocol: 'KnowledgeDescription',
                        CreatedTime: 0
                    }}
                    icon={<KnowledgeIcon />}
                    onClickLink={onClickLink}
                />
                : <Spinner size={150} border={10} />
        }
    </Box>
}

export default Knowledge
