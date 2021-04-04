//
// An SSM-centric implementation of Dijkstra's algorithm to find the shortest path
// of choices between a current state and a desired state.
//

import {
    ISSMTemplate,
    ISSMPotentialState
} from './index'

interface IDijkstraNode<K extends string> {
    key: K;
    distance: number;
    previous: K;
    visited: boolean;
}

const possibleIntents = <K extends string>(
    node: ISSMPotentialState<K>
): K[] => {
    switch(node.stateType) {
        case 'CHOICE':
            return node.choices
        case 'ATTEMPT':
            return [node.resolve]
        default:
            return []
    }
}

export const dijkstra = <K extends string>(
    { startKey, endKey, template }: { startKey: K, endKey: K, template: ISSMTemplate<K> }
): K[] => {
    const nodes: Record<K, IDijkstraNode<K>> = Object.keys(template.states)
        .reduce((previous, key) => ({
            ...previous,
            [key]: {
                key,
                distance: Infinity,
                visited: false,
                previous: undefined
            }
        }), {}) as Record<K, IDijkstraNode<K>>
    nodes[startKey].distance = 0
    let current = nodes[startKey]
    let breakout = 0
    while(nodes[endKey].distance === Infinity && breakout < 100) {
        breakout++
        const newDistance = current.distance + 1
        const currentKey = current.key
        const intents = possibleIntents<K>(template.states[currentKey])
        intents.forEach((intent) => {
            const examinedNode = nodes[intent]
            if (newDistance < examinedNode.distance) {
                examinedNode.distance = newDistance
                examinedNode.previous = currentKey
            }
        })
        current.visited = true
        const next = (Object.values(nodes) as Array<IDijkstraNode<K>>)
            .filter(({ visited }) => (!visited))
            .filter(({ distance }) => (distance !== Infinity))
            .reduce((previous: IDijkstraNode<K> | undefined, node) => {
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
        let returnValue: K[] = []
        current = nodes[endKey]
        while(current.previous !== startKey && breakout < 10) {
            returnValue = [current.previous, ...returnValue]
            current = nodes[current.previous]
        }
        return returnValue
    }
}

export default dijkstra
