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
    SUBSCRIBING: ISSMAttemptNode<testSSMData, {}>;
    SUBSCRIBED: ISSMChoiceNode;
    BRANCHING: ISSMAttemptNode<testSSMData, {}>;
    BRANCHED: ISSMChoiceNode;
    CONNECTING: ISSMAttemptNode<testSSMData, {}>;
    CONNECTED: ISSMChoiceNode;
    UNSUBSCRIBING: ISSMAttemptNode<testSSMData, {}>;
}

type testSSMKeys = keyof testSSMNodes

type TestGraph = GraphFromNodes<testSSMNodes>

type TestTemplate = TemplateFromNodes<testSSMNodes>

describe('SSM dijkstra algorithm', () => {
    const nullChoiceState = (): ISSMChoiceState<testSSMKeys> => ({
        stateType: 'CHOICE',
        choices: []
    })
    const nullAttemptState = (): Partial<ISSMAttemptState<testSSMKeys, testSSMData, {}>> => ({
        stateType: 'ATTEMPT',
        action: () => () => (Promise.resolve({}))
    })
    const baseGraph: TestTemplate = {
        initialState: 'INITIAL',
        initialData: { internalData: { value: '' }, publicData: {} },
        states: {
            ...([
                ['INITIAL', 'SUBSCRIBING'],
                ['SUBSCRIBED', 'CONNECTING'],
                ['BRANCHED', 'CONNECTING'],
                ['CONNECTED', '']
            ].reduce((previous, [key, next]) => ({ ...previous, [key]: {
                ...nullChoiceState(),
                choices: next ? [next] : [],
                externals: []
            } }), {})),
            ...([
                ['SUBSCRIBING', 'SUBSCRIBED', 'INITIAL'],
                ['BRANCHING', 'BRANCHED', 'SUBSCRIBED'],
                ['CONNECTING', 'CONNECTED', 'SUBSCRIBED'],
                ['UNSUBSCRIBING', 'INITIAL', 'INITIAL']
            ].reduce((previous, [key, resolve, reject]) => ({ ...previous, [key]: {
                ...nullAttemptState(),
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
            },
        }
        if (branchingGraph.states.SUBSCRIBED.stateType === 'CHOICE') {
            branchingGraph.states.SUBSCRIBED.choices = ['BRANCHING', 'CONNECTING']
        }
        expect(dijkstra({ startKey: 'INITIAL', endKeys: ['CONNECTED'], template: branchingGraph as any })).toEqual(['SUBSCRIBING', 'SUBSCRIBED', 'CONNECTING', 'CONNECTED'])

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
        expect(dijkstra({ startKey: 'INITIAL', endKeys: ['CONNECTED'], template: cyclicGraph as any })).toEqual(['SUBSCRIBING', 'SUBSCRIBED', 'CONNECTING', 'CONNECTED'])
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
        expect(dijkstra({ startKey: 'INITIAL', endKeys: ['CONNECTED'], template: disconnectedGraph as any })).toEqual([])

    })
})