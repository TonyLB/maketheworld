import { v4 as uuidv4 } from 'uuid'

//
// The PubSub class creates a publisher for publish/subscribe patterns,
// with callbacks passed an unsubscribe parameter for easily cleaning up
// on temporary subscriptions
//

export class PubSub<D extends any> {
    subscriptions: {
        id: string;
        callback: (args: { payload: D; unsubscribe: () => void }) => void
    }[] = []
    unsubscribe = (id: string) => {
        this.subscriptions = this.subscriptions.filter((subscription: { id: string }) => (subscription.id !== id))
    }
    publish = (payload: D) => {
        (this.subscriptions ?? [])
            .forEach(({ callback, id }) => {
                callback({ payload, unsubscribe: () => { this.unsubscribe(id) }})
            })
    }
    subscribe = (callback: (args: { payload: D; unsubscribe: () => void}) => void) => {
        const id = uuidv4()
        this.subscriptions = [
            ...this.subscriptions,
            {
                id,
                callback
            }
        ]
        return id
    }
}