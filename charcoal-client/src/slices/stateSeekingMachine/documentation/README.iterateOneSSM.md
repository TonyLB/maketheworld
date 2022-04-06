---
---

# iterateOneSSM

This redux action executes one iteration/step of processing for a single State Seeking Machine.  This
is the basic core engine of the State Seeking Machine's self-maintaining functionality.

---

## Needs Addressed

---

- State Seeking Machines need to seek their desired state

---

## Usage

```ts
    dispatch(iterateOneSSM({
        getSSMData,
        internalStateChange: ({ newState, inProgress, data }: {
                newState: keyof Nodes,
                inProgress: keyof Nodes,
                data: InferredDataTypeAggregateFromNodes<Nodes>
            }) => (internalStateChange({ key, newState, inProgress, data })),
        internalIntentChange: ({ newIntent }: {
                newIntent: (keyof Nodes)[]
            }) => (setIntent({ key, intent: newIntent })),
        actions: {
            ...slice.actions,
            ...(Object.entries(publicActions)
                .reduce((previous, [functionName, value]) => ({
                    ...previous,
                    [functionName]: value(key)
                }), {})
            )
        }
    }))
```

---

## Behaviors

---

### Arguments

- ***getSSMData***:  A selector to pull SSM data for the particular state-machine out of Redux
- ***internalStateChange***: An action to update the state, and assign any update data
- ***internalIntentChange***: An action to update intent
- ***actions***: A set of actions that will be passed to functions called by the state machine

---

### Choice node

If the current node is a choice node, iterateOneSSM will change the state to the next node in the
closest path to a desired state.

---

### Redirect node

If the current node is a redirect node, iterateOneSSM will change the *intent* to the specified
new intent, and then execute otherwise as if it were a Choice node.

---

### Hold node

If the current node is a hold node, iterateOneSSM will execute the hold condition.  If the hold
condition is false, iterateOneSSM will do nothing.  If the hold condition is true, iterateOneSSM
will change the state to the specified next node.

---

### Action node

If the current node is an action node, iterateOneSSM will asynchronously execute the action
callback function, passing it the current public and internal data.  If the action eventually
resolves, iterateOneSSM will change the state to the "resolve" argument.  If the action
rejects, iterateOneSSM will change the state to the "reject" argument.  In either case, it will
update the internal and public data with the return values of the asynchronous callback.

---