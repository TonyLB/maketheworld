import { ActiveCharacterMap } from '../../../slices/activeCharacters/baseClasses'
import { MapTreeItem } from '../Controller/baseClasses'
import { GenericTree } from '@tonylb/mtw-base/ts/genericTree'

export const cacheToTree = ({ rooms = [] }: ActiveCharacterMap): GenericTree<MapTreeItem> => {
    const tree = rooms
        .reduce<GenericTree<MapTreeItem>>((previous: GenericTree<MapTreeItem>, { roomId, shortName, x = 0, y = 0, exits }: { roomId: string; shortName: string; x: number; y: number; exits: Array<{ description: string; to: string }> }, index: number) => ([
            ...previous,
            {
                data: {
                    tag: 'Room',
                    key: roomId,
                    shortName: [{ data: { tag: 'String', value: shortName }, children: [] }],
                    x,
                    y
                },
                children: exits.map(({ description, to }) => ({
                    data: {
                        tag: 'Exit',
                        key: `${roomId}#${to}`,
                        from: roomId,
                        to,
                        description
                    },
                    children: []
                }))
            }
        ]), [])
    return tree
}

export default cacheToTree
