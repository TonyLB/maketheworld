# Coyote plan tropes (conceptual grounding)

**Purpose:** Shared vocabulary for how Wile E. Coyote-style plans are composed in this system. Use this document when designing prompts, rubrics, masks, and phase-plan structures in [`generators/pipelines/hypothesis/`](generators/pipelines/hypothesis/) and [`generators/pipelines/outcome/`](generators/pipelines/outcome/). Package overview: [`AGENT.md`](AGENT.md).

---

## Overview

Coyote plans are constructed from a small, fixed set of tropes. The trope system is intentionally constrained to reflect the genre conventions of the Road Runner cartoons specifically --- not all logically possible plans, but the recognizable formula that defines the format.

Plans are assembled as **ordered sequences** of up to **six** optional trope slots (`Scene Dressing`, `Contraption`, `Bait`, `Misdirection`, `Disadvantage`, `Finishing Move`). At most **one phase per trope type** in a given plan. The ordering is fixed and genre-definitional: it reflects the production convention that Coyote always prepares in advance, alone, before the Road Runner arrives. A plan that violates the ordering is not merely suboptimal --- it is not a Wile E. Coyote plan.

---

## Two prop registers

Looney Tunes plans read staged objects in two registers:

1. **Causal tropes** (`Contraption` through `Finishing Move`) --- mechanical roles in the golden-path plan: devices, lures, illusions, imposed conditions, terminal payloads.
2. **Scene Dressing** --- **associative** props that complete a visual or thematic scene **without** contributing a causal mechanism. A racing helmet does not save the Coyote; it signals **what kind of scene** is being staged.

Without associative signal, enrich tends to invent weak causal readings on dressing props, candidate gen under-clusters obvious archetype spines, and plans miss beats like rocket skates plus helmet plus goggles (mobility anchor plus **racing-scene** dressing around a chase archetype). Archetype names emerge when dressing props **cluster** at candidate generation, not when each prop is tagged with a scenario label at enrich time.

Enrich and wire-format details for Scene Dressing narrowing live in [`AGENT.tropes.implementation.md`](AGENT.tropes.implementation.md).

---

## The six tropes

### 1. Scene Dressing

**Position:** Always first in canonical order, if present.

**Role:** Non-functional narrative association. Same `{ trope, aptness, narrowing }` shape as causal tropes on persisted objects, but the item **does not** supply a beat mechanism --- it makes association **machine-readable** for downstream clustering.

**Narrowing grain:** Names an **aesthetic or material category**, not an effect, scenario, or archetype. Good: `"racing gear"`, `"protective equipment"`, `"scientific apparatus"`, `"adventurous clothing"`. Wrong at enrich time: `"aviation"`, `"high-speed chase"` --- those belong on the **candidate** when compatible dressing narrowings cluster around a causal anchor.

**Affordances:** Scene Dressing rows do **not** carry `environmentAffordances` or `affordancesProvided` (non-functional trope).

**Downstream (hypothesis):** Props with **only** Scene Dressing fits (no non-Poor causal fits) are strong **expander** signal in stage-one `decisionFocus` ([`serializeStagedObjectsForCandidatePrompt.ts`](generators/pipelines/hypothesis/candidates/serializeStagedObjectsForCandidatePrompt.ts)). Props with **both** Scene Dressing and causal fits supply archetype hint **and** functional placement. Candidate gen should cluster compatible dressing narrowings into one **`Scene Dressing`** trope row rather than thin single-prop candidates ([`buildCandidatePrompt.ts`](generators/pipelines/hypothesis/candidates/buildCandidatePrompt.ts)).

Examples: helmet and goggles with `"protective equipment"` / `"racing gear"` around rocket skates; lab coat and safety goggles with `"scientific apparatus"` around a chemistry-set rig.

---

### 2. Contraption

**Position:** First among **causal** tropes when Scene Dressing is absent; immediately after Scene Dressing when both are present.

An elaborate system, device, or preparation that tilts things in the Coyote's favor --- typically independent of any direct effect on the Road Runner. The Coyote does something clever to himself, his capabilities, or his environment before engagement begins.

Examples: rocket-powered roller skates, leg-muscle pills, an elaborate pipe-and-pulley delivery system, a catapult pre-aimed at a specific location.

The defining quality is Acme-ness and pre-commitment: the Coyote has assembled something and is ready to deploy it. The contraption is always built before the Road Runner arrives --- the cartoon never shows the Road Runner watching it being assembled.

---

### 3. Bait

**Position:** Third in canonical order (second causal slot), if present.

Influences the Road Runner to **go to** or **stay in** a particular place or path through **voluntary** appetite, curiosity, or desire --- appetitive lure, desirable object, routing that the bird **chooses**.

Examples: a plate of birdseed, a fake detour sign that exploits trust or habit, a visible prize placed to steer motion.

**Critical constraint (golden-path voice):** **Bait** is for **choice-shaped** failure: the Road Runner picks the wrong lane or stop because something attractive or plausible pulls him that way. It assumes the usual genre reading where this beat still works as a lure before the bird has caught on to the full scheme in-story. It cannot follow a beat that has already **alerted** him in a way that collapses the lure (ordering relative to **Contraption** is fixed; relative to **Misdirection**, **Bait** comes first when both appear).

---

### 4. Misdirection

**Position:** Fourth in canonical order (third causal slot), if present.

Interferes with the Road Runner's ability to **accurately see or control** where he is going --- illusion of terrain, obscured vision, misleading optics, or steering/control failure framed as **misread** rather than a raw imposed debuff.

Examples: a **painted tunnel on a wall** (the illusion the bird treats as real at speed), camouflage, dazzle, trompe-l'oeil scenery that routes motion into peril.

**Contraption vs Misdirection:** The **machinery** that deploys or maintains a gag (for example a painting rig) can be **Contraption**; the **illusion surface or perceptual trap** the bird reacts to is **Misdirection**, not Contraption.

**Misdirection vs Disadvantage:** **Oil slick** tags **Disadvantage** when the plan assumes the bird **stops or is mobility-trapped** by loss of friction; tag **Misdirection** when the plan assumes **continued motion without adequate control** leads to peril. **Fake tunnel** (pure illusion terrain) is **Misdirection**-first.

A plan **may** include both **Bait** and **Misdirection**; when both appear they follow **canonical order** (**Bait** then **Misdirection**).

---

### 5. Disadvantage

**Position:** Fifth in canonical order (fourth causal slot), if present. Can be the first Road-Runner-facing trope if **Bait** and **Misdirection** are both absent (for example **Contraption** prep then an imposed state on the bird).

A persistent state imposed on the Road Runner that reduces his options, mobility, or effectiveness **independent of voluntary choice or mistaken perception** --- sticky feet, net, glue, knockout gas, ongoing impairment.

Examples: a barrel dropping over him, glue on the road, marbles, knockout gas, a net, high-iron birdseed with a magnet when the plan treats it as a **condition**, not a lure-only beat.

Unlike **Misdirection** (a perceptual misread at speed), **Disadvantage** is a **condition that keeps applying** until the gag releases it.

---

### 6. Finishing move

**Position:** Always last in canonical order, if present.

The definitive, unambiguous, no-escape resolution the Coyote intends to deliver. Not merely a final action but a *committed* final action --- the Coyote is certain this ends things. This intentionality matters: the more definitive the intended finishing move, the more catastrophically it can misfire in execution.

Two subtypes:

- **Area payload** --- affects a zone (explosives, bees, chlorine gas).
- **Point payload** --- targets a specific location or individual (harpoon, anvil, thrown boulder, lightning rod).

---

## Chase as connective tissue

**Chase is not a trope.** It is the implicit resolution assumed whenever a sequence does not end with an explicit Finishing Move.

When the final trope in a sequence is **Contraption**, **Bait**, **Misdirection**, or **Disadvantage**, the understood completion is: "...and then the Coyote catches him." This does not need to be stated in the sequence --- it is genre-assumed.

Chase can also appear as mid-sequence connective tissue when a Contraption is specifically an approach mechanism (rocket skates, a jet-powered pogo stick) --- in which case the contraption *is* the chase, and the sequence closes either implicitly or with a Finishing Move.

**Scene Dressing** does not replace chase-as-connective-tissue and does not add a terminal beat --- it frames the scene around causal slots without changing chase resolution rules.

The Coyote is a maximally optimistic planner. His plans are golden-path walkthroughs, not flowcharts. There are no contingencies, no branches, no fallback positions. This is genre-definitional and should be reflected in all plan generation.

---

## Sequence assembly

A valid plan is any combination of the **six** tropes in the fixed order below, with **each slot optional** (sparse sequences are normal):

```
[Scene Dressing?] -> [Contraption?] -> [Bait?] -> [Misdirection?] -> [Disadvantage?] -> [Finishing Move?]
```

The all-absent sequence (no tropes at all) is valid: it represents the Coyote's opening gambit of simply running after the Road Runner unaided.

This yields **64 possible sequence shapes** (each of six ordered slots may be present or absent). The valid sequence for any given item set is determined by a **possibility mask** --- a prior assessment of which trope slots the available items could support (at varying confidence levels). The possibility mask constrains but does not determine the final sequence: multiple valid candidates can be generated from the same mask, and a rubric selects among them.

---

## Deriving trope details from objects

Trope **slots** are ordered and sparse; **details** (what the contraption actually is, how the finishing move is staged) are derived by reading the staged object set and committing to a single optimistic causal story. This section describes patterns for that derivation.

Implementation-specific rollout policy for trope fields (including narrowing contract) lives in [`AGENT.tropes.implementation.md`](AGENT.tropes.implementation.md).

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

### Bait versus Misdirection versus trompe-l'oeil

On the mundane reading, some supplies support **Bait**: a fake sign, food imagery, anything that steers **attention or appetite** so the bird **voluntarily** goes where the Coyote wants.

On the genre reading, the same supplies often support **Misdirection**: **convincing alterations of perceived reality** --- signage or scenery so persuasive that the Road Runner **misreads** terrain at speed. That is **especially true in outcome calculation** (what actually happens on screen): a painted tunnel or highway on a solid rock face is **treated as real for locomotion** until the fiction snaps back --- classic payoff: the Road Runner passes through unscathed while the Coyote **slams into stone at lethal cartoon speed**. That beat is not "paint as cosmetic"; it is **paint as temporary world-building**, staged in advance (often **Contraption**-aligned prep for the staging gear) so that mistaken physics becomes the hinge for a terminal collision or fall.

**Plan narration is different.** Wile E. Coyote **does not usually plan in terms of cartoon literalism** --- he does not rely on meta rules like "the animator will make the brushstroke traversable." His *stated* intention is the near cousin: a **perfectly realistic illusion** --- optimistic trompe-l'oeil stagecraft fits the golden-path voice; literal "we are drawings" logic is usually how the **audience** rationalizes the gag after the fact, not how he briefs himself. Props that **advertise impossible affordances** blur the line: if he orders a **giant eraser**, the fiction can lean toward *intending* erasure-as-editing, because the prop itself cues cartoon-causal readings.

Mapping objects to tropes here is fuzzy in a useful way: the **tunnel-on-the-wall** gag is simultaneously pre-drawn staging (**Contraption** when the rig matters), **Misdirection** for the illusion surface, sometimes **Bait** if a lure clearly steers approach first, and setup for a **Finishing Move** delivered as that wall impact (even if slapstick substitutes for on-screen lethality). Generators should allow that overlap rather than forcing a single literal label.

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

- **Scene Dressing** is optional, always first when present, non-functional, and uses **categorical** narrowing only; omit `environmentAffordances` and `affordancesProvided` on Scene Dressing rows.
- **Contraption** is always pre-engagement preparation; it cannot occur after Road Runner contact.
- **Bait** covers **voluntary** routing and lure; **Misdirection** covers **perceptual** misread and misleading optics. When both apply, **Bait** precedes **Misdirection** in the fixed order.
- **Misdirection** is not **Contraption**: the painted illusion is **Misdirection**; a machine that paints it is **Contraption**.
- **Disadvantage** is an imposed condition independent of choice or mistaken perception; it follows **Misdirection** in order when both are present, and cannot precede **Bait** or **Misdirection**.
- **Finishing Move** is always terminal; nothing follows it.
- **Chase** is implicit resolution, not a sequence node.
- Plans have no branches or contingencies --- always a single golden-path walkthrough.
- **`environmentAffordances` vs `affordancesProvided`:** The constrained environment-affordance object list is not expected to need **Bait** or **Misdirection** roles on fixed environment rows in practice. **`affordancesProvided`** may still attach derived objects with **Bait** or **Misdirection** (for example a **Contraption** line such as an automatic birthday-cake oven with `affordancesProvided: [{ object: 'birthday cake', roles: ['Bait'] }]`). Acme harness copy for fixed environment tables can stay focused on **Contraption**, **Finishing Move**, and **Disadvantage** unless a concrete counterexample appears.
