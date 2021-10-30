import { FunctionComponent, useState, useRef, useEffect } from 'react'
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
    const [windowDetails, setWindowDetails] = useState({
        width: 0,
        height: 0,
        minScale: 0.5,
        maxScale: 4.0
    })
    const scrollingWindowRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        if (scrollingWindowRef.current) {
            scrollingWindowRef.current.addEventListener("mousewheel", (event) => { event.preventDefault() })
        }
    }, [scrollingWindowRef])
    const bind = useGesture({
        onWheel: ({ movement: [, y] }) => {
            const oldScale = scale
            const newScale = Math.max(windowDetails.minScale, Math.min(windowDetails.maxScale, scale * Math.pow(2, -y / 1000)))
            setScale(newScale)
            if (scrollingWindowRef.current) {
                const top = Math.max(0, (windowDetails.height - 400 * oldScale) / 2)
                const left = Math.max(0, (windowDetails.width - 600 * oldScale) / 2)
                const divWidth = windowDetails.width / 2
                const divHeight = windowDetails.height / 2
                const scrollCenterX = (scrollingWindowRef.current.scrollLeft + left + divWidth) / oldScale
                const scrollCenterY = (scrollingWindowRef.current.scrollTop + top + divHeight) / oldScale
                const newTop = Math.max(0, (windowDetails.height - 400 * newScale) / 2)
                const newLeft = Math.max(0, (windowDetails.width - 600 * newScale) / 2)
                const scrollLeft = Math.max(0, scrollCenterX * newScale - (divWidth + newLeft))
                const scrollTop = Math.max(0, scrollCenterY * newScale - (divHeight + newTop))
                scrollingWindowRef.current.scrollTo(scrollLeft, scrollTop)
            }
        }
    })
    const roomsByRoomId = rooms.reduce<Record<string, MapRoom>>((previous, room) => ({ ...previous, [room.roomId]: room }), {})
    return <div ref={scrollingWindowRef} style={{ width: '100%', height: '100%', overflow: 'auto' }} ><AutoSizer {...bind()} >
        { ({ height, width }) => {
            const midScalePoint = Math.min(height / 400, width / 600)
            if (!scale){
                setScale(midScalePoint)
                return null
            }
            if (!(windowDetails.width === width && windowDetails.height === height)) {
                setWindowDetails({
                    width,
                    height,
                    minScale: midScalePoint * 0.5,
                    maxScale: midScalePoint * 4.0
                })
            }
            return <div style={{ width: Math.max(width, 600 * scale), height: Math.max(height, 400 * scale), backgroundColor: "#aaaaaa" }} {...bind()}>
                <div style={{
                    position: "absolute",
                    width: 600* scale,
                    height: 400 * scale,
                    //
                    // TODO:  Compensate for border offsets in scrolling algorithm, above
                    //
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
                                className: localClasses.roomNode,
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
                                    zLevel={room.zLevel}
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
    </AutoSizer></div>
}

export default MapDisplay
