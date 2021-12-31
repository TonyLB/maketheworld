import dijkstra from './dijkstra'
import {
    ISSMAttemptNode,
    ISSMChoiceNode,
    ISSMChoiceState,
    ISSMAttemptState,
    GraphFromNodes,
    TemplateFromNodes
} from './baseClasses'

type testSSMData = {
    value: string;
}
type testSSMNodes = {
    INITIAL: ISSMChoiceNode;
    SUBSCRIBING: ISSMAttemptNode<testSSMData>;
    SUBSCRIBED: ISSMChoiceNode;
    BRANCHING: ISSMAttemptNode<testSSMData>;
    BRANCHED: ISSMChoiceNode;
    CONNECTING: ISSMAttemptNode<testSSMData>;
    CONNECTED: ISSMChoiceNode;
    UNSUBSCRIBING: ISSMAttemptNode<testSSMData>;
}

type testSSMKeys = keyof testSSMNodes

type TestGraph = GraphFromNodes<testSSMNodes>

type TestTemplate = TemplateFromNodes<testSSMNodes>

describe('SSM dijkstra algorithm', () => {
    const nullChoiceState = (key: testSSMKeys): ISSMChoiceState<testSSMKeys> => ({
        key,
        stateType: 'CHOICE',
        choices: []
    })
    const nullAttemptState = (key: testSSMKeys): Partial<ISSMAttemptState<testSSMKeys, testSSMData>> => ({
        key,
        stateType: 'ATTEMPT',
        action: () => () => (Promise.resolve({}))
    })
    const baseGraph: TestTemplate = {
        initialState: 'INITIAL',
        initialData: {},
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
            } }), {})) as TestGraph
        }
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
        expect(dijkstra({ startKey: 'INITIAL', endKey: 'CONNECTED', template: branchingGraph })).toEqual(['SUBSCRIBING', 'SUBSCRIBED', 'CONNECTING'])

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