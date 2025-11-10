import { Plugin, PluginSettingTab, Setting, App } from 'obsidian';

interface CanvasNode {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
}

interface CanvasEdge {
	id: string;
	fromNode: string;
	toNode: string;
	fromSide?: string;
	toSide?: string;
}

interface CanvasData {
	nodes: CanvasNode[];
	edges: CanvasEdge[];
}

interface Canvas {
	getData: () => CanvasData;
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
		const canvasData = canvas.getData();

		// Get all selected node IDs
		const selectedNodeIds: string[] = [];
		for (const item of selection) {
			if (item.id && canvasData.nodes.some(node => node.id === item.id)) {
				selectedNodeIds.push(item.id);
			}
		}

		if (selectedNodeIds.length === 0) {
			console.log('Canvas Auto Child Selector: No nodes selected');
			return;
		}

		// Collect all children
		const nodeIdsToSelect = new Set<string>();
		const edgeIdsToSelect = new Set<string>();

		// Add original nodes if keeping selection
		if (this.settings.keepOriginalSelection) {
			selectedNodeIds.forEach(id => nodeIdsToSelect.add(id));
		}

		// Find children for each selected node
		for (const nodeId of selectedNodeIds) {
			if (recursive) {
				this.findAllChildren(nodeId, canvasData, nodeIdsToSelect, edgeIdsToSelect, 0);
			} else {
				this.findDirectChildren(nodeId, canvasData, nodeIdsToSelect, edgeIdsToSelect);
			}
		}

		// Convert to canvas objects and select
		this.selectNodesByIds(canvas, nodeIdsToSelect, edgeIdsToSelect);
	}

	selectParents(canvasView: CanvasView) {
		const canvas = canvasView.canvas;
		const selection = canvas.selection;
		const canvasData = canvas.getData();

		// Get all selected node IDs
		const selectedNodeIds: string[] = [];
		for (const item of selection) {
			if (item.id && canvasData.nodes.some(node => node.id === item.id)) {
				selectedNodeIds.push(item.id);
			}
		}

		if (selectedNodeIds.length === 0) {
			console.log('Canvas Auto Child Selector: No nodes selected');
			return;
		}

		// Collect all parents
		const nodeIdsToSelect = new Set<string>();
		const edgeIdsToSelect = new Set<string>();

		// Add original nodes if keeping selection
		if (this.settings.keepOriginalSelection) {
			selectedNodeIds.forEach(id => nodeIdsToSelect.add(id));
		}

		// Find parents for each selected node
		for (const nodeId of selectedNodeIds) {
			this.findParentNodes(nodeId, canvasData, nodeIdsToSelect, edgeIdsToSelect);
		}

		// Convert to canvas objects and select
		this.selectNodesByIds(canvas, nodeIdsToSelect, edgeIdsToSelect);
	}

	selectNodesByIds(canvas: Canvas, nodeIds: Set<string>, edgeIds: Set<string>) {
		const nodesToSelect: any[] = [];

		for (const nodeId of nodeIds) {
			const node = canvas.nodes.get(nodeId);
			if (node) nodesToSelect.push(node);
		}

		if (this.settings.selectEdges) {
			for (const edgeId of edgeIds) {
				const edge = canvas.edges.get(edgeId);
				if (edge) edgesToSelect.push(edge);
			}
		}

		const itemsToSelect = this.settings.selectEdges
			? [...nodesToSelect, ...edgesToSelect]
			: nodesToSelect;

		canvas.selectOnly(itemsToSelect);
		console.log(`Canvas Auto Child Selector: Selected ${nodesToSelect.length} nodes${this.settings.selectEdges ? ` and ${edgesToSelect.length} edges` : ''}`);
	}

	handleAltClick(canvasView: CanvasView) {
		// Use the default recursive setting
		this.selectChildren(canvasView, this.settings.defaultRecursive);
	}

	findAllChildren(
		parentId: string,
		canvasData: CanvasData,
		nodeIdsToSelect: Set<string>,
		edgeIdsToSelect: Set<string>,
		depth: number
	) {
		// Stop if we've reached max recursion depth
		if (depth >= this.settings.maxRecursionDepth) {
			console.log('Canvas Auto Child Selector: Max recursion depth reached');
			return;
		}

		// Find all edges going FROM this parent
		const childEdges = canvasData.edges.filter(edge => edge.fromNode === parentId);

		for (const edge of childEdges) {
			// Add this edge ID
			edgeIdsToSelect.add(edge.id);

			// Check if we've already processed this child node
			if (!nodeIdsToSelect.has(edge.toNode)) {
				// Add the child node ID
				nodeIdsToSelect.add(edge.toNode);

				// Recursively find this child's children
				this.findAllChildren(edge.toNode, canvasData, nodeIdsToSelect, edgeIdsToSelect, depth + 1);
			}
		}
	}

	findDirectChildren(
		parentId: string,
		canvasData: CanvasData,
		nodeIdsToSelect: Set<string>,
		edgeIdsToSelect: Set<string>
	) {
		// Find all edges going FROM this parent (only direct children)
		const childEdges = canvasData.edges.filter(edge => edge.fromNode === parentId);

		for (const edge of childEdges) {
			// Add this edge ID
			edgeIdsToSelect.add(edge.id);
			// Add the child node ID
			nodeIdsToSelect.add(edge.toNode);
		}
	}

	findParentNodes(
		childId: string,
		canvasData: CanvasData,
		nodeIdsToSelect: Set<string>,
		edgeIdsToSelect: Set<string>
	) {
		// Find all edges going TO this child (parents)
		const parentEdges = canvasData.edges.filter(edge => edge.toNode === childId);

		for (const edge of parentEdges) {
			// Add this edge ID
			edgeIdsToSelect.add(edge.id);
			// Add the parent node ID
			nodeIdsToSelect.add(edge.fromNode);
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
