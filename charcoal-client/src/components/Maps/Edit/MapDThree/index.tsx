
import { MapTree } from '../maps'
import {
    SimulationNodeDatum,
    SimulationLinkDatum,
    Simulation,
    forceSimulation,
    forceX,
    forceY,
    forceCollide
} from 'd3-force'

import { SimNode } from './treeToSimulation'

import boundingForceFactory from './boundingForce'
import gridInfluenceForceFactory from './gridInfluenceForce'
import forceFlexLink from './forceFlexLink'
import treeToSimulation from './treeToSimulation';

export type SimCallback = (nodes: SimNode[]) => void

export class MapDThreeIterator extends Object {
    nodes: SimNode[] = []
    links: SimulationLinkDatum<SimulationNodeDatum>[] = []
    simulation: Simulation<SimNode, SimulationLinkDatum<SimNode>>
    callback: SimCallback = () => {}
    onStability: SimCallback = () => {}
    get boundingForce() {
        return boundingForceFactory(this.nodes)
    }
    get gridInfluenceForce() {
        return gridInfluenceForceFactory(this.nodes, 50)
    }
    get forceFlexLink() {
        return (forceFlexLink(this.links).minDistance(70) as any).maxDistance(180).id(({ id }: { id: string }) => (id))
    }
    constructor(tree: MapTree) {
        super()
        const { nodes, links } = treeToSimulation(tree)
        this.nodes = nodes
        this.links = links
        this.simulation = forceSimulation(this.nodes)
            .alphaDecay(0.15)
            .force("boundingBox", this.boundingForce)
            .force("gridDrift", this.gridInfluenceForce)
            .force("link", this.forceFlexLink)
            .force("collision", forceCollide(40).iterations(3))
        this.simulation.on('tick', () => {
            this.callback?.(this.nodes)
        })
        this.simulation.on('end', () => {
            console.log('Stability callback')
            this.onStability?.(this.nodes)
        })
    }
    update(tree: MapTree, lockThreshold?: number) {
        const previousNodesByRoomId = this.nodes.reduce<Record<string, SimNode>>((previous, node) => {
            return {
                ...previous,
                [node.roomId]: node
            }
        }, {})
        const { nodes, links } = treeToSimulation(tree, lockThreshold)
        this.links = links
        this.nodes = nodes.map((node) => {
            if (previousNodesByRoomId[node.roomId]) {
                return {
                    ...node,
                    x: previousNodesByRoomId[node.roomId].x,
                    y: previousNodesByRoomId[node.roomId].y,
                }
            }
            return node
        })
        this.simulation
            .nodes(this.nodes)
            .force("boundingBox", this.boundingForce)
            .force("gridDrift", this.gridInfluenceForce)
            .force("link", this.forceFlexLink)
            .alpha(1.0)
            .restart()
    }
    setCallbacks(callback: SimCallback, stabilityCallback: SimCallback) {
        this.callback = callback
        this.onStability = stabilityCallback
    }
    dragNode({ roomId, x, y }: { roomId: string, x: number, y: number }) {
        this.simulation?.nodes(this.nodes)
            .force("draggingForceX", forceX<SimNode>()
                .x(x)
                .strength(({ roomId: nodeRoomId }: SimNode) => (nodeRoomId === roomId ? 1 : 0))
            )
            .force("draggingForceY", forceY<SimNode>()
                .y(y)
                .strength(({ roomId: nodeRoomId }: SimNode) => (nodeRoomId === roomId ? 1 : 0))
            )
            .force("boundingBox", this.boundingForce)
            .force("gridDrift", this.gridInfluenceForce)
            .force("link", this.forceFlexLink)
            .restart()
        if (this.simulation && this.simulation.alpha() < 0.1) {
            this.simulation.alpha(1)
                .alphaTarget(0.5)
                .restart()
        }
    }
    endDrag() {
        this.simulation.force("draggingForceX", null).force("draggingForceY", null)
        if (this.simulation) {
            this.simulation.alphaTarget(0)
        }
    }
}

export type { SimNode }
export default MapDThreeIterator