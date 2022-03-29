import { MapTree } from './maps'
import { NormalForm, NormalMap } from '../../../wml/normalize'

interface NormalToTreeProps {
    MapId: string;
    normalForm: NormalForm;
}

export const normalToTree = ({ MapId, normalForm }: NormalToTreeProps): MapTree => {
    const map = (normalForm[MapId] || {}) as NormalMap
    const rooms = (map.appearances || [])
        .filter(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'Condition'))))
        .reduce((previous, { rooms }) => ({
            ...previous, 
            ...rooms
        }), {}) as Record<string, { x: number; y: number }>
    const tree: MapTree = Object.entries(rooms || {})
        .reduce<MapTree>((previous, [key, { x = 0, y = 0 }], index) => {
            const room = normalForm[key]
            return [
                ...previous,
                {
                    key,
                    item: {
                        type: 'ROOM',
                        name: 'Test',
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
