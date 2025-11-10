# Canvas Auto Child Selector

An Obsidian plugin that allows you to select a parent node and all its children in Canvas view with a single modifier click.

## Features

- **Alt-Click Shortcut**: Hold Alt while clicking a node to select it along with all descendants
- **Command Palette Commands**: Three commands for different selection modes
  - Select child nodes (direct children only)
  - Select child nodes (all descendants)
  - Select parent nodes
- **Configurable Settings**: Customize behavior through plugin settings
- **Multi-Node Support**: Select multiple nodes and apply operations to all of them
- **Edge Selection**: Optionally include arrow connections in the selection
- **Performance Safety**: Maximum recursion depth limit prevents infinite loops

## Usage

### Alt-Click Shortcut

1. Open a Canvas in Obsidian
2. Hold `Alt`
3. Click on any node that has children (nodes with arrows pointing to other nodes)
4. The parent node, all descendants, and connecting edges will be selected

### Command Palette

1. Select one or more nodes in Canvas
2. Open the command palette (`Ctrl/Cmd + P`)
3. Run one of these commands:
   - **Select child nodes (direct children only)** - Selects only immediate children
   - **Select child nodes (all descendants)** - Selects all descendants recursively
   - **Select parent nodes** - Selects all nodes with edges pointing to the selected node(s)

## Settings

Access settings via Settings → Community Plugins → Canvas Auto Child Selector

- **Enable Alt-click shortcut** - Toggle the Alt-click behavior on/off
- **Default to recursive selection** - When using Alt-click, select all descendants or just direct children
- **Select connecting edges** - Include edges/arrows in the selection along with nodes
- **Keep original selection** - Keep the initially selected node(s) in the final selection
- **Maximum recursion depth** - Safety limit for traversing deep hierarchies (default: 100)

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

The plugin provides two ways to select related nodes:

**Alt-Click Shortcut:**
1. Intercepts click events when Alt key is pressed
2. Identifies the clicked node after Canvas processes the click
3. Traverses edges based on your settings (recursive or direct)
4. Selects all found nodes and optionally their connecting edges

**Command Palette:**
1. Works with your current Canvas selection
2. Supports multiple selected nodes at once
3. Traverses edges in the specified direction (children or parents)
4. Respects all plugin settings for edge inclusion and recursion limits

## Requirements

- Obsidian v0.15.0 or higher

## License

MIT

## Support

If you encounter any issues or have suggestions, please file an issue on GitHub.
