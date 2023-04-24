/** @jsxImportSource @emotion/react */
import React, { ReactChild, ReactChildren, FunctionComponent } from 'react'
import { useDispatch } from 'react-redux'
import { css } from '@emotion/react'

import {
    Box,
    Chip,
    Typography,
    Divider,
    Tooltip
} from '@mui/material'
import { blue, grey } from '@mui/material/colors'

import {
    TaggedLink
} from '@tonylb/mtw-interfaces/dist/messages'

import { socketDispatchPromise } from '../../slices/lifeLine'
import { useActiveCharacter } from '../ActiveCharacter'
import { isEphemeraActionId, isEphemeraFeatureId } from '@tonylb/mtw-interfaces/dist/baseClasses'
import { addOnboardingComplete } from '../../slices/player/index.api'

interface DescriptionLinkChipProps {
    text?: string;
    onClick?: () => void;
    tooltipTitle?: string;
    active?: boolean;
}

export const DescriptionLinkActionChip: FunctionComponent<DescriptionLinkChipProps> = ({ text = '', children = [], onClick, tooltipTitle, active=true }) => {
    const linearGradient = (color: Record<string | number, string>, low: number, high: number) => `linear-gradient(${color[low]}, ${color[high]})`
    const element = <Box
            component="span"
            sx={{
                background: active ? linearGradient(blue, 400, 600) : linearGradient(grey, 400, 600),
                '&:hover': {
                    background: active ? linearGradient(blue, 500, 700) : linearGradient(grey, 500, 700)
                },
                borderRadius: '200px',
                paddingTop: '0.125em',
                paddingBottom: '0.25em',
                paddingLeft: '0.35em',
                paddingRight: '0.35em',
                ...(onClick ? { cursor: 'pointer' } : {})
            }}
            onClick={onClick || (() => {})}
        >
            {text}
            {children}
        </Box>
    if (tooltipTitle) {
        return <Tooltip title={tooltipTitle}>
            { element }
        </Tooltip>
    }
    else {
        return element
    }
    
}

export const DescriptionLinkFeatureChip: FunctionComponent<DescriptionLinkChipProps> = ({ text = '', children = [], onClick, tooltipTitle }) => {
    const element = <Box
            component="span"
            sx={{
                background: `linear-gradient(${blue[200]}, ${blue[300]})`,
                borderRadius: 0,
                borderLeft: `solid ${blue[400]} 3px`,
                paddingBottom: '5px',
                '&:hover': {
                    background: `linear-gradient(${blue[300]}, ${blue[400]})`,
                },
                ...(onClick ? { cursor: 'pointer' } : {})
            }}
            onClick={onClick || (() => {})}
        >
            {text}
            {children}
        </Box>
    if (tooltipTitle) {
        return <Tooltip title={tooltipTitle}>
            { element }
        </Tooltip>
    }
    else {
        return element
    }
}

interface DescriptionLinkProps {
    link: TaggedLink
}

export const DescriptionLink = ({ link }: DescriptionLinkProps) => {
    const { CharacterId } = useActiveCharacter()
    const dispatch = useDispatch()
    //
    // TODO:  Figure out how to make sure that either (a) RoomId is populated based on where the ActiveCharacter is right
    // now, or (b) link.RoomId gets populated correctly upon render
    //
    return <DescriptionLinkActionChip
        text={link.text}
        onClick={() => {
            if (isEphemeraFeatureId(link.to)) {
                dispatch(addOnboardingComplete(['featureLink']))
            }
            if (isEphemeraActionId(link.to)) {
                dispatch(addOnboardingComplete(['actionLink']))
            }
            dispatch(socketDispatchPromise({
                message: 'link',
                to: link.to,
                // RoomId: link.RoomId,
                CharacterId
            }))
        }}
    />
}

export default DescriptionLink
