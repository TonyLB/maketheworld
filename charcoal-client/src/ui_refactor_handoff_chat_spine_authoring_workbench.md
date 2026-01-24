# UI Refactor Handoff: Chat Spine + Authoring Workbench

## Purpose of this Document
This document is a **technical and conceptual hand-off** describing the *directional intent* and *first-iteration requirements* for a UI refactor. It is intended to be used by a Cursor IDE agent to plan and execute implementation steps with high fidelity to the existing codebase.

The goal of this refactor is **not** to fully realize collaboration, governance, or visibility management, but to establish a **stable UI spine and set of rituals** that make those future capabilities possible *without rework*.

---

## High-Level Direction

### Why a Chat-Focused Spine

The existing UI has grown organically around features, resulting in:
- Ad-hoc navigation surfaces
- Feature-specific panels and tabs
- Weak sense of *where the user is* in the world or system

This refactor represents a **deliberate architectural shift**, not a cosmetic cleanup.

The new UI is organized around a **chat-focused play spine** that acts as:
- The primary locus of user attention
- The canonical representation of "what is happening now"
- The surface to which all other activities return

This mirrors how users already understand the system:
- Play is experienced narratively and temporally
- Context is best conveyed through "what just happened" and "where am I now"

All other functionality (authoring, tutorials, collaboration, settings) must now be understood as **side-tracks** or **adjacent stances** relative to this spine, not peers competing for primary navigation.

This is an intentional simplification to reduce cognitive load and create a stable foundation for future growth.



### Core Design Goal
Create a UI organized around:

- A **chat-based play spine** that always represents *one coherent worldview*
- A **non-chat authoring workbench** used to edit *one asset at a time*
- Clear **entry and exit rituals** between play and authoring
- Minimal but explicit **placeholders for future complexity** (threads, visibility management, collaboration)

This refactor prioritizes:
- Cognitive legibility
- Single-focus surfaces
- Short edit → view → iterate loops

---

## Key Conceptual Distinctions (Must Be Preserved in UI)

### The Chat Spine as the System Anchor

The chat-based play spine is not merely a messaging interface.

It is the **system anchor**:
- The place users orient themselves
- The place world state is perceived
- The place authored changes become experiential

Any feature that cannot naturally return to the chat spine should be considered *out of scope* for this refactor or redesigned as a side-track.



### Worldviews vs Assets
- **Worldviews** are compositions of assets and represent what the play spine renders.
- **Assets** are the units of authorship (may contain many rooms, features, maps, knowledge items, etc.).
- Assets may participate in multiple worldviews simultaneously.

**Invariant**:
- The *play spine* always renders **one worldview**.
- The *authoring workbench* always edits **one asset**.

The UI must never imply that the user is directly editing a worldview.

---

## Directional UI Architecture

### Surface A: Play Spine (Always Present)

The Play Spine is the user’s "home" surface.

Responsibilities:
- Render the current worldview
- Maintain a scrolling transcript of story events
- Provide immediate experiential feedback for authored changes

Existing message types that remain valid:
- World events ("Night falls")
- Character actions
- Dialogue (screenplay style)
- OOC comments
- Perception / knowledge messages
- Room descriptions (explicit look)
- **Sticky Room Summary**
  - Exactly one at a time
  - Anchored at the top
  - Continuously updated as the worldview changes

Constraints:
- The play spine must never show multiple worldviews at once
- It must not surface asset mechanics directly

---

### Surface B: Authoring Workbench (Side-Track / Overlay)

The Authoring Workbench is a **non-chat editing surface**.

Characteristics:
- Opened from the play spine
- Edits exactly **one asset at a time**
- Has a clear, immediate "Return to Story" affordance
- Is reusable later as the container for:
  - Side-threads
  - Deliberation
  - Tutorials
  - Collaboration

Layout expectations:
- Desktop: side panel or overlay
- Mobile: full-screen sheet

#### Workbench Header (Critical)
Must always display:
- **Asset name** (primary)
- **Visibility state** (informational only, not editable yet)
  - e.g. "Private draft"
- Optional secondary context:
  - e.g. "Viewed in: Current location"

The header must be asset-first, not worldview-first.

---

## Entry Ritual (Play → Authoring)

### Intent
Entry into authoring is a **focus shift**, not a mode switch.

The ritual must:
1. Select an **asset** to work on
2. Establish (or confirm) the asset’s **current visibility state**

### UI Guidance (Iteration 1)

From the play spine, use language like:
- "Work on this place"
- NOT "Edit this room"

For the first iteration:
- Default to creating/opening the asset in the user’s **private draft worldview**
- Do not require visibility choice UI yet

This keeps the loop tight while preserving future flexibility.

---

## Exit Ritual (Authoring → Play)

### Intent
Exit rituals acknowledge authorship and resolve *attention*, not governance.

### Correct Framing
Do **not** ask:
- Where changes apply
- Which worldview to update
- Whether to publish

Instead:
- Restate the asset’s **current visibility state**
- Allow the user to accept it or defer to deeper configuration

### UI Shape (Iteration 1)

Minimal dialog or inline confirmation:

> You’ve made changes to **{Asset Name}**.
>
> Current visibility: **Private draft**
>
> - Looks good — return to the world
> - Manage visibility… *(stub / not implemented yet)*

For iteration 1:
- "Manage visibility" may be disabled or informational
- Returning simply resumes the play spine

---

## Development Default: Draft Worldview

To enable fast iteration *without* implementing full visibility management:

### Agreed Development Defaults

- Each player has **one personal draft worldview**
- By default:
  - Any new or edited asset is included in that draft worldview
  - No other worldviews include those assets
- The play spine for the dev user can render:
  - Canon worldview + personal draft overlay
  - OR directly render the draft worldview

This enables:
- Editing assets
- Immediately seeing results in play
- Testing interactions between multiple draft assets

### UI Requirement
- Somewhere visible (placard or header): label the current view as **Draft**

---

## What Is Explicitly Out of Scope for Iteration 1

This refactor **intentionally de-scopes** several existing UI areas.

These are *not removed from the system*, but are **not required to be fully reimplemented** in the new UI during the first iteration.

Specifically:

- Tutorials
- Account / Settings management
- Admin or moderation dashboards

### Rationale

These functions:
- Are meta-system concerns, not world concerns
- Do not need continuous access to the play spine
- Can temporarily live behind simple links, placeholders, or legacy routes

**Important for implementation planning**:
- Do NOT attempt to fully redesign Tutorials or Settings during this refactor
- Do NOT recreate prior tab-based navigation just to preserve access
- It is acceptable (and expected) to stub these as:
  - External routes
  - Minimal placeholder panels
  - Links that exit the main experience

The priority is to stabilize:
- Play
- Authoring
- The transition rituals between them

Once those are solid, Tutorials and Settings can later be reintroduced *as side-tracks that return to the chat spine*, rather than as competing primary modes.



Do **not** implement yet:
- Asset inclusion toggles
- Worldview selection UI
- Collaboration / invitations
- Side-thread messaging
- Moderation flows
- Canon promotion workflows

The UI must only leave **space** for these features.

---

## Critical Invariants (Do Not Break)

1. The play spine represents **one worldview at a time**
2. The workbench edits **one asset at a time**
3. Entry selects *what you are shaping*
4. Exit confirms *current visibility*, not final authority
5. Assets are never implied to be owned by a single room

---

## Immediate Implementation Checklist (for Cursor)

**Read this as a sequencing and scoping guide, not a full feature list.**

1. Establish the **chat-focused play spine** as the primary screen
   - One worldview rendered
   - Sticky room summary preserved
   - Existing message types retained
2. Remove or bypass existing tab-based primary navigation
   - Replace with a single, stable play surface
3. Introduce the **Authoring Workbench** as a side-track
   - Overlay / panel / sheet
   - Asset-focused editing only
4. Implement minimal **entry ritual** from play to workbench
   - "Work on this place" affordance
5. Implement minimal **exit ritual** back to play
   - Return-to-story action
   - Visibility acknowledgment (static)
6. Wire the play spine to render the player’s **draft worldview**
   - Enables immediate visual feedback for edits
7. Stub or isolate non-core features
   - Tutorials / Settings may be links or placeholders
   - No attempt at full reintegration in iteration 1

The success criterion for iteration 1 is:
> A single user can play, step aside to author, return to play, and immediately experience the results — all within a coherent chat-first UI.



1. Refactor layout into:
   - Play Spine (transcript + sticky room summary)
   - Authoring Workbench (overlay/panel)
2. Replace tab-based navigation with:
   - "Work on this place" entry affordance
3. Normalize authoring UI inside the workbench:
   - Consistent sections/cards
4. Add workbench header:
   - Asset name
   - Visibility label (static for now)
5. Implement Return-to-Story exit
6. Ensure play spine renders draft worldview for current user

---

## Guiding Sentence (Design Axiom)

> **The user edits assets while standing inside a worldview; visibility determines which worldviews experience those edits.**

This sentence should remain true as the system evolves.

