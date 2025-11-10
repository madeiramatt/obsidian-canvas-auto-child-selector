import { Plugin, PluginSettingTab, Setting, App } from 'obsidian';

interface Canvas {
	nodes: Map<string, any>;
	edges: Map<string, any>;
	selection: Set<any>;
	selectOnly: (items: any[]) => void;
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
		console.log('Canvas Auto Child Selector: Plugin loaded');

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

		// Listen for click events (after the canvas processes it)
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('Canvas Auto Child Selector: Click detected', {
				altKey: evt.altKey,
				button: evt.button,
				target: (evt.target as HTMLElement)?.className
			});

			// Only trigger if Alt-click shortcut is enabled
			if (!this.settings.useAltClickShortcut) {
				return;
			}

			// Only trigger on Alt + Left Click
			if (!evt.altKey || evt.button !== 0) {
				return;
			}

			console.log('Canvas Auto Child Selector: Alt+click confirmed');

			// Get the active canvas view
			const canvasView = this.getCanvasView();
			console.log('Canvas Auto Child Selector: Canvas view found:', !!canvasView);

			if (!canvasView) {
				return;
			}

			// Small delay to let canvas process the click and select the node
			setTimeout(() => {
				console.log('Canvas Auto Child Selector: Checking selection after delay');
				this.handleAltClick(canvasView);
			}, 50);
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

		console.log('Canvas Auto Child Selector: Starting selectChildren, recursive:', recursive);
		console.log('Canvas Auto Child Selector: Total nodes in canvas:', canvas.nodes.size);
		console.log('Canvas Auto Child Selector: Total edges in canvas:', canvas.edges.size);

		// Get all selected nodes (not edges)
		const selectedNodes: any[] = [];
		for (const item of selection) {
			if (item.id && canvas.nodes.has(item.id)) {
				selectedNodes.push(item);
			}
		}

		console.log('Canvas Auto Child Selector: Selected nodes count:', selectedNodes.length);
		if (selectedNodes.length > 0) {
			console.log('Canvas Auto Child Selector: Selected node IDs:', selectedNodes.map(n => n.id));
		}

		if (selectedNodes.length === 0) {
			console.log('Canvas Auto Child Selector: No nodes selected');
			return;
		}

		// Collect all children
		const nodesToSelect = new Set<any>();
		const edgesToSelect = new Set<any>();

		// Add original nodes if keeping selection
		if (this.settings.keepOriginalSelection) {
			selectedNodes.forEach(node => nodesToSelect.add(node));
			console.log('Canvas Auto Child Selector: Added original nodes to selection');
		}

		// Find children for each selected node
		for (const node of selectedNodes) {
			console.log('Canvas Auto Child Selector: Finding children for node:', node.id);
			if (recursive) {
				this.findAllChildren(node.id, canvas, nodesToSelect, edgesToSelect, 0);
			} else {
				this.findDirectChildren(node.id, canvas, nodesToSelect, edgesToSelect);
			}
		}

		console.log('Canvas Auto Child Selector: After finding children - nodes:', nodesToSelect.size, 'edges:', edgesToSelect.size);

		// Don't select if we have no nodes to select
		if (nodesToSelect.size === 0) {
			console.log('Canvas Auto Child Selector: No children found');
			return;
		}

		// Convert sets to arrays and filter out any invalid items
		const nodesArray = Array.from(nodesToSelect).filter(n => n && typeof n === 'object');
		const edgesArray = Array.from(edgesToSelect).filter(e => e && typeof e === 'object');

		// Build selection array - ONLY include edges if we have nodes
		const itemsToSelect = this.settings.selectEdges
			? [...nodesArray, ...edgesArray]
			: nodesArray;

		console.log(`Canvas Auto Child Selector: About to select ${nodesArray.length} nodes${this.settings.selectEdges ? ` and ${edgesArray.length} edges` : ''}`);

		if (itemsToSelect.length > 0) {
			canvas.selectOnly(itemsToSelect);
			console.log('Canvas Auto Child Selector: Selection successful');
		} else {
			console.log('Canvas Auto Child Selector: No valid items to select after filtering');
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
			console.log('Canvas Auto Child Selector: No nodes selected');
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
			console.log('Canvas Auto Child Selector: No parents found');
			return;
		}

		// Convert sets to arrays and filter out any invalid items
		const nodesArray = Array.from(nodesToSelect).filter(n => n && typeof n === 'object');
		const edgesArray = Array.from(edgesToSelect).filter(e => e && typeof e === 'object');

		// Build selection array - ONLY include edges if we have nodes
		const itemsToSelect = this.settings.selectEdges
			? [...nodesArray, ...edgesArray]
			: nodesArray;

		console.log(`Canvas Auto Child Selector: About to select ${nodesArray.length} nodes${this.settings.selectEdges ? ` and ${edgesArray.length} edges` : ''}`);

		if (itemsToSelect.length > 0) {
			canvas.selectOnly(itemsToSelect);
			console.log('Canvas Auto Child Selector: Selection successful');
		} else {
			console.log('Canvas Auto Child Selector: No valid items to select after filtering');
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
			console.log('Canvas Auto Child Selector: Max recursion depth reached');
			return;
		}

		// Find all edges going FROM this parent
		let edgesFound = 0;
		for (const edge of canvas.edges.values()) {
			if (edge.fromNode === parentId) {
				edgesFound++;
				console.log(`Canvas Auto Child Selector: Found child edge from ${parentId} to ${edge.toNode}`);

				// Add this edge object
				edgesToSelect.add(edge);

				// Get the child node object
				const childNode = canvas.nodes.get(edge.toNode);
				if (childNode && !nodesToSelect.has(childNode)) {
					// Add the child node object
					nodesToSelect.add(childNode);
					console.log(`Canvas Auto Child Selector: Added child node ${edge.toNode}`);

					// Recursively find this child's children
					this.findAllChildren(edge.toNode, canvas, nodesToSelect, edgesToSelect, depth + 1);
				} else if (!childNode) {
					console.log(`Canvas Auto Child Selector: WARNING - Edge points to non-existent node ${edge.toNode}`);
				}
			}
		}

		if (edgesFound === 0 && depth === 0) {
			console.log(`Canvas Auto Child Selector: No edges found from parent ${parentId}`);
		}
	}

	findDirectChildren(
		parentId: string,
		canvas: Canvas,
		nodesToSelect: Set<any>,
		edgesToSelect: Set<any>
	) {
		// Find all edges going FROM this parent (only direct children)
		for (const edge of canvas.edges.values()) {
			if (edge.fromNode === parentId) {
				// Add this edge object
				edgesToSelect.add(edge);

				// Get and add the child node object
				const childNode = canvas.nodes.get(edge.toNode);
				if (childNode) {
					nodesToSelect.add(childNode);
				}
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
			if (edge.toNode === childId) {
				// Add this edge object
				edgesToSelect.add(edge);

				// Get and add the parent node object
				const parentNode = canvas.nodes.get(edge.fromNode);
				if (parentNode) {
					nodesToSelect.add(parentNode);
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
		console.log('Canvas Auto Child Selector: Plugin unloaded');
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
