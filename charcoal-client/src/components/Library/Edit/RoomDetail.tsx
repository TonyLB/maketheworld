import { FunctionComponent } from 'react'
import { useSelector } from 'react-redux'
import {
    useParams,
    useNavigate
} from "react-router-dom"

import {
    Box,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    IconButton
} from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { blue } from '@mui/material/colors'

import { NormalRoom } from '../../../wml/normalize'
import { getDefaultAppearances, getNormalized } from '../../../slices/personalAssets'

import LibraryBanner from './LibraryBanner'

interface RoomDetailProps {
}

export const RoomDetail: FunctionComponent<RoomDetailProps> = () => {
    const { AssetId: assetKey, RoomId } = useParams<{ RoomId: string, AssetId: string }>()
    const AssetId = `ASSET#${assetKey}`
    const normalForm = useSelector(getNormalized(AssetId))
    const defaultAppearances = useSelector(getDefaultAppearances(AssetId))
    const navigate = useNavigate()
    const room = normalForm[RoomId || '']
    if (!room || room.tag !== 'Room') {
        return <Box />
    }
    const aggregateName = room.appearances
        .filter(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'Condition'))))
        .map(({ name = '' }) => name)
        .join('')
    const aggregateRender = room.appearances
        .filter(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'Condition'))))
        .map(({ render = [] }) => render)
        .reduce((previous, render) => ([ ...previous, ...render ]), [])
    console.log(`aggregateName: ${aggregateName}`)
    console.log(`aggregateRender: ${JSON.stringify(aggregateRender, null, 4)}`)
    return <Box sx={{ width: "100%" }}>
            <LibraryBanner
                primary={`${defaultAppearances[room.key]?.name || ''}${aggregateName}` || 'Untitled'}
                secondary={room.key}
                icon={<HomeIcon />}
                breadCrumbProps={[{
                    href: '/Library',
                    label: 'Library'
                },
                {
                    href: `/Library/Edit/Asset/${assetKey}`,
                    label: assetKey || ''
                },
                {
                    label: `${defaultAppearances[room.key]?.name || ''}${aggregateName}` || 'Untitled'
                }]}
            />
            {/* <Box sx={{ width: "100%", backgroundColor: blue[100] }}>
                <List>
                    <ListItem>
                        <ListItemIcon>
                            <IconButton onClick={() => {
                                navigate(`/Library/Edit/Asset/${assetKey}`)
                            }}>
                                <ArrowBackIcon />
                            </IconButton>
                            <Box component="span" sx={{ width: "20px" }} />
                            <HomeIcon />
                            <Box component="span" sx={{ width: "20px" }} />
                        </ListItemIcon>
                        <ListItemText primary={`${defaultAppearances[room.key]?.name || ''}${aggregateName}` || 'Untitled'} secondary={room.key} />
                    </ListItem>
                </List>
            </Box> */}

            <Box sx={{ marginLeft: '0.5em' }}>Name: {`${defaultAppearances[room.key]?.name || ''}${aggregateName}` || 'Untitled'}</Box>
            <Box sx={{ marginLeft: '0.5em' }}>Description:&nbsp;
                {(defaultAppearances[room.key]?.render || []).filter((value) => (typeof value !== 'object'))}
                {aggregateRender.filter((value) => (typeof value !== 'object'))}
            </Box>
        </Box>
}

export default RoomDetail
