import { FunctionComponent, useCallback, useMemo } from 'react'

import {
    Box,
    Typography
} from '@mui/material'
import { blue } from '@mui/material/colors'

import { useLibraryAsset } from './LibraryAsset'
import AddRoomExit from './AddRoomExit'
import RoomExitHeader from './RoomExitHeader'
import { objectFilter } from '../../../lib/objects'
import { noConditionContext } from './utilities'
import { ComponentRenderItem, isNormalExit, isNormalRoom, NormalExit } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { reduceItemsToTree } from './conditionTree'

const guessExitName = (roomName: ComponentRenderItem[] = []) => {
    const roomNameText = roomName.map((item) => (item.tag === 'String' ? item.value : '')).join('')
    return roomNameText.split(' ')
        .map((token) => (token.toLowerCase()))
        .filter((token) => (!['a', 'an', 'the'].includes(token)))[0] || 'unknown'
}

type RoomExitNodeData = {
    key: string;
    to: string;
    from: string;
}

type RoomExitSubListProps = {
    RoomId: string;
    keys: string[];
    onAddExit: (value: { toTarget: boolean; targetId: string }) => void;
}

const RoomExitSubList: FunctionComponent<RoomExitSubListProps> = ({ RoomId, keys, onAddExit }) => (
    <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        width: "100%"
    }}>
        {
            keys.map((key) => (<RoomExitHeader key={key} ItemId={key} RoomId={RoomId} />))
        }
        <AddRoomExit RoomId={RoomId} onAdd={onAddExit} />
    </Box>
)

type RoomExitsProps = {
    RoomId: string;
}

export const RoomExits: FunctionComponent<RoomExitsProps> = ({ RoomId }) => {
    const { rooms, normalForm, updateNormal } = useLibraryAsset()
    const relevantExits = useMemo(() => (
        Object.values(normalForm)
            .filter(isNormalExit)
            .filter(({ to, from }) => (to === RoomId || from === RoomId))
            .reduce(reduceItemsToTree({
                compare: (A: string, B: string) => (A === B),
                normalForm,
                transform: ({ key }: NormalExit) => (key)
            }), { items: [], conditionals: [] })
        ), [normalForm, RoomId])
    const onAddExit = useCallback(({ toTarget, targetId }: { toTarget: boolean, targetId: string }) => {
        const { from, to } = toTarget ? { from: RoomId, to: targetId } : { to: RoomId, from: targetId}
        const normalRoom = normalForm[from]
        if (from && normalRoom && isNormalRoom(normalRoom)) {
            const firstUnconditionedAppearance = normalRoom.appearances.findIndex(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'If'))))
            if (firstUnconditionedAppearance !== -1) {
                const guessName = guessExitName(rooms[to]?.name)
                updateNormal({
                    type: 'put',
                    item: {
                        tag: 'Exit',
                        key: `${from}#${to}`,
                        from,
                        to,
                        name: guessName,
                        contents: [],
                    },
                    position: { contextStack: [ ...normalRoom.appearances[firstUnconditionedAppearance].contextStack, { key: from, tag: 'Room', index: firstUnconditionedAppearance }] }
                })
            }
        }
        if (!rooms[targetId]) {
            return
        }
    }, [rooms, RoomId, normalForm, updateNormal])
    return <Box sx={{
        display: 'flex',
        flexDirection: 'row',
        marginTop: '0.5em',
        marginLeft: '0.5em'
    }}>
        <Box sx={{
            display: 'flex',
            width: '2em',
            minHeight: '5em',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: blue[50],
            borderTopColor: blue[500],
            borderTopStyle: 'solid',
            borderBottomColor: blue[500],
            borderBottomStyle: 'solid'
        }}>
            <Typography
                sx={{ transform: 'rotate(-90deg)' }}
                variant="h5"
            >
                Exits
            </Typography>
        </Box>
        <Box sx={{
            display: 'flex',
            flexGrow: 1,
        }}>
            <RoomExitSubList RoomId={RoomId} keys={relevantExits.items} onAddExit={onAddExit} />
        </Box>
    </Box>
    //
    // TODO: Abstract display of a list of exits into its own component, and then extend that with
    // If/ElseIf/Else, recursively calling that component to nest the structure
    //
}

export default RoomExits
