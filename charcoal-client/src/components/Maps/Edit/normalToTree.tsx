import { MapTree } from './maps'
import { NormalForm, NormalMap } from '../../../wml/normalize'
import { AssetRoom } from '../../Library/Edit/LibraryAsset'

interface NormalToTreeProps {
    MapId: string;
    normalForm: NormalForm;
    rooms: Record<string, AssetRoom>
}

export const normalToTree = ({ MapId, normalForm, rooms }: NormalToTreeProps): MapTree => {
    const map = (normalForm[MapId] || {}) as NormalMap
    const roomItems = (map.appearances || [])
        .filter(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'Condition'))))
        .reduce((previous, { rooms }) => ({
            ...previous, 
            ...rooms
        }), {}) as Record<string, { x: number; y: number }>
    const tree: MapTree = Object.entries(roomItems || {})
        .reduce<MapTree>((previous, [key, { x = 0, y = 0 }], index) => {
            const room = normalForm[key]
            return [
                ...previous,
                {
                    key,
                    item: {
                        type: 'ROOM',
                        name: rooms[key]?.name || 'Untitle',
                        x,
                        y,
                        roomId: key,
                        visible: true
                    },
                    children: []
                }
            ]
        }, [] as MapTree)
    return tree
}

export default normalToTree
