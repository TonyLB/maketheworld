import {
    SimulationLinkDatum,
    Simulation,
} from 'd3-force'
import { SimCallback, MapNodes, MapLinks, SimNode, SimulationReturn } from './baseClasses'
import MapDThreeIterator from './MapDThreeIterator'

// interface MapDThreeLayerOutput {
//     key: string;
//     rooms: Record<string, { x: number; y: number; }>
// }

interface MapDThreeStackProps {
    layers: SimulationReturn[];
    onStabilize?: SimCallback;
    onTick?: SimCallback;
}

export class MapDThreeStack extends Object {
    layers: MapDThreeIterator[] = []
    stable: boolean = true
    onStability: SimCallback = () => {}
    onTick: SimCallback = () => {}

    constructor(props: MapDThreeStackProps) {
        super(props)
        const {
            layers,
            onStabilize,
            onTick
        } = props
        this.layers = layers.map(({ key, nodes, links }, index) => {
            const newMap = new MapDThreeIterator(key, nodes, links, index > 0 ? () => (this.layers[index-1].nodes) : () => [])
            newMap.setCallbacks(this.cascade(index).bind(this), this.checkStability.bind(this))
            return newMap
        })
        this.setCallbacks({ onTick, onStability: onStabilize })
        this.checkStability()
    }
    //
    // An aggregator that decodes the nodes at the top layer (i.e., everything that has been cascaded up from the lower
    // level simulators) and delivers it in readable format.
    //
    get nodes(): SimNode[] {
        if (this.layers.length > 0) {
            //
            // Overlay x and y with fx/fy if necessary (converting from null to undefined if needed)
            //
            return this.layers[this.layers.length - 1].nodes
                .map(({ x, y, fx, fy, ...rest }) => ({ ...rest, x: x ?? (fx === null ? undefined : fx), y: y ?? (fy === null ? undefined : fy) }))
        }
        return []
    }
    get links(): MapLinks {
        return this.layers.reduce<MapLinks>((previous, { links }) => ([ ...previous, ...links ]), [] as MapLinks)
    }
    setCallbacks({ onTick, onStability }: { onTick?: SimCallback, onStability?: SimCallback }) {
        if (onStability) {
            this.onStability = onStability
        }
        if (onTick) {
            this.onTick = onTick
        }
    }
    //
    // Update responds to changes in the semantic structure of the map, while keeping live and running simulations.
    //
    // Do NOT use it to respond to simulation-level changes in the simulations themselves ... only semantic changes
    // in the incoming map tree.
    //
    update(layers: SimulationReturn[]): void {
        //
        // TODO:  When we create bookmarks and references so that the same RoomId can appear meaningfully in different layers,
        // we'll have to refactor this matching algorithm to be based on layer item IDs rather than roomIDs.
        //
        
        const previousNodesByRoomId = this.nodes.reduce<Record<string, SimNode>>((accumulator, node) => {
            return {
                ...accumulator,
                [node.roomId]: node
            }
        }, {})
        type PreviousLayerRecords = Record<string, { found: boolean; index: number, simulation: Simulation<SimNode, SimulationLinkDatum<SimNode>> }>
        const previousLayersByKey = this.layers.reduce<PreviousLayerRecords>((previous, { key, simulation }, index) => ({ ...previous, [key]: { index, found: false, simulation } }), {})

        let forceRestart = false

        type IncomingLayersReduce = {
            layers: MapDThreeIterator[];
            previousLayersByKey: PreviousLayerRecords;
        }
        const { layers: newLayers, previousLayersByKey: processedLayers } = layers.reduce<IncomingLayersReduce>((previous, incomingLayer, index) => {

            //
            // Find where (if at all) this layer is positioned in current data
            //

            const previousIndex = previousLayersByKey[incomingLayer.key]?.index

            //
            // Map existing positions (where known) onto incoming nodes
            //

            const currentNodes = incomingLayer.nodes.map((node) => {
                if (previousNodesByRoomId[node.roomId]) {
                    if (node.cascadeNode) {
                        return {
                            ...node,
                            fx: previousNodesByRoomId[node.roomId].x,
                            fy: previousNodesByRoomId[node.roomId].y,
                        }    
                    }
                    else {
                        return {
                            ...node,
                            x: previousNodesByRoomId[node.roomId].x,
                            y: previousNodesByRoomId[node.roomId].y,
                        }    
                    }
                }
                return node
            })

            //
            // Apply create or update, and check whether forceRestart needs to be set
            //

            if (previousIndex !== undefined) {
                const layerToUpdate = this.layers[previousIndex]
                if (previousIndex !== index) {
                    forceRestart = true
                }
                const layerUpdateResult = layerToUpdate.update(currentNodes, incomingLayer.links, forceRestart, previous.layers.length > 0 ? () => previous.layers[previous.layers.length-1].nodes : () => []) ?? false
                forceRestart = forceRestart || layerUpdateResult

                return {
                    layers: [
                        ...previous.layers,
                        this.layers[previousIndex]
                    ],
                    previousLayersByKey: {
                        ...previous.previousLayersByKey,
                        [incomingLayer.key]: {
                            ...previous.previousLayersByKey[incomingLayer.key],
                            found: true
                        }
                    }
                }
            }

            //
            // If no match, you have a new layer (which needs to be created) and which should
            // cause a forceRestart cascade
            //

            forceRestart = true
            return {
                layers: [
                    ...previous.layers,
                    new MapDThreeIterator(
                        incomingLayer.key,
                        incomingLayer.nodes,
                        incomingLayer.links
                    )
                ],
                previousLayersByKey: previous.previousLayersByKey
            }
        }, {
            layers: [],
            previousLayersByKey
        })

        //
        // If some layers have been removed, their DThree simulation processes should be stopped.
        //
        Object.values(processedLayers).filter(({ found }) => (!found))
            .forEach(({ simulation }) => { simulation.stop() })

        this.layers = newLayers
        this.layers.forEach((layer, index) => {
            layer.setCallbacks(this.cascade(index).bind(this), this.checkStability.bind(this))
        })
        this.checkStability()
    }
    //
    // checkStability re-evaluates the stability of the entire stack of simulation layers.  Used as
    // a callback for each individual simulation layer.
    //
    checkStability(): void {
        let wasStable = this.stable
        this.stable = true
        let previousLayerStable = true
        this.layers.forEach((layer, index) => {
            this.stable = this.stable && layer.stable
            if (!this.stable) {
                layer.liven(previousLayerStable)
            }
            previousLayerStable = previousLayerStable && layer.stable
        })
        //
        // If all layers have reached stability, call onStability with an aggregate of all nodes in all simulations
        // (overwriting by roomIds for the time being)
        //
        if (this.stable && !wasStable) {
            this.onStability(Object.values(this.layers.reduce<Record<string, SimNode>>((previous, layer) => ({
                ...previous,
                ...(layer.nodes.reduce<Record<string, SimNode>>((previous, { roomId, ...rest }) => ({ ...previous, [roomId]: { roomId, ...rest } }), {}))
            }), {})))
        }
    }
    //
    // dragNode and endDrag dispatch events to set forces on the appropriate layer
    //
    dragNode({ roomId, x, y }: { roomId: string, x: number, y: number }): void {
        const layerToMessage = this.layers.find(({ nodes }) => (nodes.find((node) => (node.roomId === roomId))))
        if (layerToMessage) {
            layerToMessage?.dragNode({ roomId, x, y })
            this.checkStability()
        }
    }
    endDrag(): void {
        this.layers.forEach((layer) => { layer.endDrag() })
    }
    //
    // cascade takes positions from layer index and cascades them forward to later layers
    //
    cascade(startingIndex: number) {
        return () => {
            if (startingIndex < 0 || startingIndex >= this.layers.length ) {
                throw new Error('MapDThree cascade index out of bounds')
            }
            this.layers.forEach((layer, index) => {
                if (index >= startingIndex) {
                    //
                    // If cascading off of the topmost layer of the simulation, deliver to simulation onTick
                    //
                    //
                    // TODO:  Assign onTick only to the topmost layer
                    //
                    if (index === this.layers.length - 1) {
                        this.onTick(this.nodes)
                    }
                }
            })
        }
    }
}

export default MapDThreeStack
