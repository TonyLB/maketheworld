//
// An SSM-centric implementation of Dijkstra's algorithm to find the shortest path
// of choices between a current state and a desired state.
//

import {
    ISSMTemplate,
    ISSMStateKey,
    ISSMChoice
} from './index'

interface IDijkstraNode {
    key: ISSMStateKey;
    distance: number;
    previous: ISSMChoice;
    previousNode: ISSMStateKey;
    visited: Boolean;
}

export const dijkstra = (
    { startKey, endKey, template }: { startKey: ISSMStateKey, endKey: ISSMStateKey, template: ISSMTemplate }
): Array<ISSMChoice> => {
    const nodes: Record<ISSMStateKey, IDijkstraNode> = Object.keys(template.states)
        .reduce((previous, key) => ({
            ...previous,
            [key]: {
                key,
                distance: Infinity,
                visited: false,
                previous: undefined
            }
        }), {})
    nodes[startKey].distance = 0
    let current = nodes[startKey]
    while(nodes[endKey].distance === Infinity) {
        const choices = template.states[current.key].choices
        choices.forEach((choice) => {
            const examinedNode = nodes[choice.intended]
            if (current.distance + 1 < examinedNode.distance) {
                examinedNode.distance = current.distance + 1
                examinedNode.previous = choice
                examinedNode.previousNode = current.key
            }
        })
        current.visited = true
        const next = Object.values(nodes)
            .filter(({ visited }) => (!visited))
            .filter(({ distance }) => (distance !== Infinity))
            .reduce((previous: IDijkstraNode | undefined, node) => {
                if (!previous || node.distance < previous.distance) {
                    return node
                } else {
                    return previous
                }
            }, undefined)
        if (next === undefined) {
            break;
        }
        current = next
    }
    if (nodes[endKey].distance === Infinity) {
        return []
    }
    else {
        let returnValue: Array<ISSMChoice> = []
        current = nodes[endKey]
        while(current.previous) {
            returnValue = [current.previous, ...returnValue]
            current = nodes[current.previousNode]
        }
        return returnValue
    }
}

export default dijkstra
