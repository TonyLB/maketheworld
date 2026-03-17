*Status: Draft - v1 world state system under active design and implementation.*

## Overview

The `lambda/ephemera/state` module owns the **runtime world-state model** for Ephemera.

- **Responsibility**: Track and expose the current world-state needed to render Rooms (and later Features and Maps) for characters.
- **Context**: Lives alongside perception and internalCache; provides the state inputs those systems need in order to choose which cached render to show.
- **Scope of v1**: Prototype a simple, Room-focused state system that can later be extended to other component types.

This document is the **durable description of what has been implemented**. For forward-looking design work and open questions, see `AGENT.v1.planning.md` in the same directory.

## Versioning and Planning

- **Current planning document**: `AGENT.v1.planning.md`
- **Current implementation focus**: Room world-state driving cache-backed Room renders through the perception system.

