import { MapTree } from '../Edit/maps'
import { ActiveCharacterMap } from '../../../slices/activeCharacters/baseClasses'
import { MapDescribeRoom } from '@tonylb/mtw-interfaces/dist/messages'

export const cacheToTree = ({ rooms = [] }: ActiveCharacterMap): MapTree => {
    //
    // TODO: Rewrite cacheToTree to deal with new incoming map format
    //
    const roomsById = rooms.reduce<Record<string, MapDescribeRoom>>((previous, room) => ({ ...previous, [room.roomId]: room }), {})
    const tree: MapTree = rooms
        .reduce<MapTree>((previous, { roomId, name, x = 0, y = 0, exits }, index) => ([
            ...previous,
            {
                key: roomId,
                item: {
                    type: 'ROOM',
                    name: name || '',
                    x,
                    y,
                    roomId,
                    visible: true
                },
                children: []
            },
            ...((exits || []).reduce<MapTree>((accumulator, { to, name }, internalIndex) => ([
                ...accumulator,
                {
                    key: `Exit-${index}-${internalIndex}`,
                    item: {
                        type: 'EXIT',
                        name: name || '',
                        fromRoomId: roomId,
                        toRoomId: to,
                        visible: true
                    },
                    children: []
                }
            ]), [] as MapTree))
        ]), [] as MapTree)
    return tree
}

export default cacheToTree
