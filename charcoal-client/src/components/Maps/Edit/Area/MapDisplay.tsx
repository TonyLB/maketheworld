import { FunctionComponent, useState, useRef, useEffect, useContext } from 'react'
import AutoSizer from 'react-virtualized-auto-sizer'
import { useGesture } from '@use-gesture/react'

import useMapStyles from '../useMapStyles'
import {
    MapRoom,
    VisibleMapItems
} from '../maps'
import {
    MapAreaDispatch,
    ToolSelected
} from './area'
import MapRoomComponent from './MapRoom'
import MapEdgeComponent from './MapEdge'
import { RoomGestures } from './MapGestures'
import ToolSelectContext from './ToolSelectContext'
import { produce } from 'immer'
import HighlightCircle from './HighlightCircle'

interface MapDisplayProps extends VisibleMapItems {
    mapDispatch: MapAreaDispatch;
    onClick: React.MouseEventHandler<SVGElement>;
    decoratorCircles?: { x: number, y: number }[],
    decoratorExits?: {
        fromX: number,
        fromY: number,
        toX: number,
        toY: number,
        double: boolean
    }[]
}

type ExitDeduplicationState = {
    fromRoomId: string;
    toRoomId: string;
    double: boolean;
}
export const MapDisplay: FunctionComponent<MapDisplayProps> = ({
        rooms,
        exits,
        mapDispatch,
        onClick = () => {},
        decoratorCircles = [],
        decoratorExits = [],
        fileURL = ''
    }) => {
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
    //
    // useEffect to respond to cached windowDetails changes (so that the setWindowDetails doesn't happen
    // during the actual render)
    //
    const cacheWindowDetails = useRef<{ width: number; height: number; }>({ width: 0, height: 0 })
    useEffect((): void => {
        const width: number = cacheWindowDetails.current.width
        const height: number = cacheWindowDetails.current.height
        const midScalePoint = Math.min(height / 400, width / 600)
        if (!scale){
            setScale(midScalePoint)
        }
        if (!(windowDetails.width === width && windowDetails.height === height)) {
            setWindowDetails({
                width,
                height,
                minScale: midScalePoint * 0.5,
                maxScale: midScalePoint * 4.0
            })
        }
    }, [cacheWindowDetails.current.width, cacheWindowDetails.current.height])
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
    const toolSelected = useContext<ToolSelected>(ToolSelectContext)
    const roomsByRoomId = rooms.reduce<Record<string, MapRoom>>((previous, room) => ({ ...previous, [room.roomId]: room }), {})
    return <div ref={scrollingWindowRef} style={{ width: '100%', height: '100%', overflow: 'auto' }} ><AutoSizer {...bind()} >
        { ({ height, width }) => {
            const midScalePoint = Math.min(height / 400, width / 600)
            cacheWindowDetails.current = { width, height }
            const onClickScaled = (event: React.MouseEvent<SVGElement>) => {
                if (toolSelected === 'AddRoom' && scale) {
                    const rect = event.currentTarget.getBoundingClientRect()
                    const newClientX = (event.pageX - rect.left) / scale - 300
                    const newClientY = (event.pageY - rect.top) / scale - 200
                    onClick({ ...event, clientX: newClientX, clientY: newClientY })
                }
            }
            //
            // This code gathers all of the pairs of exits back and forth, and accumulates them into a list of links to render,
            // either as single-sided exits or double-sided.
            //
            const deduplicatedExits: ExitDeduplicationState[] = Object.entries(exits
                .reduce<Record<string, Record<string, { from: boolean; to: boolean }>>>((previous, { fromRoomId, toRoomId }) => (
                    produce(previous, (draft) => {
                        if (fromRoomId > toRoomId) {
                            draft[fromRoomId] = draft[fromRoomId] ?? {}
                            draft[fromRoomId][toRoomId] = draft[fromRoomId][toRoomId] ?? { from: false, to: false }
                            draft[fromRoomId][toRoomId].from = true
                        }
                        else {
                            draft[toRoomId] = draft[toRoomId] ?? {}
                            draft[toRoomId][fromRoomId] = draft[toRoomId][fromRoomId] ?? { from: false, to: false }
                            draft[toRoomId][fromRoomId].to = true
                        }
                    })
                ), {})).reduce<ExitDeduplicationState[]>((previous, [firstRoomId, otherRooms]) => (
                    Object.entries(otherRooms).reduce<ExitDeduplicationState[]>((accumulator, [secondRoomId, { from, to }]) => {
                        if (from) {
                            return [...accumulator, { fromRoomId: firstRoomId, toRoomId: secondRoomId, double: to }]
                        }
                        else {
                            return [...accumulator, { fromRoomId: secondRoomId, toRoomId: firstRoomId, double: false }]
                        }
                    }, previous)
                ), [])
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
                    <svg width="100%" height="100%" viewBox="0 0 600 400" preserveAspectRatio="xMidYMid meet" onClick={onClickScaled} >
                        <defs>
                            <marker id='head' orient='auto' markerWidth='10' markerHeight='20'
                                    refX='5' refY='5'>
                                <path d='M0,0 V10 L10,5 Z' fill='#000000' />
                            </marker>
                            <marker id='outlineHead' orient='auto' markerWidth='5' markerHeight='10'
                                    refX='2.5' refY='2.5'>
                                <path d='M0,0 V5 L5,2.5 Z' fill='blue' />
                            </marker>
                            <marker id='coreHead' orient='auto' markerWidth='10' markerHeight='20'
                                    refX='4.25' refY='5'>
                                <path d='M0,1.3 V8.7 L7.6,5 Z' fill='#FFFFFF' />
                            </marker>
                            <marker id='tail' orient='auto' markerWidth='10' markerHeight='20'
                                    refX='5' refY='5'>
                                <path d='M10,0 V10 L0,5 Z' fill='#000000' />
                            </marker>
                            <marker id='outlineTail' orient='auto' markerWidth='5' markerHeight='10'
                                    refX='2.5' refY='2.5'>
                                <path d='M5,0 V5 L0,2.5 Z' fill='blue' />
                            </marker>
                            <marker id='coreTail' orient='auto' markerWidth='10' markerHeight='20'
                                    refX='5.75' refY='5'>
                                <path d='M10,1.3 V8.7 L2.4,5 Z' fill='#FFFFFF' />
                            </marker>
                            { fileURL &&
                                <pattern id="backgroundImg" patternUnits="userSpaceOnUse" x="0" y="0" width="600" height="400">
                                    <image xlinkHref={fileURL} width="600" height="400" />
                                </pattern>
                            }
                        </defs>
                        {
                            fileURL && <path d="M0,0
                                l0,400 l600,0 l0,-400 l-600,0"
                            fill="url(#backgroundImg)" />
                        }
                        {
                            deduplicatedExits
                                .map(({ fromRoomId, toRoomId, double }) => {
                                const from = roomsByRoomId[fromRoomId]
                                const fromX = from === undefined ? undefined : from.x + 300
                                const fromY = from === undefined ? undefined : from.y + 200
                                const to = roomsByRoomId[toRoomId]
                                const toX = to === undefined ? undefined : to.x + 300
                                const toY = to === undefined ? undefined : to.y + 200
                                return <MapEdgeComponent
                                    key={`${fromRoomId}::${toRoomId}`}
                                    fromX={fromX}
                                    fromY={fromY}
                                    toX={toX}
                                    toY={toY}
                                    fromRoomId={fromRoomId}
                                    toRoomId={toRoomId}
                                    double={double}
                                />
                            })
                        }
                        {
                            decoratorExits
                                .map(({ fromX, fromY, toX, toY, double}) => (
                                    <MapEdgeComponent
                                        fromX={fromX + 300}
                                        fromY={fromY + 200}
                                        toX={toX + 300}
                                        toY={toY + 200}
                                        decorator={true}
                                        double={double}
                                    />
                                ))
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
                            .map(({
                                PermanentId,
                                roomId,
                                Name,
                                className,
                                contrastClassName,
                                x,
                                y,
                                zLevel
                            }) => (
                                <RoomGestures
                                    key={`Gesture-${roomId}`}
                                    roomId={roomId}
                                    x={x}
                                    y={y}
                                    zLevel={zLevel}
                                    localDispatch={mapDispatch}
                                    scale={scale}
                                >
                                    <MapRoomComponent
                                        PermanentId={PermanentId}
                                        Name={Name}
                                        className={className}
                                        contrastClassName={contrastClassName}
                                        x={x}
                                        y={y}
                                    />
                                </RoomGestures>
                            ))
                        }
                        {
                            decoratorCircles.map(({ x, y }) => (
                                <HighlightCircle x={x + 300} y={y + 200} />
                            ))
                        }
                    </svg>
                </div>
            </div>
        }}
    </AutoSizer></div>
}

export default MapDisplay
