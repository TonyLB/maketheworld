import { FunctionComponent, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import {
    useParams
} from "react-router-dom"

import {
    Box
} from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'
import { blue } from '@mui/material/colors'

import {
    getDefaultAppearances,
    getNormalized,
    getWMLQuery,
    setCurrentWML
} from '../../../slices/personalAssets'

import LibraryBanner from './LibraryBanner'
import DescriptionEditor from './DescriptionEditor'


interface RoomDetailProps {
}

export const RoomDetail: FunctionComponent<RoomDetailProps> = () => {
    const { AssetId: assetKey, RoomId } = useParams<{ RoomId: string, AssetId: string }>()
    const AssetId = `ASSET#${assetKey}`
    const normalForm = useSelector(getNormalized(AssetId))
    const defaultAppearances = useSelector(getDefaultAppearances(AssetId))
    const wmlQuery = useSelector(getWMLQuery(AssetId))
    const dispatch = useDispatch()
    const onChange = useCallback((newRender) => {
        // console.log(`OnChange`)
        // console.log(`start Source: ${wmlQuery.source}`)
        // console.log(`newRender: ${JSON.stringify(newRender, null, 4)}`)
        // wmlQuery.search(`!Condition !Map Room[key="${RoomId}"]`).render(newRender)
        // console.log(`Updated Source: ${wmlQuery.source}`)
        // dispatch(setCurrentWML(AssetId)(wmlQuery.source))
    }, [dispatch, wmlQuery])
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

            <Box sx={{ marginLeft: '0.5em' }}>Name: {`${defaultAppearances[room.key]?.name || ''}${aggregateName}` || 'Untitled'}</Box>
            <Box sx={{ border: `2px solid ${blue[500]}`, borderRadius: '0.5em' }}>
                <DescriptionEditor
                    inheritedRender={defaultAppearances[room.key]?.render}
                    render={aggregateRender}
                    onChange={onChange}
                />
            </Box>
        </Box>
}

export default RoomDetail
