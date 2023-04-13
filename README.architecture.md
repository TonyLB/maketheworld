Architecture
============

Make the World's architecture is organized in several decoupled systems, that work together
to create the platform as a whole:

- ***Asset Manager***:  A Lambda function and associated storage (S3 and DynamoDB) that
holds all of the *creative assets* of the game ... the blueprints that underlie and structure
the world in action.  Broadly, when MTW needs to know *"How do I build this part of the world?"*
the Asset Manager is tasked with having that information on hand, and when a creator makes
something new the Asset Manager is there to save it and file it.\
\
Subsections of Asset Manager:
    - *Image Manager*: A simple utility function that accepts EventBridge commands to process
    a file in the *upload* bucket, resize and reformat it, and place it in the *images* bucket,
    then delete the original.

    - *WML Manager*: Functions associated with the .wml and associated .json files for each asset,
    which allows parsing new WML from the *upload* bucket and either rejecting invalid syntax or
    updating the WML and JSON files in the Assets bucket.

- ***Ephemera Manager***:  A Lambda function and associated storage (DynamoDB) that holds
the specific *instances* of the game's creative assets ... the actual places built from
the theoretical blueprints, and how they have been changed by player actions.  When MTW
needs to know *"What is the state of this place right now?" the Ephemera Manager is tasked
with having that information on hand, and when a player does something to change the world,
the Ephemera Manager is there to calculate all the consequences.\
\
Subsections of Ephemera Manager:
    - *Perception System*: Tasked with taking the current state of the world, and rendering
    a particular object as seen from the perspective of a particular character.

- ***Image Manager***: A simple utility Lambda function and associated *upload* and *images*
S3 buckets.  Image Manager accepts EventBridge commands to process a file in the *upload*
bucket, resize and reformat it, and place it in the *images* bucket, then delete the original.
- ***ExternalBus***:  An EventBridge bus for the different subsystems to communicate with
each other within the AWS ecosystem.  When Ephemera Manager needs to request a blueprint
from the Asset Manager, or Asset Manager needs to pass on changes and updates, the EventBus
is the way they communicate.
- ***Charcoal Client***:  The front-end web application that presents the entire 
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
- ***Normalizer***: While WML NormalForm records are straightforward to *read from*, they
are quite complicated to *write to* and particularly to update.  The Normalizer object
in the WML library packages a sophisticated update engine that allows adding, deleting
and replacing elements within an existing normal form.
