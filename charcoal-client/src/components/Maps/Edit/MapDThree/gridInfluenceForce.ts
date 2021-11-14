import {
    SimulationNodeDatum,
} from 'd3-force';

export const gridInfluenceForceFactory = <T extends SimulationNodeDatum>(nodes: T[], granularity: number) => (alpha: number) => {
    //
    // TODO: Experiment with replacing sqrtAlpha with alpha ... it may be causing wonky behavior
    //
    const sqrtAlpha = Math.sqrt(alpha)
    nodes.forEach((node) => {
        const targetX = Math.round((node.x || 0) / granularity) * granularity
        const targetY = Math.round((node.y || 0) / granularity) * granularity
        node.vx = (node.vx || 0) + (targetX - (node.x || 0)) * 0.4 * sqrtAlpha
        node.vy = (node.vy || 0) + (targetY - (node.y || 0)) * 0.4 * sqrtAlpha
    })
}

export default gridInfluenceForceFactory
