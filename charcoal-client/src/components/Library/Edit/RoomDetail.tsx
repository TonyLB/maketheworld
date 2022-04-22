import { FunctionComponent, useCallback, useState } from 'react'
import {
    useParams
} from "react-router-dom"

import {
    Box,
    TextField
} from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'
import { blue } from '@mui/material/colors'

import LibraryBanner from './LibraryBanner'
import DescriptionEditor from './DescriptionEditor'
import useDebouncedCallback from './useDebouncedCallback'
import { useLibraryAsset } from './LibraryAsset'

interface RoomDetailProps {
}

export const RoomDetail: FunctionComponent<RoomDetailProps> = () => {
    const { assetKey, normalForm, defaultAppearances, wmlQuery, updateWML, rooms } = useLibraryAsset()
    const { RoomId } = useParams<{ RoomId: string }>()
    const onChange = useCallback((newRender) => {
        wmlQuery.search(`Room[key="${RoomId}"]`).not('Condition Room').not('Map Room').add(' Description').render(newRender)
        updateWML(wmlQuery.source)
    }, [wmlQuery, updateWML])
    const room = normalForm[RoomId || '']
    // const aggregateName = (room && room.tag === 'Room' && room.appearances
    //     .filter(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'Condition'))))
    //     .map(({ name = '' }) => name)
    //     .join('')) || ''
    const [name, setName] = useState(rooms[room.key]?.localName || '')
    // const aggregateRender = (room && room.tag === 'Room' && room.appearances
    //     .filter(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'Condition'))))
    //     .map(({ render = [] }) => render)
    //     .reduce((previous, render) => ([ ...previous, ...render ]), []))  || []

    const dispatchNameChange = useCallback((value) => {
        const roomQuery = wmlQuery.search(`Room`).not('Condition Room').not('Map Room')
        roomQuery.add(`[key="${RoomId}"] Name`)
        if (roomQuery) {
            roomQuery.remove()
        }
        if (name) {
            wmlQuery.search(`Room`)
                .not('Condition Room')
                .not('Map Room')
                .add(`[key="${RoomId}"]:first`)
                .children()
                .prepend(`<Name>${name}</Name>`)
        }
        updateWML(wmlQuery.source)
    }, [updateWML, wmlQuery, name, RoomId])
    const onChangeName = useDebouncedCallback(dispatchNameChange)
    const changeName = useCallback((event) => {
        setName(event.target.value)
        onChangeName(event.target.value)
    }, [setName])
    if (!room || room.tag !== 'Room') {
        return <Box />
    }
    return <Box sx={{ width: "100%" }}>
            <LibraryBanner
                primary={rooms[room.key]?.name || 'Untitled'}
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
                    label: rooms[room.key]?.name || 'Untitled'
                }]}
            />

            <Box sx={{
                marginLeft: '0.5em',
                display: 'flex',
                alignItems: 'center',
            }}>
                <Box
                    sx={{
                        height: "100%",
                        background: 'lightgrey',
                        verticalAlign: 'middle',
                        display: 'inline'
                    }}
                >
                    { rooms[room.key]?.defaultName || '' }
                </Box>
                <TextField
                    id="name"
                    label="Name"
                    size="small"
                    value={name}
                    onChange={changeName}
                />
            </Box>
            <Box sx={{ border: `2px solid ${blue[500]}`, borderRadius: '0.5em' }}>
                <DescriptionEditor
                    inheritedRender={rooms[room.key]?.defaultRender}
                    render={rooms[room.key]?.localRender || []}
                    onChange={onChange}
                />
            </Box>
        </Box>
}

export default RoomDetail
