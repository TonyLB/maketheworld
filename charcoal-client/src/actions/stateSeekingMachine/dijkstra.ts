//
// An SSM-centric implementation of Dijkstra's algorithm to find the shortest path
// of choices between a current state and a desired state.
//

import {
    ISSMTemplate
} from './index'
import { ISSMPotentialState } from './baseClasses'

interface IDijkstraNode<K extends string> {
    key: K;
    distance: number;
    previous: K;
    visited: boolean;
}

//
// TODO:  Figure out how to extract type requirements from the template, and limit
// dijkstra calculation without having to manually type at every step
//
const possibleIntents = <T extends ISSMTemplate>(
    node: ISSMPotentialState<keyof T["states"], T["initialData"]>
): Array<keyof T["states"]> => {
    switch(node.stateType) {
        case 'CHOICE':
            return node.choices
        case 'HOLD':
            return [node.next]
        case 'ATTEMPT':
            return [node.resolve]
        default:
            return []
    }
}

export const dijkstra = (
    { startKey, endKey, template }: { startKey: keyof typeof template.states, endKey: keyof typeof template.states, template: ISSMTemplate }
): (keyof typeof template.states)[] => {
    type K = keyof typeof template.states
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
        const currentKey = current.key as K
        const intents = possibleIntents<typeof template>(template.states[currentKey] as any)
        intents.forEach((intent) => {
            const examinedNode = nodes[intent as K]
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
