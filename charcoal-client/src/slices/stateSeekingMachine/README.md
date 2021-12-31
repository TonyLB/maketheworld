The functions in the stateSeekingMachine directory do not create slices *directly*.
Rather, they are utility functions that permit the creation of a slice by providing
other information (much as an abstract class allows the instantiation of more
detailed concrete classes).

The functionality is to create a state machine that manages its own transition
from state to state, and which knows how to *initiate* a state transition in
order to seek out a final desired outcome state.  The end-goal is to be able
to specify a graph of the form "This is your starting state ... to reach new
state A, do *this* and, if the function succeeds, transition to A, etc." and
then be able to tell it "Do whatever you need to do, responding to failed calls
and outside circumstance, to get to (and keep yourself in) state Z when it is
possible."  This makes it easy to encapsulate otherwise complicated patterns
of communication between back-end and front-end.  When a Websocket connection
gets interrupted, for instance, a State-Seeking machine can say "In response
to that action, shift us to "Disconnected" state ... but we want to be in
"Connected" state.  An analysis of the graph shows that we get there by
moving to "Reconnecting" state and dispatching a connection call, so do that
and see what happens."