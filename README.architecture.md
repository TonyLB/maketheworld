Architecture
============

Make the World's architecture is organized in several decoupled systems, that work together
to create the platform as a whole:

- ***Asset Manager***:  A Lambda function and associated storage (S3 and DynamoDB) that
holds all of the *creative assets* of the game ... the blueprints that underlie and structure
the world in action.  Broadly, when MTW needs to know *"How do I build this part of the world?"*
the Asset Manager is tasked with having that information on hand, and when a creator makes
something new the Asset Manager is there to save it and file it.
- ***Ephemera Manager***:  A Lambda function and associated storage (DynamoDB) that holds
the specific *instances* of the game's creative assets ... the actual places built from
the theoretical blueprints, and how they have been changed by player actions.  When MTW
needs to know *"What is the state of this place right now?" the Ephemera Manager is tasked
with having that information on hand, and when a player does something to change the world,
the Ephemera Manager is there to calculate all the consequences.
- ***ExternalBus***:  An EventBridge bus for the different subsystems to communicate with
each other within the AWS ecosystem.  When Ephemera Manager needs to request a blueprint
from the Asset Manager, or Asset Manager needs to pass on changes and updates, the EventBus
is the way they communicate.
- ***Charcoal Client***:  The front-end web application that presents the entire 
user-interface of Make The World.
- ***Control Channel***:  An APIGateway Websocket service that connects the Charcoal client
in real-time to the back-end systems, letting creators create and players play.  By
relaying real-time update, the control channel also lets users see the impact of other
users in the same space (independent of their own commands).

( To-Do:  Create a diagram that demonstrates how all of the subsystems connect together )

Libraries
=========

MTW has several libraries which are used throughout its architecture in order to give a
consistent programming framework:

- ***InternalBus***: An internally maintained bus within a given Lambda, which decouples
different steps of processing in complex jobs.
- ***WML***: The WML library contains a lexical parser for the World Markup Language,
which allows the definition of MTW assets and resources.
- ***WMLQuery***: The WMLQuery library contains a JQuery-style domain-manipulator for
WML content, allowing programmatic search and edit of WML assets.