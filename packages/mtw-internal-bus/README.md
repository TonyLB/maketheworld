The internal bus decouples different steps of processing in a single job,
so that they can be reasoned about as if they were entirely separate jobs
with isolated inputs and outputs.

Needs Addressed
===============

- System needs an abstraction over the complicated passing of data back and
forth between very different functional modes
- System needs to be able to order the processing of consequences, distinct from
the function calls, in order to batch calculations, messages, and updates that
are best done together
- System needs to be able to order the processing of consequences, in order
to minimize recalculation for processes that depend upon "earlier" processes
completion

Usage
=====

```ts
    type MessagePayloadOne = {
        type: 'payloadOne';
        glueId: string;
        blahBlahBlah: Record<string, number>;
    }

    type MessagePayloadTwo = {
        type: 'payloadTwo';
        conferenceKey: string;
        values: string[];
    }

    type MessagePayloads = MessagePayloadOne | MessagePayloadTwo

    const messageBus = new InternalMessageBus<MessagePayloads>()

    const filterOne = (payload: MessagePayloads): payload is MessagePayloadOne => (payload.type === 'payloadOne')

    const computeOne = async ({
        payloads: MessagePayloadOne[],
        messageBus: InternalMessageBus<MessagePayloads>
    }): void => {}

    messageBus.subscribe({
        tag: 'functionOne',
        filter: filterOne,
        callback: computeOne,
        priority: 5
    })

    messageBus.send({
        type: 'payloadOne',
        glueId: 'test',
        blahBlahBlah: {}
    })

    await messageBus.flush()
```

Behavior
========

The message bus is a stream handler, not a queue:  Messages are retained in the bus even after they have
been processed by one subscription, and can be processed by other subscriptions (possibly in different
groupings with different sibling messages).  However, each message is tagged for a given subscription
when it is processed by that subscription:  Messages should *not* be processed twice by the same
subscription, in any grouping.

Subscriptions are executed in ascending priority order.  All asynchronous calls in a given priority (even
if multiple subscriptions share that same priority value) execute in parallel.  Higher priority subscriptions
await the completion of lower priority ones.

After the execution of a priority-group of subscriptions, the entire queue is re-evaluated.  If new
messages have been included at lower priorities, this may mean that the priority of calls being executed
moves backwards (i.e. you execute subscriptions at priority 2, which create a message at priority 1 ...
after that layer of execution, the subscriptions at priority 1 will execute on the new messages).  This
is generally worth avoiding in code, as it partly defeats the purpose of the message bus in **simplifying**
reasoning about the code.  Best practice is that if functions subscribed at priority N create messages,
those messages should have no subscriptions at priority < N.  The bus will raise console warnings if this
best practice is violated.