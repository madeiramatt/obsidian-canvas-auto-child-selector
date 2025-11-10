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
}

interface Canvas {
	nodes: Map<string, any>;
	edges: Map<string, any>;
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

		console.log('Canvas Auto Child Selector: Selection size:', selection.size);
		console.log('Canvas Auto Child Selector: Total nodes in canvas:', canvas.nodes.size);
		console.log('Canvas Auto Child Selector: Total edges in canvas:', canvas.edges.size);

		// Find the selected node
		let selectedNode: any = null;
		const selectionArray = Array.from(selection);
		console.log('Canvas Auto Child Selector: Items in selection:', selectionArray.map((item: any) => ({
			id: item.id,
			type: item.constructor?.name,
			isInNodes: canvas.nodes.has(item.id)
		})));

		for (const item of selection) {
			// Check if this is a node (not an edge)
			if (item.id && canvas.nodes.has(item.id)) {
				selectedNode = item;
				break;
			}
		}

		if (!selectedNode) {
			console.log('Canvas Auto Child Selector: No node selected');
			return;
		}

		console.log('Canvas Auto Child Selector: Selected node:', selectedNode.id);

		// Find all children recursively
		const nodesToSelect = new Set<any>();
		const edgesToSelect = new Set<any>();

		nodesToSelect.add(selectedNode);
		this.findAllChildren(selectedNode.id, canvas, nodesToSelect, edgesToSelect);

		console.log(`Canvas Auto Child Selector: Selecting ${nodesToSelect.size} nodes and ${edgesToSelect.size} edges`);

		// Select the parent and all children
		const itemsToSelect = [...nodesToSelect, ...edgesToSelect];
		canvas.selectOnly(itemsToSelect);
	}

	findAllChildren(
		parentId: string,
		canvas: Canvas,
		nodesToSelect: Set<any>,
		edgesToSelect: Set<any>
	) {
		// Find all edges going FROM this parent
		for (const edge of canvas.edges.values()) {
			if (edge.fromNode === parentId) {
				// Add this edge
				edgesToSelect.add(edge);

				// Get the child node
				const childNode = canvas.nodes.get(edge.toNode);
				if (childNode && !nodesToSelect.has(childNode)) {
					// Add the child node
					nodesToSelect.add(childNode);

					// Recursively find this child's children
					this.findAllChildren(edge.toNode, canvas, nodesToSelect, edgesToSelect);
				}
			}
		}
	}

	onunload() {
		console.log('Canvas Auto Child Selector: Plugin unloaded');
	}
}
