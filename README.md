# Canvas Auto Child Selector

An Obsidian plugin that allows you to select a parent node and all its children in Canvas view with a single modifier click.

## Features

- **Modifier Click Selection**: Hold Ctrl (Windows/Linux) or Cmd (Mac) while clicking a node to select it along with all descendants
- **Recursive Selection**: Automatically selects all children, grandchildren, and deeper descendants
- **Edge Selection**: Includes all arrow connections from parent to child in the selection
- **Replace Selection**: Replaces the current selection with the parent and all its descendants

## Usage

1. Open a Canvas in Obsidian
2. Hold `Ctrl` (Windows/Linux) or `Cmd` (Mac)
3. Click on any node that has children (nodes with arrows pointing to other nodes)
4. The parent node, all descendants, and connecting edges will be selected

## Installation

### Manual Installation

1. Download the latest release from GitHub
2. Extract the files to your vault's plugins folder: `<vault>/.obsidian/plugins/canvas-auto-child-selector/`
3. Reload Obsidian
4. Enable the plugin in Settings → Community Plugins

### Development

1. Clone this repository to your vault's plugins folder
2. Run `npm install` to install dependencies
3. Run `npm run dev` to start compilation in watch mode
4. Make changes to `main.ts`
5. Reload Obsidian to test changes

## How It Works

The plugin intercepts click events on Canvas nodes when a modifier key is pressed. It then:

1. Identifies the clicked node
2. Traverses all edges originating from that node
3. Recursively follows edges to find all descendants
4. Selects all found nodes and their connecting edges
5. Replaces the current canvas selection

## Requirements

- Obsidian v0.15.0 or higher

## License

MIT

## Support

If you encounter any issues or have suggestions, please file an issue on GitHub.
