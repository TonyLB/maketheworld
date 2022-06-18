---
---

# Message Manager

The Message Lambda manages storage of messages, keeping track of logs and character history.

---

## Needs Addressed

---

***Message Deltas***
- For a given character, the manager should optimize *fetch* on a question of this form (even if
that optimization costs resources at *insert* time):
    - "Show me all messages received by this character after time T"
- For a given message and list of targets (either rooms or characters) the application needs to
be able to both:
    - Store that the message was delivered to those targets, and
    - Deliver that message as needed to active socket connetions
... in as simple a manner as possible

---

## Outlets

- ***update handler***: Handler for DynamoDB event on **messages** table, which:
    - Records the messages in the messageDelta table
    - Delivers the messages to open sockets connected with those targets

---

## Database Formats

### General payload structures

***Shared Base***:
    - CreatedTime: epoch time in milliseconds
    - DisplayProtocol:  One of: 'RoomDescription', 'RoomUpdate', 'FeatureDescrption', 'WorldMessage', 'SayMessage', 'NarrateMessage', 'OOCMessage'

**TODO: Define formats specific to each DisplayProtocol**

***RoomDescription***:

***FeatureDescription***:

***RoomUpdate***:

***WorldMessage***:

***SayMessage***:

***NarrateMessage***:

***OOCMessage***:

**TODO: Define the formats for meta-data in the Message and MessageDelta table**

### messages table

### message_delta table