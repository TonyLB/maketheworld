import { ActiveCharacterMap } from '../../../slices/activeCharacters/baseClasses'
import { MapTreeItem } from '../Controller/baseClasses'
import { GenericTree } from '@tonylb/mtw-sequence/dist/tree/baseClasses'
import { SchemaTaggedMessageLegalContents } from '@tonylb/mtw-wml/dist/simpleSchema/baseClasses'

export const cacheToTree = ({ rooms = [] }: ActiveCharacterMap): GenericTree<MapTreeItem> => {
    const tree = rooms
        .reduce<GenericTree<MapTreeItem>>((previous, { roomId, name, x = 0, y = 0, exits }, index) => ([
            ...previous,
            {
                data: {
                    tag: 'Room',
                    key: roomId,
                    name: name as SchemaTaggedMessageLegalContents[],
                    x,
                    y,
                    contents: [],
                    render: []
                },
                children: exits.map(({ name, to }) => ({
                    data: {
                        tag: 'Exit',
                        key: `${roomId}#${to}`,
                        from: roomId,
                        to,
                        name,
                        contents: []
                    },
                    children: []
                }))
            }
        ]), [])
    return tree
}

export default cacheToTree
