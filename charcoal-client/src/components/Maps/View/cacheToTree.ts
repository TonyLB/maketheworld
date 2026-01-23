import { ActiveCharacterMap } from '../../../slices/activeCharacters/baseClasses'
import { MapTreeItem } from '../Controller/baseClasses'
import { GenericTree } from '@tonylb/mtw-base/ts/genericTree'

export const cacheToTree = ({ rooms = [] }: ActiveCharacterMap): GenericTree<MapTreeItem> => {
    const tree = rooms
        .reduce<GenericTree<MapTreeItem>>((previous: GenericTree<MapTreeItem>, { roomId, name, x = 0, y = 0, exits }: { roomId: string; name: string; x: number; y: number; exits: Array<{ name: string; to: string }> }, index: number) => ([
            ...previous,
            {
                data: {
                    tag: 'Room',
                    key: roomId,
                    //
                    // TODO: ISS-3402: Refactor how name data in MapDescribe is formatted
                    //
                    // name: name.map((item) => ({ data: item, children: [] })),
                    name: [{ data: { tag: 'String', value: name }, children: [] }],
                    x,
                    y
                },
                children: exits.map(({ name, to }) => ({
                    data: {
                        tag: 'Exit',
                        key: `${roomId}#${to}`,
                        from: roomId,
                        to,
                        name
                    },
                    children: []
                }))
            }
        ]), [])
    return tree
}

export default cacheToTree
