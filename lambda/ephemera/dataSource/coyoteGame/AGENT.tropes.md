# Coyote plan tropes (conceptual grounding)

**Purpose:** Shared vocabulary for how Wile E. Coyote-style plans are composed in this system. Use this document when designing prompts, rubrics, masks, and phase-plan structures in [`generators/pipelines/hypothesis/`](generators/pipelines/hypothesis/) and [`generators/pipelines/outcome/`](generators/pipelines/outcome/). Package overview: [`AGENT.md`](AGENT.md).

---

## Overview

Coyote plans are constructed from a small, fixed set of tropes. The trope system is intentionally constrained to reflect the genre conventions of the Road Runner cartoons specifically --- not all logically possible plans, but the recognizable formula that defines the format.

Plans are assembled as **ordered sequences** of up to four optional trope slots. The ordering is fixed and genre-definitional: it reflects the production convention that Coyote always prepares in advance, alone, before the Road Runner arrives. A plan that violates the ordering is not merely suboptimal --- it is not a Wile E. Coyote plan.

---

## The four tropes

### 1. Contraption

**Position:** Always first, if present.

An elaborate system, device, or preparation that tilts things in the Coyote's favor --- typically independent of any direct effect on the Road Runner. The Coyote does something clever to himself, his capabilities, or his environment before engagement begins.

Examples: rocket-powered roller skates, a motorcycle helmet, leg-muscle pills, an elaborate pipe-and-pulley delivery system, a catapult pre-aimed at a specific location.

The defining quality is Acme-ness and pre-commitment: the Coyote has assembled something and is ready to deploy it. The contraption is always built before the Road Runner arrives --- the cartoon never shows the Road Runner watching it being assembled.

---

### 2. Distraction

**Position:** Second, if present. Requires Road Runner's unawareness.

The first Road-Runner-facing action in any plan. A distraction manipulates the Road Runner's attention, curiosity, or appetite to bring him to a specific location or hold him momentarily in place. It relies entirely on the Road Runner not yet knowing anything is wrong.

Examples: a plate of birdseed, a fake detour sign, a painted shortcut on a cliff face.

**Critical constraint:** Distraction must always be the first Road-Runner-facing trope. It cannot follow Disadvantage or any other trope that would have already alerted the Road Runner. The moment the Road Runner is aware of the plan, the distraction gambit is blown.

---

### 3. Disadvantage

**Position:** Third, if present. Can be the first Road-Runner-facing trope if Distraction is absent.

A persistent state imposed on the Road Runner that reduces his options, mobility, or awareness. Unlike Distraction (a punctual event that creates a window), Disadvantage is a condition that continues to apply.

Examples: a barrel dropping over him, glue on the road, marbles, knockout gas, a net, high-iron birdseed in a plan that also involves a magnet.

---

### 4. Finishing move

**Position:** Always last, if present.

The definitive, unambiguous, no-escape resolution the Coyote intends to deliver. Not merely a final action but a *committed* final action --- the Coyote is certain this ends things. This intentionality matters: the more definitive the intended finishing move, the more catastrophically it can misfire in execution.

Two subtypes:

- **Area payload** --- affects a zone (explosives, bees, chlorine gas).
- **Point payload** --- targets a specific location or individual (harpoon, anvil, thrown boulder, lightning rod).

---

## Chase as connective tissue

**Chase is not a trope.** It is the implicit resolution assumed whenever a sequence does not end with an explicit Finishing Move.

When the final trope in a sequence is Contraption, Distraction, or Disadvantage, the understood completion is: "...and then the Coyote catches him." This does not need to be stated in the sequence --- it is genre-assumed.

Chase can also appear as mid-sequence connective tissue when a Contraption is specifically an approach mechanism (rocket skates, a jet-powered pogo stick) --- in which case the contraption *is* the chase, and the sequence closes either implicitly or with a Finishing Move.

The Coyote is a maximally optimistic planner. His plans are golden-path walkthroughs, not flowcharts. There are no contingencies, no branches, no fallback positions. This is genre-definitional and should be reflected in all plan generation.

---

## Sequence assembly

A valid plan is any combination of the four tropes in the fixed order above, with all four optional:

```
[Contraption?] -> [Distraction?] -> [Disadvantage?] -> [Finishing Move?]
```

The all-absent sequence (no tropes at all) is valid: it represents the Coyote's opening gambit of simply running after the Road Runner unaided.

This yields **16 possible sequence shapes**. The valid sequence for any given item set is determined by a **possibility mask** --- a prior assessment of which trope slots the available items could support (at varying confidence levels). The possibility mask constrains but does not determine the final sequence: multiple valid candidates can be generated from the same mask, and a rubric selects among them.

---

## Deriving trope details from objects

Trope **slots** are ordered and sparse; **details** (what the contraption actually is, how the finishing move is staged) are derived by reading the staged object set and committing to a single optimistic causal story. This section describes patterns for that derivation.

### Contraption deduction

Start by relating **construction-adjacent materials** (wood, nails, pipes, rope, brackets, sheet metal, etc.) to **non-construction items**, especially anything that wants to live in a **Finishing Move** (explosives, traps, ranged weapons, area hazards). The question is not "what can be built from wood alone?" but "what **sort of advantage** does the Coyote need so that those other objects make sense as the endgame?"

Typical bridges from materials to advantage:

- **Speed and pursuit** --- very fast vehicles or mobility rigs so the Coyote can **catch up** with the Road Runner after the opening beats.
- **Position and angles** --- vehicles or stable platforms that attack **from unexpected directions** (hot air balloons, tunneling machines, suspended rigs, cliff-side gantries) so the payload is not a fair footrace on the road.
- **Self-upgrade** --- pills, serums, exercise machines, spring shoes, etc., to **inflate the Coyote's physical abilities** so later beats are plausible.
- **Standoff delivery** --- pipe runs, catapults, conveyor-and-trigger rigs, remote pullies, timers, so the Coyote can **place and fire finishing-move payloads without standing in the blast radius** (the genre loves "I am nowhere near when it goes off," followed immediately by the universe proving him wrong).

#### Rube Goldberg optimistic causality

When several object clusters do not collapse into one minimal gadget, use **Rube Goldberg optimistic-causality logic**: chain clusters with a single imagined sequence of transfers, fires, releases, and mechanical handoffs, each step treated as guaranteed on the golden path. The Coyote narrates the world as if friction, timing, weather, and bird psychology were all cooperating.

Example shape (illustrative): a **giant conveyor belt**, a **hot plate**, **string**, and a **player piano** compose a timer or detonator train --- a tumbleweed (or any moving MacGuffin) is **delivered** on the belt, **heated** on the plate, **burns through** the string, **releases a catch** that **starts** the piano, and a particular bar in the roll **triggers** finishing-move hardware staged elsewhere. Nothing is "wasted": each object earns its moment in the causal chain.

This is a deliberate answer to the design tension **"There is a simple solution here, but it ignores half the objects."** Over-complication is not clutter --- it is the **structure** that lets every prop stay on stage while preserving a single straight-line plan (still no branches; just more optimistic links).

### Finishing move deduction

Finishing moves can also absorb surplus objects through **gauntlet** staging: the Road Runner is intended to **run through** (or be chased into) **so many consecutive assassination attempts** that **one** of them is taken to be certain to land. The Coyote does not frame this as "if A fails, try B" --- there is still **one** committed story --- but the **volume** of discrete hazards stacked along the route is **gratuitous overkill**, not contingency planning.

That distinction matters for generation: **backup plans** (branching, explicit fallbacks) are out of genre; **gauntlet overkill** (one path, absurd density of terminal hazards) is in genre and is another lever when **too many objects** compete for a single finishing beat. Rube-style chains and gauntlet density can be combined --- a Goldberg contraption delivers the Road Runner into a corridor of finishers --- as long as the narrative remains a single golden-path walkthrough.

---

## Artistic supplies and animator logic

**Artistic supplies** (paint, brushes, pencils, ink, chalk, spray cans, canvas or backdrop panels, oversized erasers, drafting tools, etc.) sit in a special place in the Coyote trope universe. They must be read with **two** stacks of affordances --- ordinary prop logic **and** Looney Tunes **cartoon literalism**.

### Distraction versus reality edits

On the mundane reading, paint supplies support **Distraction**: a fake sign, a decorative lure, anything that steers attention or appetite.

On the genre reading, the same supplies support **convincing alterations of reality**. That is **especially true in outcome calculation** (what actually happens on screen): a painted tunnel or highway on a solid rock face is **treated as real for locomotion** until the fiction snaps back --- classic payoff: the Road Runner passes through unscathed while the Coyote **slams into stone at lethal cartoon speed**. That beat is not "paint as cosmetic"; it is **paint as temporary world-building**, staged in advance (Contraption-aligned prep) so that the Road Runner's mistaken physics becomes the hinge for a terminal collision or fall.

**Plan narration is different.** Wile E. Coyote **does not usually plan in terms of cartoon literalism** --- he does not rely on meta rules like "the animator will make the brushstroke traversable." His *stated* intention is the near cousin: a **perfectly realistic illusion** --- signage or scenery so persuasive that the Road Runner will misread it as real terrain at speed. Optimistic trompe-l'oeil stagecraft fits the golden-path voice; literal "we are drawings" logic is usually how the **audience** rationalizes the gag after the fact, not how he briefs himself. Props that **advertise impossible affordances** blur the line: if he orders a **giant eraser**, the fiction can lean toward *intending* erasure-as-editing, because the prop itself cues cartoon-causal readings.

Mapping objects to tropes here is fuzzy in a useful way: the **tunnel-on-the-wall** gag is simultaneously pre-drawn staging, first Road-Runner-facing misdirection where unawareness matters, and setup for a **Finishing Move** delivered as that wall impact (even if slapstick substitutes for on-screen lethality). Generators should allow that overlap rather than forcing a single literal label.

### Hanging a lantern on animation

Many Looney Tunes gags **literalize the animator's job inside the fiction**: anything that edits the image --- erasing, repainting, revealing a new cel --- can **do what an animator does from outside the story**. That is the convention of **hanging a lantern on the animated nature of the world**: the audience is reminded that this is drawn film, and the characters temporarily live under drawing rules.

So a **giant eraser** is not merely "rubber debris" or "classroom stationery" in realistic logistics. In genre, it may **erase obstacles, limbs, cliffs, or background** exactly as-if the acetate were being revised. That is wildly implausible for a literal logistics planner --- and precisely why **plain object lists under-predict** Coyote plans unless prompts call this reading out.

### Prompting implication

Assume that models (and human readers steeped in realism) will **under-use** artistic supplies unless instructed. When the staged set includes art or drafting props, bias generation toward:

- explicit **cartoon-causal** links (paint creates traversable illusion; eraser deletes more than pigment; chalk fixes a horizon line the characters must obey until the gag releases it);
- confidence that these readings are **in-bounds** for Road Runner tone, not cheat codes or physics bugs.

This is additive to Acme gadgetry and Rube chains --- another vocabulary for tying **clusters of unrelated objects** into one golden-path story --- but it requires **positive prompting** because it violates everyday physical planning.

---

## Key constraints summary

- Contraption is always pre-engagement preparation; it cannot occur after Road Runner contact.
- Distraction requires Road Runner unawareness; it cannot follow any trope that would have alerted him.
- Disadvantage is a persistent imposed state; it follows Distraction naturally but cannot precede it.
- Finishing Move is always terminal; nothing follows it.
- Chase is implicit resolution, not a sequence node.
- Plans have no branches or contingencies --- always a single golden-path walkthrough.
