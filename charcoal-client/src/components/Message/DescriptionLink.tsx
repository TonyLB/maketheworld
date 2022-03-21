/** @jsxImportSource @emotion/react */
import React, { ReactChild, ReactChildren, FunctionComponent } from 'react'
import { useDispatch } from 'react-redux'
import { css } from '@emotion/react'

import {
    Box,
    Chip,
    Typography,
    Divider
} from '@mui/material'
import { blue } from '@mui/material/colors'

import {
    RoomDescribeLink
} from '../../slices/messages/baseClasses'

import { socketDispatchPromise } from '../../slices/lifeLine'
import { useActiveCharacter } from '../ActiveCharacter'

interface DescriptionLinkChipProps {
    text?: string;
    children?: ReactChildren[];
    onClick?: () => void;
}

export const DescriptionLinkActionChip: FunctionComponent<DescriptionLinkChipProps> = ({ text = '', children = [], onClick }) => (
    <Box
        component="span"
        sx={{
            background: `linear-gradient(${blue[400]}, ${blue[600]})`,
            '&:hover': {
                background: `linear-gradient(${blue[500]}, ${blue[700]})`,
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
)

export const DescriptionLinkFeatureChip: FunctionComponent<DescriptionLinkChipProps> = ({ text = '', children = [], onClick }) => (
    <Box
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
)

interface DescriptionLinkProps {
    link: RoomDescribeLink
}

export const DescriptionLink = ({ link }: DescriptionLinkProps) => {
    const { CharacterId } = useActiveCharacter()
    const dispatch = useDispatch()
    switch(link.targetTag) {
        case 'Action':
            return <DescriptionLinkActionChip
                text={link.text}
                onClick={() => {
                    dispatch(socketDispatchPromise('link')({
                        targetTag: 'Action',
                        Action: link.toAction,
                        AssetId: link.toAssetId,
                        RoomId: link.RoomId,
                        CharacterId
                    }))
                }}
            />
        case 'Feature':
            return <DescriptionLinkFeatureChip
                text={link.text}
                onClick={() => {
                    dispatch(socketDispatchPromise('link')({
                        targetTag: 'Feature',
                        FeatureId: link.toFeatureId,
                        RoomId: link.RoomId,
                        CharacterId
                    }))
                }}
            />
    }
}

export default DescriptionLink
