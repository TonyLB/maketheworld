The *processDown* directory holds all of the processing functions for top-down pass of
validation and processing on the wmlSchema semantic evaluation.

It contains all functions that need to know themselves and their direct-line parents

This contrast with the *processUp* directory, which holds all of the processing functions
for a bottom-up pass of validation and processing (where functions operate knowing only
themselves and their direct children).
