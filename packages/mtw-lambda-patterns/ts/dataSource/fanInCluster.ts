export type FanInHandlerOptions = {
    deferralExecution: boolean
}

export abstract class FanInCluster<Leg, Ctx> {
    abstract canAcceptLeg(leg: Leg): boolean
    abstract canUnifyWith(other: FanInCluster<Leg, Ctx>): boolean
    abstract unifyWith(other: FanInCluster<Leg, Ctx>): void
    abstract registerLeg(leg: Leg): void
    abstract clusterIdentity(): string | null
    abstract get completed(): boolean
    abstract handler(ctx: Ctx, options: FanInHandlerOptions): Promise<void>
}

export type FanInClusterConstructor<
    Leg,
    Ctx,
    Cluster extends FanInCluster<Leg, Ctx> = FanInCluster<Leg, Ctx>
> = (leg: Leg) => Cluster | null
