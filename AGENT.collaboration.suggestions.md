# Stream of Consciousness

Purpose of suggestions is to organize and constrain the ways in which changes can be applied to existing assets, so that review can be done meaningfully

On the one hand, one could certainly conceive of an update that would need to be reviewed simultaneously across a large number of different assets, working
together to create a single change ... those kind of changes to code-files happen in Git repositories all the time.

But on the other hand: Code repositories are organized along principles of hierarchical modularity, where multiple files are _supposed_ to have intricate
interdependencies. Should our assets have the same dependency structures? Probably not: Code repositories frequently have an upside-down tree, where
many sub-modules are inherited by a module that pulls everything together. The WML asset system expects individual root-level assets to present independent
content, and for later inheriting modules to _modify_ that content rather than aggregating it into higher-order structures.

In that structure, asking somebody to review "One asset with small changes to assets A, B, and C" is asking them to understand *all* of A, B, and C just to
handle a single review. Maybe it makes sense to constrain the ways that people can suggest _changing_ an asset so that they can only apply their changes
to one asset at a time.

*Plus*, this is much, _much_ more technically feasible in terms of avoiding deadlock: We already have an `atomicLock` operator on our S3 files for
assets, and if the merging of an asset into underlying files requires gaining atomic locks on _multiple_ assets then we run very serious deadlock
risks.

So I'm thinking about restricting _alteration_ of existing assets (at least the ones that need review) as requiring (as part of publishing to the review
process) that the _subset_ of things that are being changed in an individual asset get extracted from any larger Draft document, before being reviewed
for merger (and applied).

There are a couple of specific cases to consider in that design. Given a draft document that _imports_ from Asset C and now wants to publish a Suggestion
to change Asset C, you could encounter:
- Changes that the user _doesn't_ want to publish (they only want to propose some of the changes they've drafted)
- Imports from other Assets that the user wants to _introduce_ into Asset C, from Asset B that C already imports (probably not a big deal)
- Imports that the user wants to introduce to Asset C, from Asset A that C _doesn't_ currently import (probably a big deal, should be flagged to user and in
review ... must evaluate graph structure to avoid circularity)
- Changes that the user wants to publish, but which include references to things not imported into C (and which imports the user doesn't want to introduce)
that need to be selectively filtered out
- New elements entirely, which the user wants to flag as suggestions for being added *into* Asset C ... so you can't _just_ subset based on imports from Asset C,
you need a UI to let people select what they're publishing

The end result of the publishing process should be an Asset that can be *merged* into C (using, probably, the `applyWML` outlet of the WML lambda) if review is
approved. For the Bootstrapping mode of collaboration (our current focus), this Suggestion/Apply process would be one of the major ways of updating and
expanding existing assets.

# Asset Suggestions - Agent Navigation Guide

## Overview

The Asset Suggestions system creates a structured pathway for community members to contribute improvements to existing world content, transforming individual creative work into community-driven world evolution. Rather than allowing direct modifications to established assets, the system channels creative energy through a proposal-and-review process that builds community consensus while preserving narrative stability.

### Purpose

The suggestions system addresses a fundamental tension in collaborative world-building: how to enable community creativity while maintaining the coherence and stability that makes shared fictional worlds compelling. By requiring that changes be proposed rather than directly applied, the system creates space for discussion, refinement, and collective decision-making about the world's evolution.

### Context

This system operates within the broader collaboration framework described in [`AGENT.collaboration.md`](AGENT.collaboration.md), particularly supporting the **Bootstrapping** and **Collaborative Storming** phases where rapid content iteration and community evaluation are essential. During these phases, the world needs both creative expansion and quality control, and suggestions provide the structured mechanism for balancing these needs.

### Key Concepts

- **Suggestion**: A community member's proposed improvement to existing world content, presented for community evaluation
- **Target Asset**: The specific existing asset that a suggestion aims to modify or enhance
- **Publishing Workflow**: The process by which authors transform their draft work into community proposals
- **Review Process**: The community evaluation and decision-making system for suggestions (future development)
- **Community Consensus**: The collective decision-making that determines which suggestions become part of the canonical world

### Core Goals

- **Channel Creative Energy**: Provide clear pathways for community members to contribute to world development
- **Build Community Consensus**: Create opportunities for discussion and collective decision-making about world changes
- **Preserve Narrative Stability**: Ensure that world changes reflect community agreement rather than individual preferences
- **Enable Quality Improvement**: Allow the community to collectively refine and enhance existing content
- **Support Collaborative Learning**: Help community members understand and contribute to established world elements

### Key Principles

- **Proposal-Based Change**: All modifications to existing assets must be proposed and evaluated, not directly applied
- **Community Ownership**: The community collectively decides which suggestions enhance the world
- **Respect for Existing Work**: Suggestions build upon and improve existing content rather than replacing it arbitrarily
- **Clear Contribution Pathways**: The system makes it obvious how community members can contribute to world development
- **Balanced Innovation**: Encourage creative improvements while maintaining the coherence that makes the world compelling

### Success Metrics

## User Roles

### Author UI

### Reviewer UI

## What tech needs to be developed