//
// An SSM-centric implementation of Dijkstra's algorithm to find the shortest path
// of choices between a current state and a desired state.
//

import { ISSMData, TemplateFromNodes, PotentialStateFromNodes, StringKeys } from './baseClasses'

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
const possibleIntents = <Nodes extends ISSMData>(
    node: PotentialStateFromNodes<Nodes>
): Array<keyof Nodes> => {
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

export const dijkstra = <Nodes extends ISSMData>(
    { startKey, endKeys, template }: { startKey: StringKeys<Nodes>, endKeys: StringKeys<Nodes>[], template: TemplateFromNodes<Nodes> }
): (StringKeys<Nodes>)[] => {
    type K = StringKeys<Nodes>
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
    const minEndKeysDistance = (nodes: Record<K, IDijkstraNode<K>>) => (
        endKeys.reduce<number>((previous: number, endKey: K) => (Math.min(previous, nodes[endKey]?.distance || Infinity)), Infinity)
    )
    let current = nodes[startKey]
    let breakout = 0
    while(minEndKeysDistance(nodes) === Infinity && breakout < 100) {
        breakout++
        const newDistance = current.distance + 1
        const currentKey = current.key
        const intents = possibleIntents<Nodes>(template.states[currentKey])
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
    if (minEndKeysDistance(nodes) === Infinity) {
        return []
    }
    else {
        const minDistance = minEndKeysDistance(nodes)
        const foundKey: K | undefined = endKeys.reduceRight<K | undefined>((previous, endKey) => ((nodes[endKey].distance === minDistance) ? endKey : previous), undefined)
        if (foundKey === undefined) {
            return []
        }
        else {
            let returnValue: K[] = [foundKey]
            current = nodes[foundKey]
            while(current.previous !== startKey && breakout < 10) {
                returnValue = [current.previous, ...returnValue]
                current = nodes[current.previous]
            }
            return returnValue
        }
    }
}

export default dijkstra
