import { MapTree } from './maps'
import { NormalForm, NormalMap, NormalExit, isNormalExit } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { AssetComponent } from '../../Library/Edit/LibraryAsset'
import { unique } from '../../../lib/lists'
import { InheritedExit, InheritedMapLayer, InheritedMapLayerRoom } from '../../../slices/personalAssets/inheritedData'

interface NormalToTreeProps {
    MapId: string;
    normalForm: NormalForm;
    rooms: Record<string, AssetComponent>;
    inheritedExits: InheritedExit[];
    inheritedAppearances: InheritedMapLayer[];
}

export const normalToTree = ({ MapId, normalForm, rooms, inheritedExits, inheritedAppearances }: NormalToTreeProps): MapTree => {
    const map = (normalForm[MapId] || {}) as NormalMap
    const roomItems = (map.appearances || [])
        .filter(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'If'))))
        .reduce((previous, { rooms }) => ([
            ...previous, 
            ...rooms
        ]), []  as ({ key: string, x: number; y: number; }[]))
    const exitPairs = Object.values(normalForm || {})
        .filter(isNormalExit)
        .reduce<Record<string, string[]>>((previous, { to, from, appearances = [] }) => {
            if (appearances.find(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'If'))))) {
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
    const inheritedRooms: Record<string, InheritedMapLayerRoom> = Object.assign({}, ...(inheritedAppearances.map(({ rooms }) => (rooms))))
    const roomCheck = Object.assign({ ...inheritedRooms }, roomItems.map(({ key, ...rest }) => ({ [key]: rest })))
    const inheritedExitItems: MapTree = inheritedExits
        .filter(({ from, to }) => ((from in roomCheck) && (to in roomCheck)))
        .map(({ from, to, name }) => ({
                key: `${from}#${to}`,
                item: {
                    name: 'exit',
                    type: 'EXIT' as "EXIT",
                    fromRoomId: from,
                    toRoomId: to,
                    visible: true
                },
                children: []
        }))
    //
    // TODO: Abstract the following two functions, to reduce code-repetition
    //
    const tree: MapTree = (roomItems || [])
        .reduce<MapTree>((previous, { key, x = 0, y = 0 }) => {
            return [
                ...previous,
                {
                    key,
                    item: {
                        type: 'ROOM',
                        name: (rooms[key]?.name ?? [{ tag: 'String', value: 'Untitled' }]).map((item) => ((item.tag === 'String') ? item.value : '')).join(''),
                        x,
                        y,
                        roomId: key,
                        visible: true
                    },
                    children: []
                }
            ]
        }, exitItems)
    const inheritedTree: MapTree = Object.entries(inheritedRooms || {})
        .reduce<MapTree>((previous, [key, { x = 0, y = 0 }], index) => {
            return [
                ...previous,
                {
                    key,
                    item: {
                        type: 'ROOM',
                        name: (rooms[key]?.name ?? [{ tag: 'String', value: 'Untitled' }]).map((item) => ((item.tag === 'String') ? item.value : '')).join(''),
                        x,
                        y,
                        roomId: key,
                        visible: true
                    },
                    children: []
                }
            ]
        }, inheritedExitItems)

    return [{
        key: 'Default',
        item: {
            type: 'GROUP',
            name: 'Default',
            visible: true
        },
        children: tree
    },
    {
        key: 'Inherited',
        item: {
            type: 'GROUP',
            name: 'Inherited',
            visible: true
        },
        children: inheritedTree
    }]
}

export default normalToTree
