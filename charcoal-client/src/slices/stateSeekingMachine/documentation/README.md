---
---

# State Seeking Machines

The functions in the stateSeekingMachine directory do not create slices *directly*.
Rather, they are utility functions that permit the creation of a slice by providing
other information (much as an abstract class allows the instantiation of more
detailed concrete classes).

The functionality is to create a state machine that manages its own transition
from state to state, and which knows how to *initiate* a state transition in
order to seek out a path to reach a desired outcome state.  The end-goal is to
be able to specify a graph of the form "This is your starting state ... to reach
new state A, do *this* and, if the function succeeds, transition to A, etc." and
then be able to tell it "Do whatever you need to do, responding to failed calls
and outside circumstance, to get to (and keep yourself in) state Z when it is
possible."  This makes it easy to encapsulate otherwise complicated patterns
of communication between back-end and front-end.  When a Websocket connection
gets interrupted, for instance, a State-Seeking machine can say "In response
to that action, shift us to "Disconnected" state ... but we want to be in
"Connected" state.  An analysis of the graph shows that we get there by
moving to "Reconnecting" state and dispatching a connection call, so do that
and see what happens."

---

## Needs Addressed

---

- Programmers need a straightforward way to offload complex responsive behavior
and have it automatically pursued

---

## Usage

First define base TypeScript constraints for the relevant classes, type-constraining
the possible states and their individual function:

```ts
    import { ISSMAttemptNode, ISSMChoiceNode, ISSMDataLayout, ISSMDataReturn, ISSMAction } from '../stateSeekingMachine/baseClasses'

    export interface LifeLineInternal {
        pingInterval: IntervalType | null;
        refreshTimeout: TimeoutType | null;
        messageSubscription: string | null;
        incrementalBackoff: number;
    }

    export interface LifeLinePublic {
        webSocket: WebSocket | null;
    }

    type LifeLineAttemptNode = ISSMAttemptNode<LifeLineInternal, LifeLinePublic>
    export interface LifeLineNodes {
        INITIAL: ISSMChoiceNode;
        SUBSCRIBE: LifeLineAttemptNode;
        CONNECT: LifeLineAttemptNode;
        CONNECTBACKOFF: LifeLineAttemptNode;
        CONNECTED: ISSMChoiceNode;
        DISCONNECT: LifeLineAttemptNode;
        UNSUBSCRIBE: LifeLineAttemptNode;
        STALE: ISSMChoiceNode;
        ERROR: ISSMChoiceNode;
    }
```

Next, define the actual slice being defined to serve this data:

```ts
    export const {
        slice: lifeLineSlice,
        selectors,
        publicActions,
        iterateAllSSMs
    } = singleSSM<LifeLineNodes, {}>({
        name: 'lifeLine',
        initialSSMState: 'INITIAL',
        initialSSMDesired: ['CONNECTED'],
        initialData: {
            internalData: {
                incrementalBackoff: 0.5,
                pingInterval: null,
                refreshTimeout: null,
                messageSubscription: null
            },
            publicData: {
                webSocket: null
            }
        },
        sliceSelector: ({ lifeLine }) => (lifeLine),
        publicReducers: {},
        publicSelectors: {},
        template: {
            initialState: 'INITIAL',
            initialData: {
                internalData: {
                    incrementalBackoff: 0.5,
                    pingInterval: null,
                    refreshTimeout: null,
                    messageSubscription: null
                },
                publicData: {
                    webSocket: null
                }
            },
            states: {
                INITIAL: {
                    stateType: 'CHOICE',
                    choices: ['SUBSCRIBE']
                },
                SUBSCRIBE: {
                    stateType: 'ATTEMPT',
                    action: subscribeMessages,
                    resolve: 'CONNECT',
                    reject: 'ERROR'
                },
                CONNECT: {
                    stateType: 'ATTEMPT',
                    action: establishWebSocket,
                    resolve: 'CONNECTED',
                    reject: 'ERROR'
                },
                CONNECTBACKOFF: {
                    stateType: 'ATTEMPT',
                    action: backoffAction,
                    resolve: 'CONNECT',
                    reject: 'ERROR'
                },
                CONNECTED: {
                    stateType: 'CHOICE',
                    choices: ['DISCONNECT']
                },
                DISCONNECT: {
                    stateType: 'ATTEMPT',
                    action: disconnectWebSocket,
                    resolve: 'UNSUBSCRIBE',
                    reject: 'ERROR'
                },
                UNSUBSCRIBE: {
                    stateType: 'ATTEMPT',
                    action: unsubscribeMessages,
                    resolve: 'INITIAL',
                    reject: 'ERROR'
                },
                ERROR: {
                    stateType: 'CHOICE',
                    choices: []
                },
                STALE: {
                    stateType: 'CHOICE',
                    choices: ['CONNECT']
                }
            }
        }
    })
```

---

## Behaviors

---

### Node Types

---

#### ***Choice***

---

A choice node has no functionality of its own, but allows the SSM to either stay at that node (if it is
already a desired state) or to move to any of a list of possible choices, according to what will best move it through
the graph to a desired state.

---

#### ***Attempt***

---

An attempt node calls an asynchronous action that can either resolve successfully or reject.  The
assumption is that resolve is the desired path (the pathing algorithm will never bet on an action
rejecting).  The SSM will hold further operations until the return of the asynchronous action, and
then transition states accordingly.

The asynchronous action is passed the following arguments:
- ***internalData***: The private, internal data that the SSM uses to manage its own state
- ***publicData***: The public data that the SSM stores (and accepts actions against) as part
of its user-facing mission
- ***actions***: The actions available on the SSM (both internal actions and those defined in
the publicReducers argument)

In either the *resolve* or *reject* case, the return value of the action is merged into the existing
internal and public data of the machine.

---

#### ***Hold***

---

A hold node is a gate-keeping check for the rest of the graph:  It includes a check function, and
if the check function returns false then the SSM will suspend further operations until such time
as the check function returns true.  Useful for SSMs whose operation requires the configuration of
some other part of the system (e.g., many SSMs depend upon the correct configuration of the WebSocket
LifeLine)

---