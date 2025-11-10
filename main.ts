import { Plugin } from 'obsidian';

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
	getNode: (id: string) => any;
	getEdge: (id: string) => any;
	selection: Set<any>;
	selectOnly: (items: any[]) => void;
}

interface CanvasView {
	canvas: Canvas;
}

export default class CanvasAutoChildSelectorPlugin extends Plugin {
	async onload() {
		console.log('Canvas Auto Child Selector: Plugin loaded');

		// Listen for click events (after the canvas processes it)
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('Canvas Auto Child Selector: Click detected', {
				altKey: evt.altKey,
				button: evt.button,
				target: (evt.target as HTMLElement)?.className
			});

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

	handleAltClick(canvasView: CanvasView) {
		const canvas = canvasView.canvas;
		const selection = canvas.selection;

		// Get canvas data using getData() API
		const canvasData = canvas.getData();

		console.log('Canvas Auto Child Selector: Selection size:', selection.size);
		console.log('Canvas Auto Child Selector: Total nodes in canvas:', canvasData.nodes.length);
		console.log('Canvas Auto Child Selector: Total edges in canvas:', canvasData.edges.length);

		// Find the selected node
		let selectedNode: any = null;
		let selectedNodeId: string | null = null;

		const selectionArray = Array.from(selection);
		console.log('Canvas Auto Child Selector: Items in selection:', selectionArray.map((item: any) => ({
			id: item.id,
			type: item.constructor?.name
		})));

		for (const item of selection) {
			// Check if this is a node (not an edge) by checking if it exists in nodes data
			if (item.id) {
				const nodeExists = canvasData.nodes.some(node => node.id === item.id);
				if (nodeExists) {
					selectedNode = item;
					selectedNodeId = item.id;
					break;
				}
			}
		}

		if (!selectedNode || !selectedNodeId) {
			console.log('Canvas Auto Child Selector: No node selected');
			return;
		}

		console.log('Canvas Auto Child Selector: Selected node:', selectedNodeId);

		// Find all children recursively
		const nodeIdsToSelect = new Set<string>();
		const edgeIdsToSelect = new Set<string>();

		nodeIdsToSelect.add(selectedNodeId);
		this.findAllChildren(selectedNodeId, canvasData, nodeIdsToSelect, edgeIdsToSelect);

		console.log(`Canvas Auto Child Selector: Selecting ${nodeIdsToSelect.size} nodes and ${edgeIdsToSelect.size} edges`);

		// Convert IDs back to actual canvas objects for selection
		const nodesToSelect: any[] = [];
		const edgesToSelect: any[] = [];

		for (const nodeId of nodeIdsToSelect) {
			const node = canvas.getNode(nodeId);
			if (node) nodesToSelect.push(node);
		}

		for (const edgeId of edgeIdsToSelect) {
			const edge = canvas.getEdge(edgeId);
			if (edge) edgesToSelect.push(edge);
		}

		console.log(`Canvas Auto Child Selector: Found ${nodesToSelect.length} node objects and ${edgesToSelect.length} edge objects`);

		// Select the parent and all children
		const itemsToSelect = [...nodesToSelect, ...edgesToSelect];
		canvas.selectOnly(itemsToSelect);
	}

	findAllChildren(
		parentId: string,
		canvasData: CanvasData,
		nodeIdsToSelect: Set<string>,
		edgeIdsToSelect: Set<string>
	) {
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
				this.findAllChildren(edge.toNode, canvasData, nodeIdsToSelect, edgeIdsToSelect);
			}
		}
	}

	onunload() {
		console.log('Canvas Auto Child Selector: Plugin unloaded');
	}
}
