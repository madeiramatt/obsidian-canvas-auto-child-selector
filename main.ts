import { Plugin, PluginSettingTab, Setting, App } from 'obsidian';

interface Canvas {
	nodes: Map<string, any>;
	edges: Map<string, any>;
	selection: Set<any>;
	deselectAll: () => void;
	requestFrame: () => void;
}

interface CanvasView {
	canvas: Canvas;
}

interface CanvasAutoChildSelectorSettings {
	defaultRecursive: boolean;
	selectEdges: boolean;
	maxRecursionDepth: number;
	keepOriginalSelection: boolean;
	useAltClickShortcut: boolean;
}

const DEFAULT_SETTINGS: CanvasAutoChildSelectorSettings = {
	defaultRecursive: true,
	selectEdges: true,
	maxRecursionDepth: 100,
	keepOriginalSelection: true,
	useAltClickShortcut: true
}

export default class CanvasAutoChildSelectorPlugin extends Plugin {
	settings: CanvasAutoChildSelectorSettings;

	async onload() {
		await this.loadSettings();

		// Add settings tab
		this.addSettingTab(new CanvasAutoChildSelectorSettingTab(this.app, this));

		// Add commands
		this.addCommand({
			id: 'select-child-nodes-direct',
			name: 'Select child nodes (direct children only)',
			checkCallback: (checking: boolean) => {
				const canvasView = this.getCanvasView();
				if (canvasView) {
					if (!checking) {
						this.selectChildren(canvasView, false);
					}
					return true;
				}
				return false;
			}
		});

		this.addCommand({
			id: 'select-child-nodes-recursive',
			name: 'Select child nodes (all descendants)',
			checkCallback: (checking: boolean) => {
				const canvasView = this.getCanvasView();
				if (canvasView) {
					if (!checking) {
						this.selectChildren(canvasView, true);
					}
					return true;
				}
				return false;
			}
		});

		this.addCommand({
			id: 'select-parent-nodes',
			name: 'Select parent nodes',
			checkCallback: (checking: boolean) => {
				const canvasView = this.getCanvasView();
				if (canvasView) {
					if (!checking) {
						this.selectParents(canvasView);
					}
					return true;
				}
				return false;
			}
		});

		// Listen for mouseup events instead of click to run after canvas's click handler
		this.registerDomEvent(document, 'mouseup', (evt: MouseEvent) => {
			// Only trigger if Alt-click shortcut is enabled
			if (!this.settings.useAltClickShortcut) {
				return;
			}

			// Only trigger on Alt + Left Click
			if (!evt.altKey || evt.button !== 0) {
				return;
			}

			// Get the active canvas view
			const canvasView = this.getCanvasView();
			if (!canvasView) {
				return;
			}

			// Use requestAnimationFrame to run after the canvas's click handlers
			requestAnimationFrame(() => {
				setTimeout(() => {
					console.log(`[ACCS] Running selection after mouseup + RAF + timeout`);
					this.handleAltClick(canvasView);

					// Check if selection persists
					setTimeout(() => {
						console.log(`[ACCS] Selection size after 100ms: ${canvasView.canvas.selection.size}`);
					}, 100);
				}, 0);
			});
		});
	}

	getCanvasView(): CanvasView | null {
		const leaf = this.app.workspace.activeLeaf;
		if (!leaf) return null;

		const view = leaf.view as any;
		if (view?.getViewType?.() === 'canvas' && view.canvas) {
			return view as CanvasView;
		}
		return null;
	}

	selectChildren(canvasView: CanvasView, recursive: boolean) {
		const canvas = canvasView.canvas;
		const selection = canvas.selection;

		// Get all selected nodes (not edges)
		const selectedNodes: any[] = [];
		for (const item of selection) {
			if (item.id && canvas.nodes.has(item.id)) {
				selectedNodes.push(item);
			}
		}

		console.log(`[ACCS] Selected nodes: ${selectedNodes.length}, IDs: [${selectedNodes.map(n => n.id).join(', ')}]`);

		if (selectedNodes.length === 0) {
			return;
		}

		// Collect all children
		const nodesToSelect = new Set<any>();
		const edgesToSelect = new Set<any>();

		// Add original nodes if keeping selection
		if (this.settings.keepOriginalSelection) {
			selectedNodes.forEach(node => nodesToSelect.add(node));
		}

		// Find children for each selected node
		for (const node of selectedNodes) {
			if (recursive) {
				this.findAllChildren(node.id, canvas, nodesToSelect, edgesToSelect, 0);
			} else {
				this.findDirectChildren(node.id, canvas, nodesToSelect, edgesToSelect);
			}
		}

		console.log(`[ACCS] Found ${nodesToSelect.size} nodes (including parent if kept), ${edgesToSelect.size} edges`);

		// Don't select if we have no nodes to select
		if (nodesToSelect.size === 0) {
			return;
		}

		// Convert sets to arrays and filter out any invalid items
		const nodesArray = Array.from(nodesToSelect).filter(n => n && typeof n === 'object');
		const edgesArray = Array.from(edgesToSelect).filter(e => e && typeof e === 'object');

		// Build selection array - ONLY include edges if we have nodes
		const itemsToSelect = this.settings.selectEdges
			? [...nodesArray, ...edgesArray]
			: nodesArray;

		console.log(`[ACCS] Selecting ${nodesArray.length} nodes and ${edgesArray.length} edges`);

		if (itemsToSelect.length > 0) {
			// Use the selection API directly
			canvas.selection.clear();
			itemsToSelect.forEach(item => {
				canvas.selection.add(item);
			});

			// Try multiple methods to trigger visual update
			canvas.requestFrame(); // Trigger UI update

			// Also try calling markDirty on each node
			nodesArray.forEach((node: any) => {
				if (node.canvas && node.canvas === canvas) {
					if (typeof node.render === 'function') {
						node.render();
					}
				}
			});

			console.log(`[ACCS] Selection complete. Canvas selection size: ${canvas.selection.size}`);
			console.log(`[ACCS] Selection contents:`, Array.from(canvas.selection).map((item: any) => ({ id: item.id, type: item.constructor?.name })));
		}
	}

	selectParents(canvasView: CanvasView) {
		const canvas = canvasView.canvas;
		const selection = canvas.selection;

		// Get all selected nodes (not edges)
		const selectedNodes: any[] = [];
		for (const item of selection) {
			if (item.id && canvas.nodes.has(item.id)) {
				selectedNodes.push(item);
			}
		}

		if (selectedNodes.length === 0) {
			return;
		}

		// Collect all parents
		const nodesToSelect = new Set<any>();
		const edgesToSelect = new Set<any>();

		// Add original nodes if keeping selection
		if (this.settings.keepOriginalSelection) {
			selectedNodes.forEach(node => nodesToSelect.add(node));
		}

		// Find parents for each selected node
		for (const node of selectedNodes) {
			this.findParentNodes(node.id, canvas, nodesToSelect, edgesToSelect);
		}

		// Don't select if we have no nodes to select
		if (nodesToSelect.size === 0) {
			return;
		}

		// Convert sets to arrays and filter out any invalid items
		const nodesArray = Array.from(nodesToSelect).filter(n => n && typeof n === 'object');
		const edgesArray = Array.from(edgesToSelect).filter(e => e && typeof e === 'object');

		// Build selection array - ONLY include edges if we have nodes
		const itemsToSelect = this.settings.selectEdges
			? [...nodesArray, ...edgesArray]
			: nodesArray;

		if (itemsToSelect.length > 0) {
			// Use the selection API directly
			canvas.selection.clear();
			itemsToSelect.forEach(item => {
				canvas.selection.add(item);
			});
			canvas.requestFrame(); // Trigger UI update
		}
	}

	handleAltClick(canvasView: CanvasView) {
		// Use the default recursive setting
		this.selectChildren(canvasView, this.settings.defaultRecursive);
	}

	findAllChildren(
		parentId: string,
		canvas: Canvas,
		nodesToSelect: Set<any>,
		edgesToSelect: Set<any>,
		depth: number
	) {
		// Stop if we've reached max recursion depth
		if (depth >= this.settings.maxRecursionDepth) {
			return;
		}

		// Find all edges going FROM this parent
		for (const edge of canvas.edges.values()) {
			const fromNode = edge.from?.node;
			const toNode = edge.to?.node;

			// edge.from.node and edge.to.node are node objects, not IDs
			if (fromNode?.id === parentId && toNode && !nodesToSelect.has(toNode)) {
				// Add this edge object
				edgesToSelect.add(edge);
				// Add the child node object directly (it's already the node object)
				nodesToSelect.add(toNode);
				// Recursively find this child's children
				this.findAllChildren(toNode.id, canvas, nodesToSelect, edgesToSelect, depth + 1);
			}
		}
	}

	findDirectChildren(
		parentId: string,
		canvas: Canvas,
		nodesToSelect: Set<any>,
		edgesToSelect: Set<any>
	) {
		// Find all edges where the from node matches the parent
		for (const edge of canvas.edges.values()) {
			const fromNode = edge.from?.node;
			const toNode = edge.to?.node;

			// edge.from.node and edge.to.node are node objects, not IDs
			if (fromNode?.id === parentId && toNode) {
				// Add this edge object
				edgesToSelect.add(edge);
				// Add the child node object directly (it's already the node object)
				nodesToSelect.add(toNode);
			}
		}
	}

	findParentNodes(
		childId: string,
		canvas: Canvas,
		nodesToSelect: Set<any>,
		edgesToSelect: Set<any>
	) {
		// Find all edges going TO this child (parents)
		for (const edge of canvas.edges.values()) {
			const fromNode = edge.from?.node;
			const toNode = edge.to?.node;

			// edge.from.node and edge.to.node are node objects, not IDs
			if (toNode?.id === childId) {
				// Add this edge object
				edgesToSelect.add(edge);

				// Add the parent node object directly (it's already the node object)
				if (fromNode) {
					nodesToSelect.add(fromNode);
				}
			}
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	onunload() {
	}
}

class CanvasAutoChildSelectorSettingTab extends PluginSettingTab {
	plugin: CanvasAutoChildSelectorPlugin;

	constructor(app: App, plugin: CanvasAutoChildSelectorPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'Canvas Auto Child Selector Settings' });

		new Setting(containerEl)
			.setName('Enable Alt-click shortcut')
			.setDesc('Hold Alt and click a node to select it with all its children')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.useAltClickShortcut)
				.onChange(async (value) => {
					this.plugin.settings.useAltClickShortcut = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Default to recursive selection')
			.setDesc('When using commands, select all descendants (not just direct children)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.defaultRecursive)
				.onChange(async (value) => {
					this.plugin.settings.defaultRecursive = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Select connecting edges')
			.setDesc('Include edges/arrows in the selection along with nodes')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.selectEdges)
				.onChange(async (value) => {
					this.plugin.settings.selectEdges = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Keep original selection')
			.setDesc('Keep the parent node(s) selected when selecting children')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.keepOriginalSelection)
				.onChange(async (value) => {
					this.plugin.settings.keepOriginalSelection = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Maximum recursion depth')
			.setDesc('Maximum depth to traverse when selecting descendants (prevents infinite loops)')
			.addText(text => text
				.setPlaceholder('100')
				.setValue(this.plugin.settings.maxRecursionDepth.toString())
				.onChange(async (value) => {
					const depth = parseInt(value);
					if (!isNaN(depth) && depth > 0 && depth <= 1000) {
						this.plugin.settings.maxRecursionDepth = depth;
						await this.plugin.saveSettings();
					}
				}));
	}
}
