import {
    SimulationNodeDatum,
} from 'd3-force';
import { MAP_WIDTH, MAP_HEIGHT } from '../Area/constants'

export const boundingForceFactory = <T extends SimulationNodeDatum>(nodes: T[]) => () => {
    nodes.forEach((node) => {
        node.x = Math.max(-((MAP_WIDTH / 2) - 40), Math.min((MAP_WIDTH / 2) - 40, node.x || 0))
        node.y = Math.max(-((MAP_HEIGHT / 2) - 40), Math.min((MAP_HEIGHT / 2) - 40, node.y || 0))
    })
}

export default boundingForceFactory
