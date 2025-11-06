import { Plugin, WorkspaceLeaf } from 'obsidian';

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

export default class CanvasAutoChildSelectorPlugin extends Plugin {
	async onload() {
		console.log('Loading Canvas Auto Child Selector plugin');

		// Register the click event handler for canvas
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			// Check if Ctrl (Windows/Linux) or Cmd (Mac) is pressed
			const modifierPressed = evt.ctrlKey || evt.metaKey;

			if (!modifierPressed) {
				return;
			}

			// Get the active canvas view
			const canvasView = this.getActiveCanvasView();
			if (!canvasView) {
				return;
			}

			// Find the clicked node
			const clickedNode = this.getClickedNode(evt, canvasView);
			if (!clickedNode) {
				return;
			}

			// Prevent default selection behavior
			evt.preventDefault();
			evt.stopPropagation();

			// Select the parent and all its descendants
			this.selectNodeWithDescendants(clickedNode, canvasView.canvas);
		}, true); // Use capture phase to intercept before canvas's handler
	}

	getActiveCanvasView(): CanvasView | null {
		const activeLeaf = this.app.workspace.getActiveViewOfType(
			this.app.workspace.getLeavesOfType('canvas')[0]?.view?.constructor as any
		);

		if (!activeLeaf) {
			// Try alternative method to get canvas view
			const canvasLeaves = this.app.workspace.getLeavesOfType('canvas');
			if (canvasLeaves.length > 0) {
				const view = canvasLeaves[0].view as any;
				if (view && view.canvas) {
					return view as CanvasView;
				}
			}
			return null;
		}

		return activeLeaf as any as CanvasView;
	}

	getClickedNode(evt: MouseEvent, canvasView: CanvasView): CanvasNode | null {
		const target = evt.target as HTMLElement;

		// Find the canvas node element
		const nodeElement = target.closest('.canvas-node');
		if (!nodeElement) {
			return null;
		}

		// Get the node ID from the element
		const nodeId = (nodeElement as any).dataset?.nodeId ||
		               (nodeElement as HTMLElement).getAttribute('data-node-id');

		if (!nodeId) {
			// Try to find node by matching position or other attributes
			const canvas = canvasView.canvas;
			for (const [id, node] of canvas.nodes) {
				const el = nodeElement as any;
				if (el.node === node || el.id === id) {
					return node;
				}
			}
			return null;
		}

		return canvasView.canvas.nodes.get(nodeId) || null;
	}

	selectNodeWithDescendants(parentNode: CanvasNode, canvas: Canvas) {
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
		canvas.selectOnly(itemsToSelect);
	}

	findDescendants(
		parentNode: CanvasNode,
		canvas: Canvas,
		nodesToSelect: Set<CanvasNode>,
		edgesToSelect: Set<CanvasEdge>
	) {
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
	}

	onunload() {
		console.log('Unloading Canvas Auto Child Selector plugin');
	}
}
