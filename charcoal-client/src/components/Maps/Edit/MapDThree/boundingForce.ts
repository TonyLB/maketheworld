import {
    SimulationNodeDatum,
} from 'd3-force';

export const boundingForceFactory = <T extends SimulationNodeDatum>(nodes: T[]) => () => {
    nodes.forEach((node) => {
        node.x = Math.max(-260, Math.min(260, node.x || 0))
        node.y = Math.max(-160, Math.min(160, node.y || 0))
    })
}

export default boundingForceFactory
