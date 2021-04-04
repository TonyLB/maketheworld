import { ISSMTemplate, ISSMPotentialState, ISSMChoiceState, ISSMAttemptState } from './index'
import dijkstra from './dijkstra'

type testSSMKeys = 'INITIAL' | 'SUBSCRIBING' | 'SUBSCRIBED' | 'BRANCHING' | 'BRANCHED' | 'CONNECTING' | 'CONNECTED' | 'UNSUBSCRIBING'

describe('SSM dijkstra algorithm', () => {
    const nullChoiceState = (key: testSSMKeys): ISSMChoiceState<testSSMKeys> => ({
        key,
        stateType: 'CHOICE',
        choices: [],
        externals: []
    })
    const nullAttemptState = (key: testSSMKeys): Partial<ISSMAttemptState<testSSMKeys>> => ({
        key,
        stateType: 'ATTEMPT',
        action: () => {}
    })
    const baseGraph: ISSMTemplate<testSSMKeys> = {
        initialState: 'INITIAL',
        states: {
            ...([
                ['INITIAL', 'SUBSCRIBING'],
                ['SUBSCRIBED', 'CONNECTING'],
                ['BRANCHED', 'CONNECTING'],
                ['CONNECTED', '']
            ].reduce((previous, [key, next]) => ({ ...previous, [key]: {
                ...nullChoiceState(key as testSSMKeys),
                choices: next ? [next] : [],
                externals: []
            } }), {})),
            ...([
                ['SUBSCRIBING', 'SUBSCRIBED', 'INITIAL'],
                ['BRANCHING', 'BRANCHED', 'SUBSCRIBED'],
                ['CONNECTING', 'CONNECTED', 'SUBSCRIBED'],
                ['UNSUBSCRIBING', 'INITIAL', 'INITIAL']
            ].reduce((previous, [key, resolve, reject]) => ({ ...previous, [key]: {
                ...nullAttemptState(key as testSSMKeys),
                resolve,
                reject
            } }), {}))
        } as unknown as Record<testSSMKeys, ISSMPotentialState<testSSMKeys>>
    }
    it('finds the shortest path', () => {
        let branchingGraph = {
            initialState: 'INITIAL' as testSSMKeys,
            states: {
                ...baseGraph.states
            }
        }
        if (branchingGraph.states.SUBSCRIBED.stateType === 'CHOICE') {
            branchingGraph.states.SUBSCRIBED.choices = ['BRANCHING', 'CONNECTING']
        }
        expect(dijkstra<testSSMKeys>({ startKey: 'INITIAL', endKey: 'CONNECTED', template: branchingGraph })).toEqual(['SUBSCRIBING', 'SUBSCRIBED', 'CONNECTING'])

    })
    it('handles cyclic graphs', () => {
        let cyclicGraph = {
            initialState: 'INITIAL',
            states: {
                ...baseGraph.states
            }
        }
        if (cyclicGraph.states.CONNECTED.stateType === 'CHOICE') {
            cyclicGraph.states.CONNECTED.choices = ['UNSUBSCRIBING']
        }
        expect(dijkstra({ startKey: 'INITIAL', endKey: 'CONNECTED', template: cyclicGraph })).toEqual(['SUBSCRIBING', 'SUBSCRIBED', 'CONNECTING'])
    })
    it('handles pathless graphs', () => {
        let disconnectedGraph = {
            initialState: 'INITIAL',
            states: {
                ...baseGraph.states
            }
        }
        if (disconnectedGraph.states.SUBSCRIBED.stateType === 'CHOICE') {
            disconnectedGraph.states.SUBSCRIBED.choices = []
        }
        expect(dijkstra({ startKey: 'INITIAL', endKey: 'CONNECTED', template: disconnectedGraph })).toEqual([])

    })
})