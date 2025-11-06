import { Plugin, PluginSettingTab, App, Setting } from 'obsidian';

interface CanvasNode {
	id: string;
	[key: string]: any;
}

interface CanvasEdge {
	id: string;
	fromNode: string;
	toNode: string;
	[key: string]: any;
}

interface Canvas {
	nodes: Map<string, CanvasNode>;
	edges: Map<string, CanvasEdge>;
	selection: Set<CanvasNode | CanvasEdge>;
	selectOnly: (items: (CanvasNode | CanvasEdge)[]) => void;
	getData: () => any;
}

interface CanvasView {
	canvas: Canvas;
	file: any;
}

interface CanvasAutoChildSelectorSettings {
	modifierKey: 'ctrl' | 'alt' | 'shift' | 'none';
}

const DEFAULT_SETTINGS: CanvasAutoChildSelectorSettings = {
	modifierKey: 'ctrl'
}

export default class CanvasAutoChildSelectorPlugin extends Plugin {
	settings: CanvasAutoChildSelectorSettings;

	async onload() {
		console.log('Loading Canvas Auto Child Selector plugin');

		// Load settings
		await this.loadSettings();

		// Add settings tab
		this.addSettingTab(new CanvasAutoChildSelectorSettingTab(this.app, this));

		// Register the click event handler for canvas
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			try {
				// Check if the configured modifier key is pressed
				const modifierPressed = this.isModifierPressed(evt);

				console.log('Canvas Auto Child Selector: Click detected', {
					modifierPressed,
					modifierKey: this.settings.modifierKey,
					ctrlKey: evt.ctrlKey,
					metaKey: evt.metaKey,
					altKey: evt.altKey,
					shiftKey: evt.shiftKey
				});

				if (!modifierPressed) {
					return;
				}

				// Get the active canvas view
				const canvasView = this.getActiveCanvasView();
				console.log('Canvas Auto Child Selector: Canvas view found:', !!canvasView);
				if (!canvasView) {
					return;
				}

				// Find the clicked node
				const clickedNode = this.getClickedNode(evt, canvasView);
				console.log('Canvas Auto Child Selector: Clicked node found:', !!clickedNode, clickedNode?.id);
				if (!clickedNode) {
					return;
				}

				// Prevent default selection behavior
				evt.preventDefault();
				evt.stopPropagation();

				console.log('Canvas Auto Child Selector: Selecting descendants for node:', clickedNode.id);

				// Select the parent and all its descendants
				this.selectNodeWithDescendants(clickedNode, canvasView.canvas);
			} catch (error) {
				console.error('Canvas Auto Child Selector error:', error);
			}
		}, true); // Use capture phase to intercept before canvas's handler
	}

	getActiveCanvasView(): CanvasView | null {
		try {
			// Get the active leaf
			const activeLeaf = this.app.workspace.activeLeaf;
			if (!activeLeaf) {
				return null;
			}

			// Check if the active view is a canvas
			const view = activeLeaf.view as any;
			if (view && view.getViewType && view.getViewType() === 'canvas' && view.canvas) {
				return view as CanvasView;
			}

			return null;
		} catch (error) {
			console.error('Error getting canvas view:', error);
			return null;
		}
	}

	getClickedNode(evt: MouseEvent, canvasView: CanvasView): CanvasNode | null {
		try {
			const target = evt.target as HTMLElement;

			// Find the canvas node element
			const nodeElement = target.closest('.canvas-node');
			if (!nodeElement) {
				return null;
			}

			// Try to get the node from the element's data
			const el = nodeElement as any;
			if (el.node) {
				return el.node;
			}

			// Try to get node ID from various possible attributes
			const nodeId = el.dataset?.id ||
			               el.getAttribute('data-id') ||
			               el.dataset?.nodeId ||
			               el.getAttribute('data-node-id') ||
			               el.id;

			if (nodeId && canvasView.canvas.nodes.has(nodeId)) {
				return canvasView.canvas.nodes.get(nodeId) || null;
			}

			return null;
		} catch (error) {
			console.error('Error getting clicked node:', error);
			return null;
		}
	}

	selectNodeWithDescendants(parentNode: CanvasNode, canvas: Canvas) {
		try {
			const nodesToSelect = new Set<CanvasNode>();
			const edgesToSelect = new Set<CanvasEdge>();

			// Add the parent node
			nodesToSelect.add(parentNode);

			// Recursively find all descendants
			this.findDescendants(parentNode, canvas, nodesToSelect, edgesToSelect);

			// Create array of all items to select
			const itemsToSelect = [
				...Array.from(nodesToSelect),
				...Array.from(edgesToSelect)
			];

			// Replace current selection with parent + descendants
			if (canvas.selectOnly) {
				canvas.selectOnly(itemsToSelect);
			}

			console.log(`Selected ${nodesToSelect.size} nodes and ${edgesToSelect.size} edges`);
		} catch (error) {
			console.error('Error selecting nodes:', error);
		}
	}

	findDescendants(
		parentNode: CanvasNode,
		canvas: Canvas,
		nodesToSelect: Set<CanvasNode>,
		edgesToSelect: Set<CanvasEdge>
	) {
		try {
			// Find all edges that originate from this parent
			for (const [edgeId, edge] of canvas.edges) {
				if (edge.fromNode === parentNode.id) {
					// This edge goes from parent to child
					edgesToSelect.add(edge);

					// Get the child node
					const childNode = canvas.nodes.get(edge.toNode);
					if (childNode && !nodesToSelect.has(childNode)) {
						// Add child node
						nodesToSelect.add(childNode);

						// Recursively find this child's descendants
						this.findDescendants(childNode, canvas, nodesToSelect, edgesToSelect);
					}
				}
			}
		} catch (error) {
			console.error('Error finding descendants:', error);
		}
	}

	isModifierPressed(evt: MouseEvent): boolean {
		switch (this.settings.modifierKey) {
			case 'ctrl':
				return evt.ctrlKey || evt.metaKey; // Ctrl on Windows/Linux, Cmd on Mac
			case 'alt':
				return evt.altKey;
			case 'shift':
				return evt.shiftKey;
			case 'none':
				return true; // Always active, no modifier needed
			default:
				return evt.ctrlKey || evt.metaKey;
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	onunload() {
		console.log('Unloading Canvas Auto Child Selector plugin');
	}
}

class CanvasAutoChildSelectorSettingTab extends PluginSettingTab {
	plugin: CanvasAutoChildSelectorPlugin;

	constructor(app: App, plugin: CanvasAutoChildSelectorPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Canvas Auto Child Selector Settings'});

		new Setting(containerEl)
			.setName('Modifier Key')
			.setDesc('Choose which modifier key to hold while clicking a parent node to select all children')
			.addDropdown(dropdown => dropdown
				.addOption('ctrl', 'Ctrl/Cmd (Default)')
				.addOption('alt', 'Alt/Option')
				.addOption('shift', 'Shift')
				.addOption('none', 'No Modifier (Always Active)')
				.setValue(this.plugin.settings.modifierKey)
				.onChange(async (value) => {
					this.plugin.settings.modifierKey = value as 'ctrl' | 'alt' | 'shift' | 'none';
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('p', {
			text: 'How to use: Hold the configured modifier key and click on any parent node in Canvas view. All child nodes and connecting edges will be selected automatically.',
			cls: 'setting-item-description'
		});
	}
}
