import {
    SimulationNodeDatum,
    SimulationLinkDatum,
    Simulation,
    forceSimulation,
    forceX,
    forceY,
    forceCollide
} from 'd3-force'

import { SimCallback, MapNodes, MapLinks, SimNode } from './baseClasses'

import boundingForceFactory from './boundingForce'
import gridInfluenceForceFactory from './gridInfluenceForce'
import forceFlexLink from './forceFlexLink'
import cascadeForce from './cascadeForce'

export class MapDThreeIterator extends Object {
    key: string = ''
    _nodes: MapNodes = []
    _links: MapLinks = []
    simulation: Simulation<SimNode, SimulationLinkDatum<SimNode>>
    stable: boolean = true
    callback: SimCallback = () => {}
    onStability: SimCallback = () => {}
    get boundingForce() {
        return boundingForceFactory(this._nodes)
    }
    get gridInfluenceForce() {
        return gridInfluenceForceFactory(this._nodes, 50)
    }
    get forceFlexLink() {
        //
        // TODO: When we refactor to stop storing links by internal ID and store roomID, this will need to be changed.
        //
        const nodesById = this._nodes.reduce<Record<string, SimNode>>((previous, node) => ({ ...previous, [node.id]: node }), {})
        return forceFlexLink(
                this._links
                    .map(({ source, target, ...rest }) => ({ source: source as string, target: target as string, ...rest }))
                    .filter(({ source, target }) => (nodesById[source]?.cascadeNode === false || nodesById[target]?.cascadeNode === false)),
                this._nodes
            ).minDistance(70).maxDistance(180).id(({ id }: { id: string }) => (id))
    }
    get nodes() {
        return this._nodes
    }
    get links() {
        return this._links
    }
    constructor(key: string, nodes: MapNodes, links: MapLinks, getCascadeNodes?: () => MapNodes) {
        super()
        this.key = key
        this._nodes = nodes
        this._links = links
        this.simulation = forceSimulation(this._nodes)
        this.simulation
            .alphaDecay(0.15)

        if (getCascadeNodes) {
            this.simulation.force("cascade", cascadeForce(getCascadeNodes, this.nodes).id(({ roomId }) => roomId))
        }

        this.simulation
            .force("boundingBox", this.boundingForce)
            .force("gridDrift", this.gridInfluenceForce)
            .force("link", this.forceFlexLink)
            .force("collision", forceCollide(40).iterations(3))

        this.simulation.on('tick', () => {
            this.callback?.(this._nodes)
        })
        this.simulation.on('end', () => {
            this.stable = true
            this.onStability?.(this._nodes)
        })
    }
    //
    // Update at the individual layer level does a differential against old data, to check whether there are any additions
    // or deletions of nodes.  It returns that value to the controller, so that in the case of a change any successive layer
    // can be forced to also restart its simulation.
    //
    update(nodes: MapNodes, links: MapLinks, forceRestart: boolean = false, getCascadeNodes?: () => MapNodes): boolean {
        const nodesFound: Record<string, boolean> = this.nodes.reduce<Record<string, boolean>>((previous, node) => ({ ...previous, [node.roomId]: false }), {})
        type NestedLinkMap = Record<string, Record<string, boolean>>
        const linksFound: NestedLinkMap = this._links.reduce<NestedLinkMap>((previous, { source, target }) => {
            const sourceId = typeof source === "string" ? source : (source as SimNode).id
            const targetId = typeof target === "string" ? target : (target as SimNode).id
            if (sourceId && targetId) {
                return {
                    ...previous,
                    [sourceId]: {
                        ...(previous[sourceId] ?? {}),
                        [targetId]: false
                    }
                }
            }
            return previous
        }, {})
        this._links = links
        let anyDifference: boolean = false

        nodes.forEach((node) => {
            //
            // TODO:  As functionality expands, you will likely need to add some further comparisons here to see
            // whether the state of the nodes has changed in a way that requires resimulation (right now, the only
            // important state for them is what layer they are on)
            //
            if (nodesFound[node.roomId] !== undefined) {
                nodesFound[node.roomId] = true
            }
            else {
                anyDifference = true
            }
        })
        anyDifference = anyDifference || (Object.values(nodesFound).filter((found) => (!found)).length > 0)
        links.forEach(({ source, target }) => {
            const sourceId = typeof source === "string" ? source : (source as SimNode).id
            const targetId = typeof target === "string" ? target : (target as SimNode).id
            if (sourceId && targetId) {
                if (linksFound[sourceId] === undefined || linksFound[sourceId][targetId] === undefined) {
                    anyDifference = true
                }
                linksFound[sourceId] = {
                    ...linksFound[sourceId],
                    [targetId]: true
                }
            }
        })
        anyDifference = anyDifference || (Object.values(linksFound).filter((links) => (Object.values(links).filter((found) => (!found)))).length > 0)

        this.simulation.nodes(nodes)
        this._nodes = nodes
        if (anyDifference || forceRestart) {
            if (getCascadeNodes) {
                this.simulation.force("cascade", cascadeForce(getCascadeNodes, this._nodes).id(({ roomId }) => roomId))
            }
            this.simulation
                .force("boundingBox", this.boundingForce)
                .force("gridDrift", this.gridInfluenceForce)
                .force("link", this.forceFlexLink)
                .alpha(1.0)
                .restart()
            this.stable = false
        }
        return anyDifference
    }
    setCallbacks(callback: SimCallback, stabilityCallback: SimCallback) {
        this.callback = callback
        this.onStability = stabilityCallback
    }
    liven(first: boolean) {
        if (this.stable) {
            this.simulation.alpha(1).restart()
        }
        this.simulation.alphaTarget(first ? 0 : 1.0)
        this.stable = false
    }
    dragNode({ roomId, x, y }: { roomId: string, x: number, y: number }) {
        this.simulation?.nodes(this._nodes)
            .alpha(1)
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
        this.stable = false
    }
    endDrag() {
        //
        // TODO: Change alphaTarget assignment such that it assigns to some non-zero number for
        // layers that still have active layers below them, and to zero for the currently bottom-most
        // active layer.
        //
        this.simulation.force("draggingForceX", null).force("draggingForceY", null)
        if (this.simulation) {
            this.simulation.alphaTarget(0).restart()
        }
    }
}

export default MapDThreeIterator
