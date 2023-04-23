import React, { FunctionComponent, useCallback } from 'react'
import { useOnboardingCheckpoint } from '../Onboarding/useOnboarding'

import Box from '@mui/material/Box'
import useAutoPin from '../../slices/UI/navigationTabs/useAutoPin'

type KnowledgeProps = {
}

export const Knowledge: FunctionComponent<KnowledgeProps> = () => {
    useOnboardingCheckpoint('navigateKnowledge')
    useOnboardingCheckpoint('knowledgeDetail')
    useAutoPin({ href: `/Knowledge/`, label: `Knowledge`, iconName: 'Knowledge', type: 'Knowledge' })

    return <Box sx={{ flexGrow: 1, padding: "10px" }}>
    </Box>
}

export default Knowledge
