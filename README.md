mcfunction commenter aims to automate useful comments for mcfunction files 

## Features

### Command: Declare Origins
When used in a mcfunction file in a open datapack, will insert a header comment that shows where the function is called from.
For example:
```mcfunction
#> from: namespace:load, namespace:install
```
## Requirements
None

## Extension Settings
Coming soon

## Known Issues
No issues found yet
You can report them on the [repository](https://github.com/Darukshock/mcfunction-commenter/issues)

## TODO
- Config
  - Multiline
  - Customise 'this'
  - Comment position / condition
- Detect from advancements, tags etc...