# Abstraction kind: worked cases (temporary)

Worked cases for [the Abstraction kind plan](AGENT.abstractionKind.planning.md)'s Slice 0. **Delete this file when the slices' tests pin the cases**, after the plan's graduation sweep for inbound links.

## AK-1: the kind is not "whole"

**The lock being tested.** [Whole and part are roles, not kinds](AGENT.abstractionLayers.planning.md#locked-frame-parts-and-ports-2026-08-06): any rule that gives parts and wholes different behaviour is not a rule, because one object is both, at different levels, at once. EP-2a was closed partly on this ground: a tag meaning *this Object is an abstraction* looked like such a rule.

**The test.** The new kind passes if every rule it carries is keyed on what a component *is* (physical or conceptual, AK-5), and no rule is keyed on whether it is the whole or the part in a given hosting edge. It fails, and the plan stops, if any case makes something an Abstraction *because* it is an assembly of other things.

**The structural check, before the cases.** AK-4's pairing rule decides the hosting kind from the **unordered pair** of the two sides' kinds: Abstraction with Abstraction is `PartOf` or `SectionOf`; physical with Abstraction is `Associated` *with either side hosting*; physical with physical is a physical kind. Swapping host and member never changes the answer. So the rule cannot give a whole and a part different behaviour, which is exactly the property the lock asks for. "Never moved" (AK-4's consequence) and "present where a member is" (AK-3) attach to every Abstraction, whether it hosts or is hosted.

### C11: the Rube Goldberg machine

[C11](AGENT.abstractionLayers.corpus.planning.md#c11-the-rube-goldberg-machine): `RubeGoldbergMachine` with parts `Platform`, `String`, `Monkey`, `IroningBoard`, `AlarmClock`; the string crosses `ROOM#A` and `ROOM#B` and has parts of its own, down to spans.

- **Every component in the chain is physical.** The machine, the string, the span and the sub-spans can all be pointed at, carried in principle, and broken. None is conceptual, so by AK-5 none is an Abstraction. The chain stays Objects under `PartOf`, exactly as C11 records it, with every interior term both a part and a whole.
- **The machine spanning two rooms does not make it abstract.** It has a binding in each room, each binding's parents on one host, so it satisfies AK-2's physical-forest invariant as an Object. Multi-presence is several bindings, not a binding with several hosts.
- **Position-relativity (contraption from `ROOM#A`, furniture from `ROOM#B`) stays a presentation question**, as the plan's prior-record bullet already says. It is not a reason to mint an Abstraction, and the kind is not used to answer it.
- **The machine's purpose** (startle, ride, fall, alarm) *could* be authored as an Abstraction associated with the pieces. That would be a second component, conceptual by kind, alongside the physical machine; it would not replace the machine, so it is not the kind meaning "whole".

**Verdict: passes.** The kind is not used anywhere in C11, and the case's four-level whole/part chain is untouched.

### A nested Abstraction

The Moonbase Control System hosts a Life Support Subsystem (`PartOf`), which hosts an Air Recycling module (`PartOf`); the module is `Associated` with a physical scrubber in the hydroponics bay.

- **The subsystem is a part of the system and a whole of the module, at once**, under the same Abstraction-to-Abstraction kinds that Objects use with each other. Whole and part are roles inside the kind, as they are among Objects.
- **The system and the module carry the same rules**: never moved, present where a member is. Neither gains or loses a rule by being the outer or the inner one.

**Verdict: passes.**

**An observation for Slice 3, not part of AK-1.** By AK-3 the hydroponics bay gets a presence binding for "the Abstraction its scrubber is associated with". With nesting, which Abstraction's binding sits in the room's row: the module's, or the outermost system's, carrying the subsystem and module beneath it, as a physical whole's room binding carries its parts? The analogy with physical wholes suggests the outermost. This is a rule for the alignment step (AK-10, Slice 3's pure alignment rule), and the case belongs with Slice 3's tests.

## AK-1 result

Both cases pass. The kind marks physical against conceptual and never whole against part, and EP-2a's re-open trigger is met by AK-5's named need. The Slice 0 inventory applies the same test to each existing Object it lists: an Object becomes an Abstraction only if it is conceptual by kind, never because it is an assembly.
