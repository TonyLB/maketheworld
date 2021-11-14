import {
    SimulationNodeDatum,
} from 'd3-force'

//
// Crib the algorithm from the d3-force link force implementation, and tweak it to allow
// a safe range between minimum and maximum distance, where no force is applied.
//

const constant = (x: number): { (): number } => (() => (x))

const jiggle = () => ((Math.random() - 0.5) * 1e-6)

type LinkCalculationFunction<L extends { source: string, target: string }> = { (link: LinkCalculationData<L>): number }

type LinkCalculationData<L extends { source: string, target: string }> = {
    link: L;
    minDistance: number;
    maxDistance: number;
    sourceCount: number;
    targetCount: number;
    bias: number;
    strength: number;
}

class ForceFlexLink <L extends { source: string, target: string }, N extends SimulationNodeDatum> extends Object {
    //
    // Core data
    //
    // Links is a non-mutated, read-only list
    //
    links: L[] = []
    //
    // Nodes is an index into existing data that will be mutated as a side-effect of the force
    //
    nodes: Record<string, N> = {}

    //
    // Force configuration settings
    //
    id: { (arg: N): string } = ({ index }) => (`${index}`)
    strength: LinkCalculationFunction<L> = ({ sourceCount, targetCount }) => (1 / Math.min(sourceCount, targetCount) )
    minDistance: LinkCalculationFunction<L> = constant(70)
    maxDistance: LinkCalculationFunction<L> = constant(120)
    iterations: number = 1
    calculationData: LinkCalculationData<L>[] = []


    indexNodes: { (nodes: N[]): Record<string, N> } = (nodes) => (nodes.reduce<Record<string, N>>((previous, node) => ({ ...previous, [this.id(node)]: node }), {}))

    //
    // Cache the calculation values needed for force application (and update whenever the
    // node or link data changes)
    //
    initialize() {
        const addToCounts = (state: Record<string, number>, target: string): Record<string, number> => ({
            ...state,
            [target]: (state.target ?? 0) + 1
        })
        const countsByNode = this.links.reduce<Record<string, number>>((previous, { source, target }) => (addToCounts(addToCounts(previous, source), target)), {})
        this.calculationData = this.links.map<LinkCalculationData<L>>((link) => {
            const sourceCount = countsByNode[link.source] ?? 0
            const targetCount = countsByNode[link.target] ?? 0
            const preliminaryCalculation: LinkCalculationData<L> = {
                link,
                sourceCount,
                targetCount,
                bias: sourceCount / (sourceCount + targetCount),
                minDistance: 70,
                maxDistance: 120,
                strength: 0
            }
            return {
                ...preliminaryCalculation,
                minDistance: this.minDistance(preliminaryCalculation),
                maxDistance: this.maxDistance(preliminaryCalculation),
                strength: this.strength(preliminaryCalculation)
            }
        })
    }

    constructor(links: L[], nodes: N[]) {
        super()
        this.links = links
        this.nodes = this.indexNodes(nodes)
    }

    reindex(newId: { (arg: N): string }): void {
        this.id = newId
        this.nodes = this.indexNodes(Object.values(this.nodes))
    }

    setLinks(links: L[]) {
        this.links = links
        this.initialize()
    }

    setNodes(nodes: N[]) {
        this.nodes = this.indexNodes(nodes)
        this.initialize()
    }

    applyForce(alpha: number) {
        this.calculationData.forEach(({ link, minDistance, maxDistance, strength, bias }, index) => {
            //
            // TODO:  Replace the below with a lookup into the live nodes data (rather than storing a link to that data
            // within the links object structure and mutating through the link ... yuck!)
            //
            const source = this.nodes[link.source]
            const sourceX = source?.x ?? 0, sourceY = source?.y ?? 0, sourceVx = source?.vx ?? 0, sourceVy = source?.vy ?? 0
            const target = this.nodes[link.target]
            const targetX = target?.x ?? 0, targetY = target?.y ?? 0, targetVx = target?.vx ?? 0, targetVy = target?.vy ?? 0
            let x = targetX + targetVx  - sourceX - sourceVx || jiggle();
            let y = targetY + targetVy - sourceY - sourceVy || jiggle();
            let l = Math.sqrt(x * x + y * y);
            if (l < minDistance) {
                l = (l - minDistance) / l * alpha * strength;
            }
            else {
                if (l > maxDistance) {
                    l = ((l - maxDistance) / (l - (maxDistance - minDistance))) * alpha * strength;
                }
                else {
                    l = 0
                }
            }
            x *= l
            y *= l
            target.vx = targetVx - x * bias
            target.vy = targetVy - y * bias
            
            source.vx = sourceVx + x * (1 - bias)
            source.vy = sourceVy + y * (1 - bias)
        })
    }
}

//
// This type replicates the chainable-function pattern of D3:
//    * If an argument is passed it side-effects the internal data, then returns the force function
//      that the method was chained off of
//    * If no argument is passed it returns the internal data
//
interface ChainableFlexFunction<L extends { source: string, target: string }, N extends SimulationNodeDatum, Arg> {
    (): Arg;
    (arg: Arg): FlexLinkForceFunction<L, N>;
}

//
// Some functions are handled somewhat differently:
//    * If they are passed a function, they store that function
//    * If they are passed a number, the store a constant function that returns that number
//
interface ChainableNumericFlexFunction<L extends { source: string, target: string }, N extends SimulationNodeDatum> {
    (): LinkCalculationFunction<L>;
    (arg: number | LinkCalculationFunction<L>): FlexLinkForceFunction<L, N>;
}

interface FlexLinkForceFunction<L extends { source: string, target: string }, N extends SimulationNodeDatum> {
    (alpha: number): void;

    links: ChainableFlexFunction<L, N, L[]>;
    nodes: ChainableFlexFunction<L, N, N[]>;
    id: ChainableFlexFunction<L, N, { (arg: N): string }>;
    iterations: ChainableFlexFunction<L, N, number>;
    strength: ChainableNumericFlexFunction<L, N>;
    minDistance: ChainableNumericFlexFunction<L, N>;
    maxDistance: ChainableNumericFlexFunction<L, N>;
}

//
// Find the subset of the keys that has numeric flex function types (to constrain assignment of those in the chaining function below)
//
type FlexLinkNumericKeys<L extends { source: string, target: string }, N extends SimulationNodeDatum> = {[P in keyof ForceFlexLink<L, N>]-?: ForceFlexLink<L, N>[P] extends LinkCalculationFunction<L> ? P : never }[keyof ForceFlexLink<L, N>]

//
// This wrapper function repackages the ForceFlexLink class methods in the chainable syntax typical
// of D3 functions.  To do this it sets out the structure and implementations implied above.
//
export const forceFlexLink = <L extends { source: string, target: string }, N extends SimulationNodeDatum>(links: L[], nodes: N[]) => {
    const flexLink = new ForceFlexLink<L, N>(links || [], nodes || [])

    const d3EmulationFactory = <T>(getForce: () => FlexLinkForceFunction<L, N>, setFunction: (arg: T) => void, getFunction: () => T): ChainableFlexFunction<L, N, T> => {
        return ((args?: T) => {
            if (args !== undefined) {
                setFunction(args)
                return getForce()
            }
            return getFunction()
        }) as ChainableFlexFunction<L, N, T>
    }

    const d3NumericEmulationFactory = (key: FlexLinkNumericKeys<L, N>, getForce: () => FlexLinkForceFunction<L, N>): ChainableNumericFlexFunction<L, N> => {
        const setFunction = (arg: LinkCalculationFunction<L>) => {
            flexLink[key] = arg
            flexLink.initialize()
        }
        const getFunction = () => flexLink[key]
        return ((args?: number | LinkCalculationFunction<L>) => {
            if (args !== undefined) {
                setFunction(typeof args === "function" ? args : constant(+args))
                return getForce()
            }
            return getFunction()
        }) as ChainableNumericFlexFunction<L, N>
    }

    const force: FlexLinkForceFunction<L, N> = Object.assign(
        (alpha: number) => {
            flexLink.applyForce(alpha)
        },
        {
            links: d3EmulationFactory(() => force, flexLink.setLinks.bind(flexLink), () => flexLink.links),
            nodes: d3EmulationFactory(() => force, flexLink.setNodes.bind(flexLink), () => Object.values(flexLink.nodes)),
            id: d3EmulationFactory(() => force, flexLink.reindex.bind(flexLink), () => flexLink.id),
            iterations: d3EmulationFactory(() => force, (iterations) => { flexLink.iterations = iterations }, () => flexLink.iterations),
            strength: d3NumericEmulationFactory("strength", () => force),
            minDistance: d3NumericEmulationFactory("minDistance", () => force),
            maxDistance: d3NumericEmulationFactory("maxDistance", () => force)
        //
        // Explicitly type to be "all the properties of the function, except the callable"
        //
        } as { [P in keyof FlexLinkForceFunction<L, N>]: FlexLinkForceFunction<L, N>[P] }
  )

  return force;
}

export default forceFlexLink
