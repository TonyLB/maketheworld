import { FunctionComponent, useState } from 'react'
import AutoSizer from 'react-virtualized-auto-sizer'
import { useGesture } from '@use-gesture/react'

import useMapStyles from './useMapStyles'
import {
    MapRoom,
    MapDispatch,
    VisibleMapItems
} from './maps'
import MapRoomComponent from './MapRoom'
import MapEdgeComponent from './MapEdge'
import { RoomGestures } from './MapGestures'

interface MapDisplayProps extends VisibleMapItems {
    mapDispatch: MapDispatch;
}

export const MapDisplay: FunctionComponent<MapDisplayProps> = ({ rooms, exits, mapDispatch }) => {
    const localClasses = useMapStyles()
    const [scale, setScale] = useState(0)
    const bind = useGesture({
        onWheel: ({ event, movement: [, y]}) => {
            event.preventDefault()
            setScale(scale * Math.pow(2, -y / 1000))
        }
    })
    const roomsByRoomId = rooms.reduce<Record<string, MapRoom>>((previous, room) => ({ ...previous, [room.roomId]: room }), {})
    return <AutoSizer {...bind()} >
        { ({ height, width }) => {
            const midScalePoint = Math.min(height / 400, width / 600)
            if (!scale){
                setScale(midScalePoint)
                return null
            }
            return <div style={{ width, height, backgroundColor: "#aaaaaa", overflow: "auto" }} {...bind()}>
                <div style={{
                    position: "absolute",
                    width: 600* scale,
                    height: 400 * scale,
                    top: Math.max(0, (height - 400 * scale) / 2),
                    left: Math.max(0, (width - 600 * scale) / 2),
                    backgroundColor: "white"
                }}>
                    <svg width="100%" height="100%" viewBox="0 0 600 400" preserveAspectRatio="xMidYMid meet">
                        <defs>
                            <marker id='head' orient='auto' markerWidth='10' markerHeight='20'
                                    refX='10' refY='5'>
                                <path d='M0,0 V10 L10,5 Z' fill='#000000' />
                            </marker>
                        </defs>
                        {
                            exits.map(({ fromRoomId, toRoomId }) => {
                                const from = roomsByRoomId[fromRoomId]
                                const fromX = from === undefined ? undefined : from.x + 300
                                const fromY = from === undefined ? undefined : from.y + 200
                                const to = roomsByRoomId[toRoomId]
                                const toX = to === undefined ? undefined : to.x + 300
                                const toY = to === undefined ? undefined : to.y + 200
                                return <MapEdgeComponent
                                    fromX={fromX}
                                    fromY={fromY}
                                    toX={toX}
                                    toY={toY}
                                    fromRoomId={fromRoomId}
                                    toRoomId={toRoomId}
                                />
                            })
                        }
                        {
                            rooms.map((room) => ({
                                className: localClasses.svgLightBlue,
                                contrastClassName: localClasses.svgLightBlueContrast,
                                ...room,
                                Name: room.name,
                                PermanentId: room.roomId,
                                x: room.x + 300,
                                y: room.y + 200
                            }))
                            .map((room) => (
                                <RoomGestures
                                    roomId={room.roomId}
                                    x={room.x}
                                    y={room.y}
                                    localDispatch={mapDispatch}
                                    scale={scale}
                                >
                                    <MapRoomComponent {...room} />
                                </RoomGestures>
                            ))
                        }
                    </svg>
                </div>
            </div>
        }}
    </AutoSizer>
}

export default MapDisplay
