import { MapTree } from '../Edit/maps'
import { ActiveCharacterMap } from '../../../slices/activeCharacters/baseClasses'

export const cacheToTree = ({ rooms = {} }: ActiveCharacterMap): MapTree => {
    const tree: MapTree = Object.entries(rooms || {})
        .reduce<MapTree>((previous, [key, { EphemeraId, name = [], x = 0, y = 0, exits }], index) => ([
            ...previous,
            {
                key,
                item: {
                    type: 'ROOM',
                    name: name.join(''),
                    x,
                    y,
                    roomId: EphemeraId,
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
                        fromRoomId: key,
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
