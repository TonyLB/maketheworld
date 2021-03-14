import { ISSMTemplate } from './index'
import dijkstra from './dijkstra'

describe('SSM dijkstra algorithm', () => {
    it('finds the shortest path', () => {
        const subscribeChoice = {
            intended: 'SUBSCRIBED',
            immediate: 'SUBSCRIBING',
            call: () => {}
        }
        const branchChoice = {
            intended: 'BRANCHED',
            immediate: 'BRANCHING',
            call: () => {}
        }
        const connectChoice = {
            intended: 'CONNECTED',
            immediate: 'CONNECTING',
            call: () => {}
        }
        const branchingGraph: ISSMTemplate = {
            initialState: 'INITIAL',
            states: {
                INITIAL: {
                    key: 'INITIAL',
                    choices: [subscribeChoice],
                    externals: []
                },
                SUBSCRIBING: {
                    key: 'SUBSCRIBING',
                    choices: [],
                    externals: ['SUBSCRIBED']
                },
                SUBSCRIBED: {
                    key: 'SUBSCRIBED',
                    choices: [connectChoice, branchChoice],
                    externals: []
                },
                BRANCHING: {
                    key: 'BRANCHING',
                    choices: [],
                    externals: ['BRANCHED']
                },
                BRANCHED: {
                    key: 'BRANCHED',
                    choices: [connectChoice],
                    externals: []
                },
                CONNECTING: {
                    key: 'CONNECTING',
                    choices: [],
                    externals: ['CONNECTED']
                },
                CONNECTED: {
                    key: 'CONNECTED',
                    choices: [],
                    externals: []
                }
            }
        }
        expect(dijkstra({ startKey: 'INITIAL', endKey: 'CONNECTED', template: branchingGraph })).toEqual([
            subscribeChoice,
            connectChoice
        ])

    })
    it('handles cyclic graphs', () => {
        const subscribeChoice = {
            intended: 'SUBSCRIBED',
            immediate: 'SUBSCRIBING',
            call: () => {}
        }
        const connectChoice = {
            intended: 'CONNECTED',
            immediate: 'CONNECTING',
            call: () => {}
        }
        const cyclicGraph: ISSMTemplate = {
            initialState: 'INITIAL',
            states: {
                INITIAL: {
                    key: 'INITIAL',
                    choices: [subscribeChoice],
                    externals: []
                },
                SUBSCRIBING: {
                    key: 'SUBSCRIBING',
                    choices: [],
                    externals: ['SUBSCRIBED']
                },
                SUBSCRIBED: {
                    key: 'SUBSCRIBED',
                    choices: [connectChoice,
                    {
                        intended: 'INITIAL',
                        immediate: 'UNSUBSCRIBING',
                        call: () => {}
                    }],
                    externals: []
                },
                UNSUBSCRIBING: {
                    key: 'UNSUBSCRIBING',
                    choices: [],
                    externals: ['INITIAL']
                },
                CONNECTING: {
                    key: 'CONNECTING',
                    choices: [],
                    externals: ['CONNECTED']
                },
                CONNECTED: {
                    key: 'CONNECTED',
                    choices: [],
                    externals: []
                }
            }
        }
        expect(dijkstra({ startKey: 'INITIAL', endKey: 'CONNECTED', template: cyclicGraph })).toEqual([
            subscribeChoice,
            connectChoice
        ])
    })
    it('handles pathless graphs', () => {
        const subscribeChoice = {
            intended: 'SUBSCRIBED',
            immediate: 'SUBSCRIBING',
            call: () => {}
        }
        const disconnectedGraph: ISSMTemplate = {
            initialState: 'INITIAL',
            states: {
                INITIAL: {
                    key: 'INITIAL',
                    choices: [subscribeChoice],
                    externals: []
                },
                SUBSCRIBING: {
                    key: 'SUBSCRIBING',
                    choices: [],
                    externals: ['SUBSCRIBED']
                },
                SUBSCRIBED: {
                    key: 'SUBSCRIBED',
                    choices: [],
                    externals: []
                },
                CONNECTING: {
                    key: 'CONNECTING',
                    choices: [],
                    externals: ['CONNECTED']
                },
                CONNECTED: {
                    key: 'CONNECTED',
                    choices: [],
                    externals: []
                }
            }
        }
        expect(dijkstra({ startKey: 'INITIAL', endKey: 'CONNECTED', template: disconnectedGraph })).toEqual([])

    })
})