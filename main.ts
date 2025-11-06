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
			try {
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

	onunload() {
		console.log('Unloading Canvas Auto Child Selector plugin');
	}
}
