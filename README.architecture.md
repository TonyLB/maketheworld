Architecture
============

Make the World's architecture is organized in several decoupled _Data Products_, that work together
to create the platform as a whole. For the purposes of Make the World, "Data Product" means this:

> **Data Product**: A subsystem with complete authority over a specific domain of functional data.
> The Data Product is responsible for publishing immutable, timestamped data regarding its domain.
> It publishes this in two output modes:
> - Checkpoints available upon direct API request give a timestamped materialized view of the "current"
> state of the entire data as of that moment
> - Streams provide a subscribable set of events, both checkpoints (full data) and delta (changes)
> as the underlying data changes.


***WML***: A data product responsible for the low-level view of the *creative assets*
of the game ... the blueprints that underlie and structure
the world in action.  Broadly, when MTW needs to know *"How do I build this part of the world?"*
the WML data product is tasked with having that information on hand, and when a creator makes
something new WML accepts the calls to save it and file it.

Subsections of WML Data Product:

- *Image Manager*: A simple utility function that accepts EventBridge commands to process
    a file in the *upload* bucket, resize and reformat it, and place it in the *images* bucket,
    then delete the original.

- *WML Manager*: Functions associated with the .wml and associated .json files for each asset,
    which allows parsing new WML from the *upload* bucket and either rejecting invalid syntax or
    updating the WML and JSON files in the Assets bucket.

***Assets***:  A data product responsible for the higher level catalog view of the assets,
including Authorization links that grant particular players in the game access to assets or
sub-components of assets.


***Ephemera***:  A data product responsible for
the specific *instances* of the game's creative assets ... the actual places built from
the theoretical blueprints, and how they have been changed by player actions.  When MTW
needs to know *"What is the state of this place right now?" the Ephemera Manager is tasked
with having that information on hand, and when a player does something to change the world,
the Ephemera Manager is there to calculate all the consequences.

Subsections of Ephemera Manager:

- *Perception System*: Tasked with taking the current state of the world, and rendering
    a particular object as seen from the perspective of a particular character.

***ExternalBus***:  An EventBridge bus for the different subsystems to communicate with
each other within the AWS ecosystem.  Streamed updates are conveyed over the ExternalBus.

***Charcoal Client***:  The front-end web application that presents the entire 
user-interface of Make The World.

( To-Do:  Create a diagram that demonstrates how all of the subsystems connect together )

Libraries
=========

MTW has several libraries which are used throughout its architecture in order to give a
consistent programming framework:

- ***InternalBus***: An internally maintained bus within a given Lambda, which decouples
different steps of processing in complex jobs.
- ***WML***: The WML library contains a lexical parser for the World Markup Language,
which allows the definition of MTW assets and resources.
