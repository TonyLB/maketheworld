import { MapTree } from './maps'
import { NormalForm, NormalMap, NormalExit } from '../../../wml/normalize'
import { AssetRoom } from '../../Library/Edit/LibraryAsset'
import { unique } from '../../../lib/lists'

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
        }), {}) as Record<string, { x: number; y: number; location: number[] }>
    const exitPairs = Object.values(normalForm || {})
        .filter(({ tag }) => (tag === 'Exit'))
        .map((item) => (item as NormalExit))
        .reduce<Record<string, string[]>>((previous, { to, from, appearances = [] }) => {
            if (appearances.find(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'Condition'))))) {
                return {
                    ...previous,
                    [from]: unique(previous[from] || [], [to])
                }
            }
            return previous
        }, {})
    const exitItems = Object.entries(exitPairs)
        .reduce<MapTree>((previous, [from, toList]) => ([
            ...previous,
            ...(toList.map((to) => ({
                key: `${from}#${to}`,
                item: {
                    name: 'exit',
                    type: 'EXIT' as "EXIT",
                    fromRoomId: from,
                    toRoomId: to,
                    visible: true
                },
                children: []
            })))
        ]), [] as MapTree)
    const tree: MapTree = Object.entries(roomItems || {})
        .reduce<MapTree>((previous, [key, { x = 0, y = 0, location }], index) => {
            return [
                ...previous,
                {
                    key,
                    item: {
                        type: 'ROOM',
                        name: rooms[key]?.name || 'Untitled',
                        location,
                        x,
                        y,
                        roomId: key,
                        visible: true
                    },
                    children: []
                }
            ]
        }, exitItems)
    return [{
        key: 'Default',
        item: {
            type: 'GROUP',
            name: 'Default',
            visible: true
        },
        children: tree
    }]
}

export default normalToTree
