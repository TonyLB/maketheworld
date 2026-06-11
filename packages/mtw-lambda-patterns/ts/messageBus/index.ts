export type InternalMessageBusCallbackProps<PayloadType> = {
    payloads: PayloadType[];
    messageBus: InternalMessageBus<PayloadType>;
}

export type DeferralRegistration = {
    onClear?: () => void
    afterSettled: () => Promise<void>
}

type UnconstrainedInternalMessageSubscription<PayloadType> = {
    tag: string;
    priority: number;
    filter: (payload: PayloadType) => boolean;
    callback: (props: InternalMessageBusCallbackProps<PayloadType>) => Promise<void>;
}

type ConstrainedInternalMessageSubscription<PayloadType, P extends PayloadType> = {
    tag: string;
    priority: number;
    filter: (payload: PayloadType) => payload is P;
    callback: (props: { payloads: P[]; messageBus: InternalMessageBus<PayloadType> }) => Promise<void>;
}

function assertSubscriptionCallback<PayloadType>(
    subscription: UnconstrainedInternalMessageSubscription<PayloadType> | ConstrainedInternalMessageSubscription<PayloadType, any>,
    stage: 'subscribe' | 'publish'
): void {
    if (typeof subscription.callback !== 'function') {
        const callbackType = typeof subscription.callback
        throw new TypeError(
            `InternalMessageBus ${stage} error: subscription "${subscription.tag}" at priority ${subscription.priority} has non-function callback (${callbackType}).`
        )
    }
}

export class InternalMessageBus<PayloadType> {
    _subscriptions: (UnconstrainedInternalMessageSubscription<PayloadType> | ConstrainedInternalMessageSubscription<PayloadType, any>)[] = []
    _inFlight: Map<Promise<void>, string> = new Map()
    _deferrals: Map<string, DeferralRegistration> = new Map()

    publish(payload: PayloadType): void {
        const matchingSubscriptions = this._subscriptions.filter(({ filter: filterFunc }) => filterFunc(payload))
        for (const subscription of matchingSubscriptions) {
            const { tag, callback } = subscription
            if (typeof callback !== 'function') {
                throw new TypeError(
                    `InternalMessageBus publish error: subscription "${tag}" at priority ${subscription.priority} has non-function callback (${typeof callback}).`
                )
            }
            const promise = callback({
                payloads: [payload],
                messageBus: this,
            }).finally(() => {
                this._inFlight.delete(promise)
            })
            this._inFlight.set(promise, tag)
        }
    }

    subscribe<P extends PayloadType>(props: UnconstrainedInternalMessageSubscription<PayloadType> | ConstrainedInternalMessageSubscription<PayloadType, P>): void {
        assertSubscriptionCallback(props, 'subscribe')
        this._subscriptions.push(props)
    }

    registerDeferral(tag: string, hooks: DeferralRegistration): void {
        if (this._deferrals.has(tag)) {
            throw new Error(`InternalMessageBus registerDeferral error: deferral "${tag}" is already registered.`)
        }
        this._deferrals.set(tag, hooks)
    }

    async runDeferrals(): Promise<void> {
        const entries = [...this._deferrals.entries()]
        const results = await Promise.allSettled(entries.map(([, { afterSettled }]) => afterSettled()))
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                const tag = entries[index][0]
                console.error(`InternalMessageBus runDeferrals: deferral "${tag}" rejected:`, result.reason)
            }
        })
    }

    async settle(): Promise<boolean> {
        let didWork = false
        while (this._inFlight.size > 0) {
            didWork = true
            const snapshot = [...this._inFlight.entries()]
            const results = await Promise.allSettled(snapshot.map(([promise]) => promise))
            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    const tag = snapshot[index][1]
                    console.error(`InternalMessageBus settle: subscription "${tag}" rejected:`, result.reason)
                }
            })
        }
        return didWork
    }

    async flushAndSettle(): Promise<void> {
        while (await this.settle()) {
            // outer loop; settle inner loop drains recursive publish
        }
        await this.runDeferrals()
    }

    clear(): void {
        this._inFlight.clear()
        for (const { onClear } of this._deferrals.values()) {
            onClear?.()
        }
    }
}
