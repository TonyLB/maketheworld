import type { InternalMessageBus } from '../messageBus'
import { FanInCluster, FanInClusterConstructor } from './fanInCluster'

export class FanInClusterStore<
    Leg,
    Ctx,
    Cluster extends FanInCluster<Leg, Ctx> = FanInCluster<Leg, Ctx>
> {
    private readonly clusterConstructors: FanInClusterConstructor<Leg, Ctx, Cluster>[]
    private openPartials: Cluster[] = []
    private handlerContext: Ctx | undefined

    constructor(clusterConstructors: FanInClusterConstructor<Leg, Ctx, Cluster>[]) {
        this.clusterConstructors = clusterConstructors
    }

    setHandlerContext(ctx: Ctx): void {
        this.handlerContext = ctx
    }

    getOpenPartialCount(): number {
        return this.openPartials.length
    }

    async route(leg: Leg): Promise<void> {
        const ctx = this.requireHandlerContext()

        let target = this.openPartials.find((partial) => partial.canAcceptLeg(leg))
        if (!target) {
            for (const createCluster of this.clusterConstructors) {
                const seeded = createCluster(leg)
                if (seeded && seeded.canAcceptLeg(leg)) {
                    target = seeded
                    this.openPartials.push(target)
                    break
                }
            }
        }

        if (!target) {
            return
        }

        target.registerLeg(leg)
        this.unifyCompatiblePartials()
        await this.completeReadyPartials(ctx)
    }

    async settleDeferrals(): Promise<void> {
        const ctx = this.requireHandlerContext()
        const remaining = [...this.openPartials]
        this.openPartials = []

        for (const partial of remaining) {
            await partial.handler(ctx, { deferralExecution: true })
        }
    }

    clear(): void {
        this.openPartials = []
    }

    registerDeferral<PayloadType>(messageBus: InternalMessageBus<PayloadType>, tag: string): void {
        messageBus.registerDeferral(tag, {
            onClear: () => this.clear(),
            afterSettled: () => this.settleDeferrals(),
        })
    }

    private requireHandlerContext(): Ctx {
        if (this.handlerContext === undefined) {
            throw new Error('FanInClusterStore: handler context is not set. Call setHandlerContext before route or settleDeferrals.')
        }
        return this.handlerContext
    }

    private unifyCompatiblePartials(): void {
        let merged = true
        while (merged) {
            const beforeCount = this.openPartials.length
            this.openPartials = this.foldPartialsIntoClusters(this.openPartials)
            merged = this.openPartials.length < beforeCount
        }
    }

    private foldPartialsIntoClusters(partials: Cluster[]): Cluster[] {
        const groups = partials.reduce<Cluster[][]>((proposedClusters, partial) => {
            const matchIndex = proposedClusters.findIndex((group) =>
                group.some((existing) =>
                    existing.canUnifyWith(partial) || partial.canUnifyWith(existing)
                )
            )
            if (matchIndex === -1) {
                return [...proposedClusters, [partial]]
            }
            return proposedClusters.map((group, index) =>
                index === matchIndex ? [...group, partial] : group
            )
        }, [])

        return groups.reduce<Cluster[]>((mergedPartials, group) => {
            const unified = group.reduce<Cluster | null>((survivor, partial) => {
                if (!survivor) {
                    return partial
                }
                if (survivor.canUnifyWith(partial)) {
                    survivor.unifyWith(partial)
                    return survivor
                }
                if (partial.canUnifyWith(survivor)) {
                    partial.unifyWith(survivor)
                    return partial
                }
                return survivor
            }, null)
            return unified ? [...mergedPartials, unified] : mergedPartials
        }, [])
    }

    /**
     * Splits ready-vs-still-open and removes the ready ones from `openPartials` synchronously,
     * before awaiting any handler --- `route()` can be re-entered (via a nested `bus.publish()`
     * triggering another subscriber callback) while a handler's `await` is pending, so two
     * overlapping `route()` calls must not both see the same partial as "ready" in `openPartials`
     * and both flush it. Splitting first (no `await` between reading `this.openPartials` and
     * reassigning it) keeps that decision atomic with respect to JS's single-threaded interleaving,
     * which only occurs at `await` boundaries.
     */
    private async completeReadyPartials(ctx: Ctx): Promise<void> {
        const ready = this.openPartials.filter((partial) => partial.completed)
        if (ready.length === 0) {
            return
        }
        this.openPartials = this.openPartials.filter((partial) => !ready.includes(partial))
        for (const partial of ready) {
            await partial.handler(ctx, { deferralExecution: false })
        }
    }
}
