import {
    SimulationNodeDatum,
    SimulationLinkDatum,
} from 'd3-force'
import { Link } from 'react-router-dom'
import { TypeOfTag } from 'typescript'

//
// Crib the algorithm from the d3-force link force implementation, and tweak it to allow
// a safe range between minimum and maximum distance, where no force is applied.
//

//
// TODO: Convert to Typescript
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

interface FlexLinkForceFunction<L extends { source: string, target: string }, N extends SimulationNodeDatum> {
  (alpha: number): void;
  //
  // Lots of tricky typescript overloaded function interfaces to attend to D3's function-chaining calling patterns
  //
  links(): L[];
  links(links: L[]): FlexLinkForceFunction<L, N>;
  nodes(): N[];
  nodes(nodes: N[]): FlexLinkForceFunction<L, N>;
  id(): { (arg: N): string };
  id(newId: { (arg: N): string }): FlexLinkForceFunction<L, N>;
  iterations(): number;
  iterations(iterations: number): FlexLinkForceFunction<L, N>;
  strength(): LinkCalculationFunction<L>;
  strength(arg: number | LinkCalculationFunction<L>): FlexLinkForceFunction<L, N>;
  minDistance(): LinkCalculationFunction<L>;
  maxDistance(arg: number | LinkCalculationFunction<L>): FlexLinkForceFunction<L, N>;
}

//
// This wrapper function repackages the ForceFlexLink class methods in the chainable syntax typical
// of D3 functions.  To do this it sets out the structure and implementations implied above.
//
export const forceFlexLink = <L extends { source: string, target: string }, N extends SimulationNodeDatum>(links: L[], nodes: N[]) => {
  const flexLink = new ForceFlexLink<L, N>(links || [], nodes || [])

  const force = (alpha: number) => {
    flexLink.applyForce(alpha)
  }

  //
  // Chainable methods are added as properties of the function, so that anyone possessing the
  // force function can update the internals in D3's standard syntax
  //
  function linksFunction(): L[]
  function linksFunction(links: L[]): FlexLinkForceFunction<L, N>
  function linksFunction(links?: L[]) {
    if (links !== undefined) {
      flexLink.setLinks(links)
      return force as unknown as FlexLinkForceFunction<L, N>
    }
    return flexLink.links
  }
  force.links = linksFunction

  function nodesFunction(): N[]
  function nodesFunction(nodes: N[]): FlexLinkForceFunction<L, N>
  function nodesFunction(nodes?: N[]) {
    if (nodes !== undefined) {
      flexLink.setNodes(nodes)
      return force as unknown as FlexLinkForceFunction<L, N>
    }
    return Object.values(flexLink.nodes)
  }
  force.nodes = nodesFunction

  function id(): { (arg: N): string }
  function id(newId: { (arg: N): string }): FlexLinkForceFunction<L, N>
  function id(newId?: { (arg: N): string }) {
    if (newId !== undefined) {
      flexLink.reindex(newId)
      return force as unknown as FlexLinkForceFunction<L, N>
    }
    return flexLink.id
  }
  force.id = id

  function iterations(): number
  function iterations(iterations: number): FlexLinkForceFunction<L, N>
  function iterations(iterations?: number) {
    if (iterations !== undefined) {
      flexLink.iterations = iterations
      return force as unknown as FlexLinkForceFunction<L, N>
    }
    return flexLink.iterations
  }

  function strength(): LinkCalculationFunction<L>
  function strength(strengthArg: number | LinkCalculationFunction<L>): FlexLinkForceFunction<L, N>
  function strength(strengthArg?: number | LinkCalculationFunction<L>) {
    if (strengthArg) {
      flexLink.strength = typeof strengthArg === "function" ? strengthArg : constant(+strengthArg)
      flexLink.initialize()
      return force as unknown as FlexLinkForceFunction<L, N>
    }
    return flexLink.strength
  }

  force.strength = strength

  function minDistance(): LinkCalculationFunction<L>
  function minDistance(minDistanceArg: number | LinkCalculationFunction<L>): FlexLinkForceFunction<L, N>
  function minDistance(minDistanceArg?: number | LinkCalculationFunction<L>) {
    if (minDistanceArg) {
      flexLink.minDistance = typeof minDistanceArg === "function" ? minDistanceArg : constant(+minDistanceArg)
      flexLink.initialize()
      return force as unknown as FlexLinkForceFunction<L, N>
    }
    return flexLink.minDistance
  }

  force.minDistance = minDistance

  function maxDistance(): LinkCalculationFunction<L>
  function maxDistance(maxDistanceArg: number | LinkCalculationFunction<L>): FlexLinkForceFunction<L, N>
  function maxDistance(maxDistanceArg?: number | LinkCalculationFunction<L>) {
    if (maxDistanceArg) {
      flexLink.maxDistance = typeof maxDistanceArg === "function" ? maxDistanceArg : constant(+maxDistanceArg)
      flexLink.initialize()
      return force as unknown as FlexLinkForceFunction<L, N>
    }
    return flexLink.maxDistance
  }

  force.maxDistance = maxDistance

  return force;
}

export default forceFlexLink
