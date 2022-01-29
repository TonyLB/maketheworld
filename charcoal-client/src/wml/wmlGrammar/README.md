The wml.ohm-bundle files are generated:  Only the wml.ohm file is original.

To regenerate (e.g. after changing the wml.ohm file), navigate to the src/wml directory, and
execute this command:  npx ohm generateBundles --withTypes 'wmlGrammar/*.ohm'