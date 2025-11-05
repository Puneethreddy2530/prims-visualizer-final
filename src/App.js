import React, { useState, useRef, useEffect } from 'react';
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export default function PrimsVisualizer() {
  // top-right modals
  const [zoomImage, setZoomImage] = useState(null); // for click-to-zoom modal
  const [showRefsModal, setShowRefsModal] = useState(false);
  const [showHowModal, setShowHowModal] = useState(false);
  const [showLearnModal, setShowLearnModal] = useState(false);
  const [showDevelopedByModal, setShowDevelopedByModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [dragStart, setDragStart] = useState(null);
  const [dragEnd, setDragEnd] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [mstEdges, setMstEdges] = useState([]);
  const [visitedNodes, setVisitedNodes] = useState(new Set());
  const [currentEdge, setCurrentEdge] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [stepInfo, setStepInfo] = useState('');
  const [isDirected, setIsDirected] = useState(false);
  const [editingNode, setEditingNode] = useState(null);
  const [editingEdge, setEditingEdge] = useState(null);
  const [nodeNameInput, setNodeNameInput] = useState('');
  const [edgeWeightInput, setEdgeWeightInput] = useState('');
  const [tableData, setTableData] = useState([]);
  const [changedNodes, setChangedNodes] = useState(new Set());
  const [algorithmStates, setAlgorithmStates] = useState([]);
  const [currentStateIndex, setCurrentStateIndex] = useState(-1);
  const [executionCompleted, setExecutionCompleted] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(10);
  const [isSpeedingUp, setIsSpeedingUp] = useState(false);
  const [isHoldingNext, setIsHoldingNext] = useState(false);
  const [isHoldingPrev, setIsHoldingPrev] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const canvasRef = useRef(null);
  const shouldPauseRef = useRef(false);
  const algorithmRunningRef = useRef(false);
  const speedMultiplierRef = useRef(1);
  const holdIntervalRef = useRef(null);
  const holdTimeoutRef = useRef(null);

  const NODE_RADIUS = 20;
  const SCALE_FACTOR = 0.05; // Convert pixels to smaller units

  // check if on mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 900);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
  const onEsc = (e) => {
    if (e.key === 'Escape') setZoomImage(null);
  };
  window.addEventListener('keydown', onEsc);
  return () => window.removeEventListener('keydown', onEsc);
}, []);


  const distance = (p1, p2) => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy) * SCALE_FACTOR;
  };

  const findNodeAt = (x, y) => {
    return nodes.find(node => {
      const dx = node.x - x;
      const dy = node.y - y;
      return Math.sqrt(dx * dx + dy * dy) <= NODE_RADIUS;
    });
  };

  const findEdgeAt = (x, y) => {
  const HIT_R = 18;

  for (const edge of edges) {
    const fromNode = nodes.find(n => n.id === edge.from);
    const toNode   = nodes.find(n => n.id === edge.to);
    if (!fromNode || !toNode) continue;

    const midX = (fromNode.x + toNode.x) / 2;
    const midY = (fromNode.y + toNode.y) / 2;

    const hasReverse = isDirected && edges.some(e => e.from === edge.to && e.to === edge.from);

    if (hasReverse) {
      // Two distinct labels: one for A→B (top), one for B→A (bottom)
      const dx = toNode.x - fromNode.x;
      const dy = toNode.y - fromNode.y;
      const len = Math.hypot(dx, dy) || 1;

      const offset = 15;
      const perpX = (-dy / len) * offset;
      const perpY = ( dx / len) * offset;

      // Stable split: for one direction use +, for the reverse use -
      const sign = edge.from < edge.to ? 1 : -1;

      const labelX = midX + perpX * 0.6 * sign;
      const labelY = midY + perpY * 0.6 * sign;

      if (Math.hypot(x - labelX, y - labelY) <= HIT_R) {
        return edge; // ✅ Clicked correct top/bottom direction
      }
    } else {
      // Single label in the middle for undirected or single directed edge
      if (Math.hypot(x - midX, y - midY) <= HIT_R) return edge;
    }
  }

  return null;
};

  const handleCanvasClick = (e) => {
    if (isRunning) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clickedNode = findNodeAt(x, y);
    const clickedEdge = findEdgeAt(x, y);

    if (!clickedNode && !clickedEdge) {
      const newNode = { 
        id: nodes.length, 
        x, 
        y, 
        name: nodes.length.toString() 
      };
      setNodes([...nodes, newNode]);
    }
  };

  const handleCanvasDoubleClick = (e) => {
    if (isRunning) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clickedNode = findNodeAt(x, y);
    const clickedEdge = findEdgeAt(x, y);

    if (clickedNode) {
      setEditingNode(clickedNode);
      setNodeNameInput(clickedNode.name || clickedNode.id.toString());
    } else if (clickedEdge) {
      setEditingEdge(clickedEdge);
      setEdgeWeightInput(clickedEdge.weight.toString());
    }
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    if (isRunning) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clickedNode = findNodeAt(x, y);
    const clickedEdge = findEdgeAt(x, y);

    if (clickedNode) {
      const deletedId = clickedNode.id;
      
      // Remove the node and its edges
      const remainingNodes = nodes.filter(node => node.id !== deletedId);
      const remainingEdges = edges.filter(edge => 
        edge.from !== deletedId && edge.to !== deletedId
      );
      
      // Reassign IDs to maintain sequential order
      const updatedNodes = remainingNodes.map((node, index) => ({
        ...node,
        id: index
      }));
      
      // Update edge references to new IDs
      const idMap = {};
      remainingNodes.forEach((node, index) => {
        idMap[node.id] = index;
      });
      
      const updatedEdges = remainingEdges.map(edge => ({
        ...edge,
        from: idMap[edge.from],
        to: idMap[edge.to]
      }));
      
      setNodes(updatedNodes);
      setEdges(updatedEdges);
    } else if (clickedEdge) {
      setEdges(edges.filter(edge => 
        !(edge.from === clickedEdge.from && edge.to === clickedEdge.to)
      ));
    }
  };

  const handleMouseDown = (e) => {
    if (isRunning || editingNode || editingEdge) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const node = findNodeAt(x, y);
    if (node) {
      setDragStart(node);
      setIsDragging(false);
      e.preventDefault();
    }
  };

  const handleMouseMove = (e) => {
    if (!dragStart || isRunning) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const dx = x - dragStart.x;
    const dy = y - dragStart.y;
    if (Math.sqrt(dx * dx + dy * dy) > 5) {
      setIsDragging(true);
      setDragEnd({ x, y });
    }
  };

  const handleMouseUp = (e) => {
    if (!dragStart || isRunning) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDragging) {
      const endNode = findNodeAt(x, y);
      
      if (endNode && endNode.id !== dragStart.id) {
        const edgeExists = edges.some(
  edge => edge.from === dragStart.id && edge.to === endNode.id
);



        if (!edgeExists) {
          const weight = Math.round(distance(dragStart, endNode) * 10) / 10; // One decimal place
          setEdges([...edges, { from: dragStart.id, to: endNode.id, weight }]);
        }
      } else if (!endNode) {
        const newNode = {
          id: nodes.length,
          x,
          y,
          name: nodes.length.toString()
        };
        const weight = Math.round(distance(dragStart, { x, y }) * 10) / 10; // One decimal place
        
        setNodes([...nodes, newNode]);
        setEdges([...edges, { from: dragStart.id, to: newNode.id, weight }]);
      }
    }

    setDragStart(null);
    setDragEnd(null);
    setIsDragging(false);
  };

  const saveNodeName = () => {
    if (editingNode) {
      setNodes(nodes.map(node => 
        node.id === editingNode.id 
          ? { ...node, name: nodeNameInput || node.id.toString() }
          : node
      ));
      setEditingNode(null);
      setNodeNameInput('');
      resetExecutionState();
    }
  };

  const saveEdgeWeight = () => {
    if (editingEdge) {
      const newWeight = parseFloat(edgeWeightInput);
      if (!isNaN(newWeight)) {
        setEdges(edges.map(edge =>
          edge.from === editingEdge.from && edge.to === editingEdge.to
            ? { ...edge, weight: newWeight }
            : edge
        ));
      }
      setEditingEdge(null);
      setEdgeWeightInput('');
      resetExecutionState();
    }
  };

  const resetExecutionState = () => {
    setMstEdges([]);
    setVisitedNodes(new Set());
    setCurrentEdge(null);
    setStepInfo('');
    setTableData([]);
    setChangedNodes(new Set());
    setAlgorithmStates([]);
    setCurrentStateIndex(-1);
    setExecutionCompleted(false);
  };

  const waitForResume = async () => {
    while (shouldPauseRef.current) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };

  const runPrimsAlgorithm = async () => {
    if (nodes.length === 0) return;

    setIsRunning(true);
    setIsPaused(false);
    setExecutionCompleted(false);
    shouldPauseRef.current = false;
    algorithmRunningRef.current = true;
    speedMultiplierRef.current = 1;
    setMstEdges([]);
    setVisitedNodes(new Set());
    setCurrentEdge(null);
    setChangedNodes(new Set());
    setStepInfo('Starting Prim\'s Algorithm...');
    
    const states = [];

    const initialTable = nodes.map(node => ({
      nodeId: node.id,
      nodeName: node.name,
      visited: false,
      distance: node.id === 0 ? 0 : Infinity,
      previous: null
    }));
    setTableData(initialTable);

    states.push({
      visited: new Set([]),
      mstEdges: [],
      currentEdge: null,
      tableData: initialTable,
      changedNodes: new Set(),
      stepInfo: 'Starting Prim\'s Algorithm...'
    });

    setAlgorithmStates([...states]);
    setCurrentStateIndex(0);

    await new Promise(resolve => setTimeout(resolve, 1000 / speedMultiplierRef.current));
    await waitForResume();

    const visited = new Set([0]);
    const distances = {};
    const previous = {};
    
    nodes.forEach(node => {
      distances[node.id] = node.id === 0 ? 0 : Infinity;
      previous[node.id] = null;
    });

    const mst = [];
    const totalNodes = nodes.length;

    const updatedTable = initialTable.map(row => 
      row.nodeId === 0 ? { ...row, visited: true } : row
    );
    
    states.push({
      visited: new Set([0]),
      mstEdges: [],
      currentEdge: null,
      tableData: updatedTable,
      changedNodes: new Set([0]),
      stepInfo: `Step 1: Starting from node ${nodes[0].name}`
    });

    setVisitedNodes(new Set([0]));
    setChangedNodes(new Set([0]));
    setTableData(updatedTable);
    setStepInfo(`Step 1: Starting from node ${nodes[0].name}`);
    setAlgorithmStates([...states]);
    setCurrentStateIndex(1);
    
    await new Promise(resolve => setTimeout(resolve, 1000 / speedMultiplierRef.current));
    await waitForResume();

    let step = 2;
    while (visited.size < totalNodes && algorithmRunningRef.current) {
      const changed = new Set();
      
      for (const edge of edges) {
        const { from, to, weight } = edge;
        
        if (visited.has(from) && !visited.has(to)) {
          if (weight < distances[to]) {
            distances[to] = weight;
            previous[to] = from;
            changed.add(to);
          }
        } else if (!isDirected && visited.has(to) && !visited.has(from)) {
          if (weight < distances[from]) {
            distances[from] = weight;
            previous[from] = to;
            changed.add(from);
          }
        }
      }

      let minEdge = null;
      let minWeight = Infinity;
      let minNode = null;

      for (const edge of edges) {
        const { from, to, weight } = edge;
        
        if (visited.has(from) && !visited.has(to) && weight === distances[to]) {
          if (weight < minWeight) {
            minWeight = weight;
            minEdge = { ...edge, direction: 'forward' };
            minNode = to;
          }
        } else if (!isDirected && visited.has(to) && !visited.has(from) && weight === distances[from]) {
          if (weight < minWeight) {
            minWeight = weight;
            minEdge = { ...edge, direction: 'backward' };
            minNode = from;
          }
        }
      }

      if (!minEdge) break;

      const updatedTable1 = nodes.map(node => ({
        nodeId: node.id,
        nodeName: node.name,
        visited: visited.has(node.id),
        distance: distances[node.id] === Infinity ? '∞' : distances[node.id],
        previous: previous[node.id] !== null ? nodes[previous[node.id]].name : '-'
      }));
      
      const fromName = nodes[minEdge.from].name;
      const toName = nodes[minEdge.to].name;
      
      states.push({
        visited: new Set(visited),
        mstEdges: [...mst],
        currentEdge: minEdge,
        tableData: updatedTable1,
        changedNodes: changed,
        stepInfo: `Step ${step}: Considering edge (${fromName}, ${toName}) with weight ${minEdge.weight}`
      });

      setCurrentEdge(minEdge);
      setChangedNodes(changed);
      setTableData(updatedTable1);
      setStepInfo(`Step ${step}: Considering edge (${fromName}, ${toName}) with weight ${minEdge.weight}`);
      setAlgorithmStates([...states]);
      setCurrentStateIndex(states.length - 1);
      
      await new Promise(resolve => setTimeout(resolve, 1000 / speedMultiplierRef.current));
      await waitForResume();

      visited.add(minNode);
      mst.push(minEdge);

      const updatedTable2 = nodes.map(node => ({
        nodeId: node.id,
        nodeName: node.name,
        visited: visited.has(node.id),
        distance: distances[node.id] === Infinity ? '∞' : distances[node.id],
        previous: previous[node.id] !== null ? nodes[previous[node.id]].name : '-'
      }));
      
      states.push({
        visited: new Set(visited),
        mstEdges: [...mst],
        currentEdge: null,
        tableData: updatedTable2,
        changedNodes: new Set([minNode]),
        stepInfo: `Step ${step + 1}: Added edge (${fromName}, ${toName}) to MST. Node ${nodes[minNode].name} is now visited.`
      });

      setVisitedNodes(new Set(visited));
      setMstEdges([...mst]);
      setCurrentEdge(null);
      setChangedNodes(new Set([minNode]));
      setTableData(updatedTable2);
      setStepInfo(`Step ${step + 1}: Added edge (${fromName}, ${toName}) to MST. Node ${nodes[minNode].name} is now visited.`);
      setAlgorithmStates([...states]);
      setCurrentStateIndex(states.length - 1);
      
      await new Promise(resolve => setTimeout(resolve, 1000 / speedMultiplierRef.current));
      await waitForResume();

      step += 2;
    }

    if (algorithmRunningRef.current) {
      setChangedNodes(new Set());
      const totalWeight = mst.reduce((sum, e) => sum + e.weight, 0).toFixed(2);
      const finalInfo = `Algorithm complete! MST has ${mst.length} edges with total weight: ${totalWeight}`;
      setStepInfo(finalInfo);
      
      states.push({
        visited: new Set(visited),
        mstEdges: [...mst],
        currentEdge: null,
        tableData: nodes.map(node => ({
          nodeId: node.id,
          nodeName: node.name,
          visited: visited.has(node.id),
          distance: distances[node.id] === Infinity ? '∞' : distances[node.id],
          previous: previous[node.id] !== null ? nodes[previous[node.id]].name : '-'
        })),
        changedNodes: new Set(),
        stepInfo: finalInfo
      });

      setAlgorithmStates([...states]);
      setCurrentStateIndex(states.length - 1);
      setExecutionCompleted(true);
    }
    
    setIsRunning(false);
    setIsPaused(false);
    setIsSpeedingUp(false);
    algorithmRunningRef.current = false;
  };

  const togglePause = () => {
    const newPauseState = !isPaused;
    setIsPaused(newPauseState);
    shouldPauseRef.current = newPauseState;
  };

  const goToNextState = () => {
    if (currentStateIndex < algorithmStates.length - 1) {
      const nextIndex = currentStateIndex + 1;
      const state = algorithmStates[nextIndex];
      setCurrentStateIndex(nextIndex);
      setVisitedNodes(new Set(state.visited));
      setMstEdges([...state.mstEdges]);
      setCurrentEdge(state.currentEdge);
      setTableData([...state.tableData]);
      setChangedNodes(new Set(state.changedNodes));
      setStepInfo(state.stepInfo);
    }
  };

  const goToPrevState = () => {
    if (currentStateIndex > 0) {
      const prevIndex = currentStateIndex - 1;
      const state = algorithmStates[prevIndex];
      setCurrentStateIndex(prevIndex);
      setVisitedNodes(new Set(state.visited));
      setMstEdges([...state.mstEdges]);
      setCurrentEdge(state.currentEdge);
      setTableData([...state.tableData]);
      setChangedNodes(new Set(state.changedNodes));
      setStepInfo(state.stepInfo);
    }
  };

  const handleNextMouseDown = () => {
    if (currentStateIndex >= algorithmStates.length - 1) return;
    goToNextState();
    
    holdTimeoutRef.current = setTimeout(() => {
      setIsHoldingNext(true);
      const delay = 1000 / speedMultiplier;
      holdIntervalRef.current = setInterval(() => {
        setCurrentStateIndex(prevIndex => {
          if (prevIndex >= algorithmStates.length - 1) {
            if (holdIntervalRef.current) {
              clearInterval(holdIntervalRef.current);
              holdIntervalRef.current = null;
            }
            setIsHoldingNext(false);
            return prevIndex;
          }
          const nextIndex = prevIndex + 1;
          const state = algorithmStates[nextIndex];
          setVisitedNodes(new Set(state.visited));
          setMstEdges([...state.mstEdges]);
          setCurrentEdge(state.currentEdge);
          setTableData([...state.tableData]);
          setChangedNodes(new Set(state.changedNodes));
          setStepInfo(state.stepInfo);
          return nextIndex;
        });
      }, delay);
    }, 250);
  };

  const handleNextMouseUp = () => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    setIsHoldingNext(false);
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  };

  const handlePrevMouseDown = () => {
    if (currentStateIndex <= 0) return;
    goToPrevState();
    
    holdTimeoutRef.current = setTimeout(() => {
      setIsHoldingPrev(true);
      const delay = 1000 / speedMultiplier;
      holdIntervalRef.current = setInterval(() => {
        setCurrentStateIndex(prevIndex => {
          if (prevIndex <= 0) {
            if (holdIntervalRef.current) {
              clearInterval(holdIntervalRef.current);
              holdIntervalRef.current = null;
            }
            setIsHoldingPrev(false);
            return prevIndex;
          }
          const newIndex = prevIndex - 1;
          const state = algorithmStates[newIndex];
          setVisitedNodes(new Set(state.visited));
          setMstEdges([...state.mstEdges]);
          setCurrentEdge(state.currentEdge);
          setTableData([...state.tableData]);
          setChangedNodes(new Set(state.changedNodes));
          setStepInfo(state.stepInfo);
          return newIndex;
        });
      }, delay);
    }, 250);
  };

  const handlePrevMouseUp = () => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    setIsHoldingPrev(false);
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  };

  const handleDirectedChange = (e) => {
    setIsDirected(e.target.checked);
    resetExecutionState();
  };

  const reset = () => {
    algorithmRunningRef.current = false;
    shouldPauseRef.current = false;
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    setNodes([]);
    setEdges([]);
    setMstEdges([]);
    setVisitedNodes(new Set());
    setCurrentEdge(null);
    setStepInfo('');
    setIsRunning(false);
    setIsPaused(false);
    setEditingNode(null);
    setEditingEdge(null);
    setTableData([]);
    setChangedNodes(new Set());
    setAlgorithmStates([]);
    setCurrentStateIndex(-1);
    setExecutionCompleted(false);
    setIsHoldingNext(false);
    setIsHoldingPrev(false);
  };

  

  // 🔥 SPEED UP FEATURE (10x while held)
const handleSpeedUpMouseDown = () => {
  setIsSpeedingUp(true);
  speedMultiplierRef.current = 10; // 10x faster
};

const handleSpeedUpMouseUp = () => {
  setIsSpeedingUp(false);
  speedMultiplierRef.current = 1; // back to normal
};

  // 🔥 ADDED CODE START — DOWNLOAD HELPERS

// ✅ Helper: Format date for filename (YYYY-MM-DD_HH-MM-SS)
const getTimestamp = () => {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, "-");
};

// ✅ Fix PDF gibberish by replacing unsupported characters
const sanitizeForPDF = (text) =>
  text
    .replace(/•/g, "-")
    .replace(/→/g, "->")
    .replace(/∞/g, "INF")
    .replace(/[“”‘’]/g, '"')
    .replace(/—/g, "-")
    .replace(/·/g, "-")
    .replace(/\s{2,}/g, " ");



// ✅ Helper: Create full Hamming-style step-by-step export text
const generateDownloadContent = () => {
  let content = "";

  // ---------------- INPUT SECTION ----------------
  content += "==================== INPUT GRAPH ====================\n";
  content += `Total Nodes: ${nodes.length}\n`;
  content += `Total Edges: ${edges.length}\n\n`;

  content += "Nodes:\n";
  nodes.forEach(n => {
    content += `• Node ${n.id} (${n.name}) at (${n.x}, ${n.y})\n`;
  });

  content += "\nEdges:\n";
  edges.forEach(e => {
    content += `• (${nodes[e.from].name} → ${nodes[e.to].name})  Weight = ${e.weight}\n`;
  });

  content += "\n============================================================\n\n";

  // ---------------- ALGORITHM STEP-BY-STEP ----------------
  content += "================== STEP-BY-STEP LOG ==================\n";
  algorithmStates.forEach((state, i) => {
    content += `Step ${i + 1}: ${state.stepInfo}\n`;
    content += `Visited: ${[...state.visited].map(id => nodes[id].name).join(", ") || "None"}\n`;
    content += "MST Edges:\n";
    state.mstEdges.forEach(e => {
      content += `   (${nodes[e.from].name} → ${nodes[e.to].name})  Weight = ${e.weight}\n`;
    });
    content += "------------------------------------------------------------\n";
  });

  content += "\n============================================================\n\n";

  // ---------------- FINAL OUTPUT ----------------
  const totalWeight = mstEdges.reduce((sum, e) => sum + e.weight, 0).toFixed(2);
  content += "==================== FINAL OUTPUT ====================\n";
  content += `MST Edge Count: ${mstEdges.length}\n`;
  content += `Total MST Weight: ${totalWeight}\n\n`;

  mstEdges.forEach(e => {
    content += `• (${nodes[e.from].name} → ${nodes[e.to].name})  Weight = ${e.weight}\n`;
  });

  content += "============================================================\n";

  return content;
};

// ✅ Download as TXT
const downloadTXT = () => {
  const text = sanitizeForPDF(generateDownloadContent());
  const blob = new Blob([text], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `prims_${getTimestamp()}.txt`;
  a.click();
};

// ✅ Embedded Roboto Mono font (Base64, readable formatting)
const ROBOTO_MONO_BASE64 = `
AAEAAAAQAQAABAAAR0RFRrRCsIIAAJgAAAAHEdQT1O4BpcjAACcAAAAHEdHU1VUkHFWAADeAAAAC0dPUy8y
N8gAABQ4AAAACkdTVUIAAgAAABQ4AAAAHE1YWFhZk4jkAAAUOAAAACRjbWFwAAsAAAAgQwAAABRnbHlmQ0cA
ABxwAAABhGhlYWQJzR0sAAADZAAAADZoaGVhAAUAAAADoAAAACRobXR4AAUAAAAD6AAAAEFsb2NhAgAAAAEw
AAAAIG1heHAAUAAAAAG4AAAACm5hbWUAAwAAACy4AAAAJHBvc3QABQAAAAQ8AAAACgABAAAAAQAAAQmQUNzq
... more base64 lines ...
`.replace(/\s+/g, "");


// ✅ Download as PDF (includes graph screenshot)
// ✅ Download as PDF (includes graph screenshot)
const downloadPDF = async () => {
  setIsDownloading(true);

  const pdf = new jsPDF({ unit: "pt", format: "a4" });

  pdf.setFont("courier", "normal");
  let y = 40;

  // Title
  pdf.setFontSize(18);
  pdf.text("Prim's Algorithm Output", 40, y);
  y += 30;

  // 📌 Add Canvas Screenshot
  const canvas = canvasRef.current;
  if (canvas) {
    const screenshot = await html2canvas(canvas, { backgroundColor: "#232136" });
    const imgData = screenshot.toDataURL("image/png");

    const pdfWidth = pdf.internal.pageSize.getWidth() - 80;
    const aspect = screenshot.height / screenshot.width;
    const pdfHeight = pdfWidth * aspect;

    pdf.addImage(imgData, "PNG", 40, y, pdfWidth, pdfHeight);
    y += pdfHeight + 30;
  }

  pdf.setFontSize(11);
  const text = sanitizeForPDF(generateDownloadContent());
  const lines = pdf.splitTextToSize(text, 500);

  lines.forEach(line => {
    if (y > 780) {
      pdf.addPage();
      y = 40;
      pdf.setFont("courier", "normal");
      pdf.setFontSize(11);
    }
    pdf.text(line, 40, y);
    y += 16;
  });

  // ✅ NEW FILE NAME
  pdf.save("Prims_Algorithm_Output.pdf");
  setIsDownloading(false);
};



// 🔥 ADDED CODE END

  // canvas use effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    edges.forEach(edge => {
  const fromNode = nodes.find(n => n.id === edge.from);
  const toNode = nodes.find(n => n.id === edge.to);
  
  if (!fromNode || !toNode) return;
  
  const isMst = mstEdges.some(e => 
    (e.from === edge.from && e.to === edge.to) || 
    (!isDirected && e.from === edge.to && e.to === edge.from)
  );
  
  const isCurrent = currentEdge && 
    ((currentEdge.from === edge.from && currentEdge.to === edge.to) ||
     (!isDirected && currentEdge.from === edge.to && currentEdge.to === edge.from));

  // Check if there's a reverse edge (for directed graphs)
  const hasReverseEdge = isDirected && edges.some(e => 
    e.from === edge.to && e.to === edge.from
  );

  // Determine line color
  let strokeColor;
  if (isCurrent) {
    strokeColor = '#f6c177';
  } else if (isMst) {
    strokeColor = '#9ccfd8';
  } else if (hasReverseEdge && edge.from > edge.to) {
    // Use purple for the reverse edge
    strokeColor = '#c4a7e7';
  } else {
    strokeColor = '#6e6a86';
  }

  const lineWidth = (isCurrent || isMst) ? 4 : 2;

  if (hasReverseEdge) {
    // Draw curved line for bidirectional edges
const dx = toNode.x - fromNode.x;
const dy = toNode.y - fromNode.y;
const dist = Math.hypot(dx, dy) || 1;

// Perpendicular offset
const offset = 15;
const perpX = (-dy / dist) * offset;
const perpY = ( dx / dist) * offset;

// Put A→B on one side, B→A on the other (stable by id)
const sign = edge.from < edge.to ? 1 : -1;

// Control point for this specific directed edge
const controlX = (fromNode.x + toNode.x) / 2 + perpX * sign;
const controlY = (fromNode.y + toNode.y) / 2 + perpY * sign;

ctx.beginPath();
ctx.moveTo(fromNode.x, fromNode.y);
ctx.quadraticCurveTo(controlX, controlY, toNode.x, toNode.y);
ctx.strokeStyle = strokeColor;
ctx.lineWidth = lineWidth;
ctx.stroke();

// Arrow on the curve (unchanged logic, uses control point above)
if (isDirected) {
  const t = 0.85;
  const curveX = (1-t)*(1-t)*fromNode.x + 2*(1-t)*t*controlX + t*t*toNode.x;
  const curveY = (1-t)*(1-t)*fromNode.y + 2*(1-t)*t*controlY + t*t*toNode.y;

  const tangentX = 2*(1-t)*(controlX - fromNode.x) + 2*t*(toNode.x - controlX);
  const tangentY = 2*(1-t)*(controlY - fromNode.y) + 2*t*(toNode.y - controlY);
  const angle = Math.atan2(tangentY, tangentX);

  const arrowSize = 12;
  ctx.beginPath();
  ctx.moveTo(curveX, curveY);
  ctx.lineTo(curveX - arrowSize * Math.cos(angle - Math.PI/6),
             curveY - arrowSize * Math.sin(angle - Math.PI/6));
  ctx.moveTo(curveX, curveY);
  ctx.lineTo(curveX - arrowSize * Math.cos(angle + Math.PI/6),
             curveY - arrowSize * Math.sin(angle + Math.PI/6));
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

    // Draw weight label on the curve
    // ---- Weight label for curved bidirectional edge ----
const labelX = (fromNode.x + toNode.x) / 2 + perpX * 0.6 * sign;
const labelY = (fromNode.y + toNode.y) / 2 + perpY * 0.6 * sign;

const isEditingThis = editingEdge &&
  editingEdge.from === edge.from &&
  editingEdge.to === edge.to;

ctx.fillStyle = isEditingThis ? 'rgba(246, 193, 119, 0.7)' : 'rgba(35, 33, 54, 0.6)';
ctx.beginPath();
ctx.roundRect(labelX - 18, labelY - 12, 36, 24, 6);
ctx.fill();

ctx.strokeStyle = isEditingThis ? 'rgba(234, 154, 151, 0.8)' : 'rgba(68, 65, 90, 0.7)';
ctx.lineWidth = 2;
ctx.stroke();

ctx.fillStyle = isEditingThis ? '#232136' : '#e0def4';
ctx.font = '14px Arial';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText(String(edge.weight), labelX, labelY);

  } else {
    // Draw straight line for single direction or undirected
    ctx.beginPath();
    ctx.moveTo(fromNode.x, fromNode.y);
    ctx.lineTo(toNode.x, toNode.y);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    if (isDirected) {
      const angle = Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x);
      const arrowSize = 12;
      const arrowX = toNode.x - NODE_RADIUS * Math.cos(angle);
      const arrowY = toNode.y - NODE_RADIUS * Math.sin(angle);
      
      ctx.beginPath();
      ctx.moveTo(arrowX, arrowY);
      ctx.lineTo(
        arrowX - arrowSize * Math.cos(angle - Math.PI / 6),
        arrowY - arrowSize * Math.sin(angle - Math.PI / 6)
      );
      ctx.moveTo(arrowX, arrowY);
      ctx.lineTo(
        arrowX - arrowSize * Math.cos(angle + Math.PI / 6),
        arrowY - arrowSize * Math.sin(angle + Math.PI / 6)
      );
      ctx.stroke();
    }

    const midX = (fromNode.x + toNode.x) / 2;
    const midY = (fromNode.y + toNode.y) / 2;
    const isEditingThis = editingEdge && editingEdge.from === edge.from && editingEdge.to === edge.to;

    ctx.fillStyle = isEditingThis ? 'rgba(246, 193, 119, 0.7)' : 'rgba(35, 33, 54, 0.6)';
    ctx.beginPath();
    ctx.roundRect(midX - 18, midY - 12, 36, 24, 6);
    ctx.fill();

    ctx.strokeStyle = isEditingThis ? 'rgba(234, 154, 151, 0.8)' : 'rgba(68, 65, 90, 0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = isEditingThis ? '#232136' : '#e0def4';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(edge.weight, midX, midY);
  }
});

    if (dragStart && dragEnd && isDragging) {
      ctx.beginPath();
      ctx.moveTo(dragStart.x, dragStart.y);
      ctx.lineTo(dragEnd.x, dragEnd.y);
      ctx.strokeStyle = '#908caa';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    nodes.forEach(node => {
      const isVisited = visitedNodes.has(node.id);
      const isEditingThis = editingNode && editingNode.id === node.id;
      
      ctx.beginPath();
      ctx.arc(node.x, node.y, NODE_RADIUS, 0, 2 * Math.PI);
      ctx.fillStyle = isVisited ? '#9ccfd8' : '#c4a7e7';
      ctx.fill();
      ctx.strokeStyle = isEditingThis ? '#f6c177' : '#393552';
      ctx.lineWidth = isEditingThis ? 3 : 2;
      ctx.stroke();

      ctx.fillStyle = '#232136';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.name || node.id, node.x, node.y);
    });

    // Draw step counter
    if (currentStateIndex >= 0 && algorithmStates.length > 0) {
      const counterText = executionCompleted 
        ? `Step ${currentStateIndex + 1} / ${algorithmStates.length}`
        : `Step ${currentStateIndex + 1}`;
      
      ctx.font = 'bold 16px Arial';
      const textWidth = ctx.measureText(counterText).width;
      const boxWidth = textWidth + 20;
      
      ctx.fillStyle = 'rgba(35, 33, 54, 0.95)';
      ctx.beginPath();
      ctx.roundRect(canvas.width - boxWidth - 10, 10, boxWidth, 35, 8);
      ctx.fill();
      ctx.strokeStyle = '#44415a';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      ctx.fillStyle = '#e0def4';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(counterText, canvas.width - boxWidth / 2 - 10, 27);
    }

    // Draw "Execution is paused" text when paused
    if (isPaused) {
      ctx.fillStyle = 'rgba(246, 193, 119, 0.95)';
      ctx.beginPath();
      ctx.roundRect(10, 10, 180, 35, 8);
      ctx.fill();
      ctx.strokeStyle = '#ea9a97';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      ctx.fillStyle = '#232136';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Execution is paused', 100, 27);
    }
  }, [nodes, edges, dragStart, dragEnd, isDragging, mstEdges, visitedNodes, currentEdge, isDirected, editingNode, editingEdge, currentStateIndex, algorithmStates, executionCompleted, isPaused]);

  //------------JSX------------//

  // if on mobile
  if (isMobile) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6" style={{ 
        backgroundImage: 'url(/images/background.webp)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}>
        <div className="p-8 rounded-2xl shadow-2xl max-w-md text-center" style={{ 
          backgroundColor: 'rgba(42, 39, 63, 0.95)',
          border: '2px solid #44415a',
          backdropFilter: 'blur(10px)'
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#9ccfd8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
            <line x1="12" y1="18" x2="12.01" y2="18"></line>
          </svg>
          <h2 className="text-2xl font-bold mb-4" style={{ color: '#e0def4' }}>Desktop Required</h2>
          <p style={{ color: '#908caa' }}>
            This visualizer is optimized for desktop viewing. Please access this page on a desktop or laptop computer for the best experience.
          </p>
        </div>
      </div>
    );
  }

  // if on desktop (x > 900) 
  return (
    <div className='bruh'>
      <div 
        className="flex flex-col items-center gap-4 p-6 min-h-screen" 
        style={{ 
          backgroundColor: '#2a273f',
          backgroundImage: 'url(/images/background.webp)', 
          backgroundSize: 'cover', 
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        }}
      >
        {/* header */}
        <h1 className="text-4xl font-bold" style={{ color: '#e0def4', textShadow: '0 2px 10px rgba(156, 207, 216, 0.3)', marginBottom: '1em' }}>
          Prim's Algorithm Visualizer
        </h1>
        
        


        {/* main pane */}
        <div 
          className="p-4 rounded-xl shadow-2xl w-full max-w-7xl transition-all duration-300" 
          style={{ 
            backgroundColor: 'rgba(42, 39, 63, 0.8)', 
            border: '2px solid #44415a',
            backdropFilter: 'blur(10px)', 
            WebkitBackdropFilter: 'blur(10px)' 
          }}
        >
          {/* 🔥 TOP RIGHT BUTTON BAR (FLAT, SPACED, FULLY RIGHT ALIGNED) */}
<div className="flex flex-wrap gap-3 justify-end mb-4 w-full">

  {/* Download */}
  <button 
    onClick={() => setShowDownloadModal(true)}
    className="px-4 py-2 rounded-lg font-semibold transition-all duration-200 hover:scale-105"
    style={{ backgroundColor: '#9ccfd8', color: '#232136' }}
  >
    Download
  </button>

  {/* Help */}
  <button 
    onClick={() => setShowHelpModal(true)}
    className="px-4 py-2 rounded-lg font-semibold transition-all duration-200 hover:scale-105"
    style={{ backgroundColor: '#c4a7e7', color: '#232136' }}
  >
    Help
  </button>

  {/* Learn */}
  <button 
    onClick={() => setShowLearnModal(true)}
    className="px-4 py-2 rounded-lg font-semibold transition-all duration-200 hover:scale-105"
    style={{ backgroundColor: '#f6c177', color: '#232136' }}
  >
    Learn
  </button>

  {/* Developed By */}
  <button 
    onClick={() => setShowDevelopedByModal(true)}
    className="px-4 py-2 rounded-lg font-semibold transition-all duration-200 hover:scale-105"
    style={{ backgroundColor: '#eb6f92', color: '#232136' }}
  >
    Developed By
  </button>

  {/* --- Algorithm Control Buttons --- */}
  {!isRunning && !executionCompleted ? (
    /* ✅ Idle State → Show CALCULATE button */
    <button
      onClick={runPrimsAlgorithm}
      disabled={nodes.length === 0}
      className="px-6 py-2 rounded-lg font-semibold transition-all duration-200 hover:scale-105"
      style={{
        backgroundColor: nodes.length === 0 ? '#44415a' : '#9ccfd8',
        color: '#232136',
        cursor: nodes.length === 0 ? 'not-allowed' : 'pointer',
        boxShadow: nodes.length === 0 ? 'none' : '0 4px 15px rgba(156, 207, 216, 0.4)'
      }}
    >
      Calculate
    </button>
  ) : isRunning ? (
    /* ✅ Running State */
    <>
      {/* Pause / Resume */}
      <button
        onClick={togglePause}
        className="px-6 py-2 rounded-lg font-semibold transition-all duration-200 hover:scale-105"
        style={{ backgroundColor: '#f6c177', color: '#232136', boxShadow: '0 4px 15px rgba(246, 193, 119, 0.4)' }}
      >
        {isPaused ? 'Resume' : 'Pause'}
      </button>

      {/* Speed Up */}
<button
  onMouseDown={handleSpeedUpMouseDown}
  onMouseUp={handleSpeedUpMouseUp}
  onMouseLeave={handleSpeedUpMouseUp}
  className={`px-4 py-2 rounded-lg font-semibold transition-all duration-150 
    ${isSpeedingUp ? 'speed-active' : ''}`}
  style={{ 
    backgroundColor: '#eb6f92', 
    color: '#232136', 
    boxShadow: '0 4px 15px rgba(235, 111, 146, 0.35)' 
  }}
>
  {isSpeedingUp ? '⚡ 10× Speed' : '⏩ Speed'}
</button>



      {/* Prev / Next visible only when paused */}
      {isPaused && (
        <>
          <button
            onMouseDown={handlePrevMouseDown}
            onMouseUp={handlePrevMouseUp}
            onMouseLeave={handlePrevMouseUp}
            disabled={currentStateIndex <= 0}
            className="px-4 py-2 rounded-lg font-semibold transition-all duration-200 hover:scale-105"
            style={{
              backgroundColor: currentStateIndex <= 0 ? '#44415a' : '#c4a7e7',
              color: currentStateIndex <= 0 ? '#6e6a86' : '#232136',
              cursor: currentStateIndex <= 0 ? 'not-allowed' : 'pointer'
            }}
          >
            ← Previous
          </button>

          <button
            onMouseDown={handleNextMouseDown}
            onMouseUp={handleNextMouseUp}
            onMouseLeave={handleNextMouseUp}
            disabled={currentStateIndex >= algorithmStates.length - 1}
            className="px-4 py-2 rounded-lg font-semibold transition-all duration-200 hover:scale-105"
            style={{
              backgroundColor: currentStateIndex >= algorithmStates.length - 1 ? '#44415a' : '#c4a7e7',
              color: currentStateIndex >= algorithmStates.length - 1 ? '#6e6a86' : '#232136',
              cursor: currentStateIndex >= algorithmStates.length - 1 ? 'not-allowed' : 'pointer'
            }}
          >
            Next →
          </button>
        </>
      )}
    </>
  ) : (
    /* ✅ Completed State (after algorithm ends) */
    <>
      <button
        onMouseDown={handlePrevMouseDown}
        onMouseUp={handlePrevMouseUp}
        onMouseLeave={handlePrevMouseUp}
        disabled={currentStateIndex <= 0}
        className="px-4 py-2 rounded-lg font-semibold transition-all duration-200 hover:scale-105"
        style={{
          backgroundColor: currentStateIndex <= 0 ? '#44415a' : '#c4a7e7',
          color: currentStateIndex <= 0 ? '#6e6a86' : '#232136',
          cursor: currentStateIndex <= 0 ? 'not-allowed' : 'pointer'
        }}
      >
        ← Previous
      </button>

      <button
        onMouseDown={handleNextMouseDown}
        onMouseUp={handleNextMouseUp}
        onMouseLeave={handleNextMouseUp}
        disabled={currentStateIndex >= algorithmStates.length - 1}
        className="px-4 py-2 rounded-lg font-semibold transition-all duration-200 hover:scale-105"
        style={{
          backgroundColor: currentStateIndex >= algorithmStates.length - 1 ? '#44415a' : '#c4a7e7',
          color: currentStateIndex >= algorithmStates.length - 1 ? '#6e6a86' : '#232136',
          cursor: currentStateIndex >= algorithmStates.length - 1 ? 'not-allowed' : 'pointer'
        }}
      >
        Next →
      </button>
    </>
  )}

  {/* Reset */}
  <button
    onClick={reset}
    className="px-6 py-2 rounded-lg font-semibold transition-all duration-200 hover:scale-105"
    style={{ backgroundColor: '#eb6f92', color: '#232136' }}
  >
    Reset
  </button>

  {/* Directed Graph Checkbox */}
  <label className="flex items-center gap-2 cursor-pointer">
    <input
      type="checkbox"
      checked={isDirected}
      onChange={handleDirectedChange}
      disabled={isRunning}
      className="w-4 h-4 cursor-pointer accent-iris"
      style={{ accentColor: '#c4a7e7' }}
    />
    <span className="font-semibold" style={{ color: '#e0def4' }}>Directed</span>
  </label>

</div>




          {/* when editing nodes */}
          {editingNode && (
            <div className="mb-4 p-3 rounded-lg border-2 flex gap-2 items-center animate-fadeIn" style={{ backgroundColor: '#393552', borderColor: '#f6c177' }}>
              <span className="font-semibold" style={{ color: '#e0def4' }}>Edit node name:</span>
              <input
                type="text"
                value={nodeNameInput}
                onChange={(e) => setNodeNameInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && saveNodeName()}
                onFocus={(e) => e.target.select()}
                className="px-2 py-1 rounded-lg transition-all duration-200"
                style={{ backgroundColor: '#232136', color: '#e0def4', border: '2px solid #44415a' }}
                autoFocus
              />
              <button
                onClick={saveNodeName}
                className="px-4 py-1 rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95"
                style={{ backgroundColor: '#9ccfd8', color: '#232136' }}
              >
                Save
              </button>
              <button
                onClick={() => setEditingNode(null)}
                className="px-4 py-1 rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95"
                style={{ backgroundColor: '#6e6a86', color: '#e0def4' }}
              >
                Cancel
              </button>
            </div>
          )}

          {/* when editing edges */}
          {editingEdge && (
            <div className="mb-4 p-3 rounded-lg border-2 flex gap-2 items-center animate-fadeIn" style={{ backgroundColor: '#393552', borderColor: '#f6c177' }}>
              <span className="font-semibold" style={{ color: '#e0def4' }}>Edit edge weight:</span>
              <input
                type="number"
                step="0.1"
                value={edgeWeightInput}
                onChange={(e) => setEdgeWeightInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && saveEdgeWeight()}
                onFocus={(e) => e.target.select()}
                className="px-2 py-1 rounded-lg w-20 transition-all duration-200"
                style={{ backgroundColor: '#232136', color: '#e0def4', border: '2px solid #44415a' }}
                autoFocus
              />
              <button
                onClick={saveEdgeWeight}
                className="px-4 py-1 rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95"
                style={{ backgroundColor: '#9ccfd8', color: '#232136' }}
              >
                Save
              </button>
              <button
                onClick={() => setEditingEdge(null)}
                className="px-4 py-1 rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95"
                style={{ backgroundColor: '#6e6a86', color: '#e0def4' }}
              >
                Cancel
              </button>
            </div>
          )}

        

          {/* current algorithm step info */}
          {stepInfo && (
            <div className="mb-4 p-3 rounded-lg border-2 animate-fadeIn" style={{ backgroundColor: '#393552', borderColor: '#9ccfd8' }}>
              <p className="text-sm font-semibold" style={{ color: '#e0def4' }}>{stepInfo}</p>
            </div>
          )}

          {/* sub-panes */}
          <div className="flex gap-4 items-start">

            {/* left sub-pane */}
            <div 
              className="sticky top-6 self-start" 
              style={{
                alignSelf: 'flex-start',
                position: 'sticky',
                top: '1.5rem',
                zIndex: 10
              }}
            >
              <canvas
                ref={canvasRef}
                width={600}
                height={600}
                onClick={handleCanvasClick}
                onDoubleClick={handleCanvasDoubleClick}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onContextMenu={handleContextMenu}
                className={`rounded-lg cursor-crosshair transition-all duration-300 ${
                  isPaused ? 'border-dashed' : ''
                }`}
                style={{
                  backgroundColor: '#232136',
                  border: isPaused ? '3px dashed #f6c177' : '2px solid #44415a',
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)'
                }}
              />
                        
              {/* Canvas Info */}
              <div className="mt-4 flex gap-6 text-sm flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#c4a7e7' }}></div>
                  <span style={{ color: '#e0def4' }}>Unvisited Node</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#9ccfd8' }}></div>
                  <span style={{ color: '#e0def4' }}>Visited Node</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-1" style={{ backgroundColor: '#6e6a86' }}></div>
                  <span style={{ color: '#e0def4' }}>Edge</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-1" style={{ backgroundColor: '#9ccfd8' }}></div>
                  <span style={{ color: '#e0def4' }}>MST Edge</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-1" style={{ backgroundColor: '#f6c177' }}></div>
                  <span style={{ color: '#e0def4' }}>Considering</span>
                </div>
              </div>
            </div>
            
            {/* right sub-pane */}
            <div className="flex-1 overflow-auto animate-fadeIn">
              {/* --- algorithm state table --- */}
              {tableData.length > 0 && (
                <>
                  <h3 className="text-lg font-bold mb-2" style={{ color: '#e0def4' }}>
                    Algorithm State
                  </h3>
                  <div className="overflow-hidden rounded-lg mb-6" style={{ border: '2px solid #44415a' }}>
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr style={{ backgroundColor: '#393552' }}>
                          <th className="px-3 py-2" style={{ borderRight: '2px solid #44415a', borderBottom: '2px solid #44415a', color: '#e0def4' }}>Node</th>
                          <th className="px-3 py-2" style={{ borderRight: '2px solid #44415a', borderBottom: '2px solid #44415a', color: '#e0def4' }}>Visited</th>
                          <th className="px-3 py-2" style={{ borderRight: '2px solid #44415a', borderBottom: '2px solid #44415a', color: '#e0def4' }}>Distance</th>
                          <th className="px-3 py-2" style={{ borderBottom: '2px solid #44415a', color: '#e0def4' }}>Previous</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableData.map((row, idx) => (
                          <tr 
                            key={row.nodeId}
                            className="transition-all duration-300"
                            style={{ backgroundColor: changedNodes.has(row.nodeId) ? '#f6c177' : '#2a273f' }}
                          >
                            <td className="px-3 py-2 text-center font-semibold" style={{ borderRight: '2px solid #44415a', borderBottom: idx < tableData.length - 1 ? '2px solid #44415a' : 'none', color: changedNodes.has(row.nodeId) ? '#232136' : '#e0def4' }}>
                              {row.nodeName}
                            </td>
                            <td className="px-3 py-2 text-center" style={{ borderRight: '2px solid #44415a', borderBottom: idx < tableData.length - 1 ? '2px solid #44415a' : 'none', color: changedNodes.has(row.nodeId) ? '#232136' : '#e0def4' }}>
                              {row.visited ? '✓' : '✗'}
                            </td>
                            <td className="px-3 py-2 text-center" style={{ borderRight: '2px solid #44415a', borderBottom: idx < tableData.length - 1 ? '2px solid #44415a' : 'none', color: changedNodes.has(row.nodeId) ? '#232136' : '#e0def4' }}>
                              {row.distance}
                            </td>
                            <td className="px-3 py-2 text-center" style={{ borderBottom: idx < tableData.length - 1 ? '2px solid #44415a' : 'none', color: changedNodes.has(row.nodeId) ? '#232136' : '#e0def4' }}>
                              {row.previous}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* --- Prim’s Algorithm info section --- */}
              <div className="p-4 rounded-lg border-2" style={{ backgroundColor: '#393552', borderColor: '#9ccfd8' }}>
                <h3 className="text-lg font-bold mb-2" style={{ color: '#e0def4' }}>About Prim’s Algorithm</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#e0def4' }}>
                  Prim’s Algorithm is a greedy algorithm used to find the Minimum Spanning Tree (MST)
                  of a connected, weighted, undirected graph. It starts from an arbitrary node and
                  grows the MST one edge at a time by always choosing the minimum-weight edge that
                  connects a visited node to an unvisited node.
                </p>
                <ul className="mt-3 text-sm list-disc ml-5" style={{ color: '#e0def4' }}>
                  <li>Time Complexity: O(E log V) using a priority queue</li>
                  <li>Produces a tree with the minimum total edge weight</li>
                  <li>Works only on connected graphs</li>
                </ul>
                <br></br>
                <p className="text-sm leading-relaxed" style={{ color: '#e0def4' }}>
                  To visualize this algorithm, start by clicking anywhere on the canvas on the left 
                  to create nodes! Click on the info icon for more instructions.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* footer */}
        <footer className="mt-6 text-sm font-semibold text-center" style={{ color: '#908caa' }}>
          Created for a Computer Networks Project. Participants: 24BCE5375, 24BCE5406.
        </footer>

        
  {/* 🔥 DOWNLOAD MODAL (FINAL VERSION) */}
{showDownloadModal && (
  <div
    className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50"
  >
    <div
      className="p-6 rounded-xl shadow-2xl animate-fadeInScale"
      style={{ backgroundColor: '#2a273f', border: '2px solid #44415a', minWidth: '320px' }}
    >
      <h3 className="text-lg font-bold mb-4 text-center" style={{ color: '#e0def4' }}>
        Download as:
      </h3>

      {/* Buttons */}
      <div className="flex flex-col gap-3 mb-4">
        <button
          disabled={isDownloading}
          onClick={() => { setShowDownloadModal(false); downloadTXT(); }}
          className="px-6 py-2 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 active:scale-95"
          style={{ backgroundColor: '#9ccfd8', color: '#232136' }}
        >
          📄 TXT File
        </button>

        <button
          disabled={isDownloading}
          onClick={() => { setShowDownloadModal(false); downloadPDF(); }}
          className="px-6 py-2 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 active:scale-95"
          style={{ backgroundColor: '#c4a7e7', color: '#232136' }}
        >
          📘 PDF File
        </button>
      </div>

      {/* Cancel */}
      <button
        disabled={isDownloading}
        onClick={() => setShowDownloadModal(false)}
        className="w-full px-4 py-1 rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95"
        style={{ backgroundColor: '#eb6f92', color: '#232136' }}
      >
        ❌ Cancel
      </button>

      {/* Downloading Indicator */}
      {isDownloading && (
        <p className="mt-3 text-center text-sm" style={{ color: '#f6c177' }}>
          Preparing PDF... please wait ⏳
        </p>
      )}
    </div>
  </div>
)}

{/* ✅ UPDATED HELP MODAL (Clear, Step-by-Step, With Color Legend) */}
{showHelpModal && (
  <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50">
    <div
      className="p-6 rounded-xl shadow-2xl animate-fadeInScale"
      style={{ backgroundColor: '#2a273f', border: '2px solid #44415a', width: '520px', maxHeight: '85vh', overflowY: 'auto' }}
    >
      <h3 className="text-xl font-bold text-center mb-4" style={{ color: '#e0def4' }}>
        How to Use This Tool
      </h3>

      <div className="text-sm leading-relaxed space-y-4" style={{ color: '#e0def4' }}>

        {/* --- Graph Building Instructions --- */}
        <div>
          <h4 className="font-bold mb-1">Building the Graph</h4>
          <ul className="list-disc ml-5 space-y-1">
            <li>Click on empty space to create a new node.</li>
            <li>To create an edge, click and drag from one node to another, then release.</li>
            <li>Double-click a node to rename it.</li>
            <li>Double-click an edge to change its weight.</li>
            <li>Right-click a node or edge to delete it.</li>
          </ul>
        </div>

        {/* --- Running the Algorithm --- */}
        <div>
          <h4 className="font-bold mb-1">Running Prim’s Algorithm</h4>
          <ul className="list-disc ml-5 space-y-1">
            <li>After creating the graph, press the <b>Calculate</b> button.</li>
            <li>The algorithm will run step-by-step automatically.</li>
            <li>You can pause at any time using the <b>Pause</b> button.</li>
            <li>When paused, use <b>Previous</b> and <b>Next</b> to move through steps manually.</li>
            <li>Press <b>Reset</b> to clear everything and start again.</li>
          </ul>
        </div>

        <div>
  <h4 className="font-bold mb-1">⏩ Speed Up</h4>
  <ul className="list-disc ml-5 space-y-1">
    <li>While the algorithm is running or paused, you can speed it up.</li>
    <li>Hold the <b>⏩ Speed</b> button to make it run 10× faster.</li>
    <li>Release the button to return to normal speed.</li>
  </ul>
</div>

        {/* --- Speed Control --- */}
<div>
  <h4 className="font-bold mb-1">Speed Control</h4>
  <ul className="list-disc ml-5 space-y-1">
    <li>The algorithm plays at normal speed automatically.</li>
    <li>When paused, you can move step-by-step using <b>Next</b> and <b>Previous</b>.</li>
    <li>Hold the button to fast-forward or rewind continuously.</li>
    <li>Release the button to go back to normal speed.</li>
  </ul>
</div>


        {/* --- Directed Mode --- */}
<div>
  <h4 className="font-bold mb-1">Directed vs Undirected Mode</h4>
  <ul className="list-disc ml-5 space-y-1">
    <li>When “Directed” is OFF, edges are normal (no arrows) and can be used both ways.</li>
    <li>When “Directed” is ON, arrows appear and direction matters.</li>
    <li>Dragging from A → B creates a forward arrow only.</li>
    <li>If you also drag from B → A, a reverse arrow is added and shown as a curved line.</li>
    <li>Forward edge = normal color, reverse edge = purple color for clarity.</li>
    <li>Weights for A→B and B→A are stored separately and can be edited independently.</li>
  </ul>
</div>


        {/* --- Colour Legend --- */}
        <div>
          <h4 className="font-bold mb-2">Colour Legend</h4>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#c4a7e7' }}></div>
              Unvisited Node
            </li>
            <li className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#9ccfd8' }}></div>
              Visited Node
            </li>
            <li className="flex items-center gap-2">
              <div className="w-8 h-1" style={{ backgroundColor: '#6e6a86' }}></div>
              Normal Edge
            </li>
            <li className="flex items-center gap-2">
              <div className="w-8 h-1" style={{ backgroundColor: '#9ccfd8' }}></div>
              Edge in MST
            </li>
            <li className="flex items-center gap-2">
              <div className="w-8 h-1" style={{ backgroundColor: '#f6c177' }}></div>
              Edge currently being checked
            </li>
          </ul>
        </div>

        {/* --- Notes --- */}
        <div>
          <h4 className="font-bold mb-1">Notes</h4>
          <ul className="list-disc ml-5 space-y-1">
            <li>You need at least one node before you can run the algorithm.</li>
            <li>Prim’s Algorithm only works if the graph is connected.</li>
            <li>Edge weights must be valid positive numbers.</li>
          </ul>
        </div>

      </div>

      {/* Close Button */}
      <button
        onClick={() => setShowHelpModal(false)}
        className="w-full px-4 py-2 rounded-lg mt-5 font-semibold"
        style={{ backgroundColor: '#eb6f92', color: '#232136' }}
      >
        Close
      </button>
    </div>
  </div>
)}


{/* 🔥 LEARN MODAL */}
{showLearnModal && (
  <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50">
    <div className="p-6 rounded-xl shadow-2xl animate-fadeInScale"
      style={{ backgroundColor: '#2a273f', border: '2px solid #44415a', width: '500px' }}>
      
      <h3 className="text-xl font-bold text-center mb-4" style={{ color: '#e0def4' }}>Learn</h3>

      <div className="flex flex-col gap-3 text-center">
       <button
  onClick={() => window.open('/assets/Introduction to Algorithms.pdf', '_blank', 'noopener')}
  className="py-2 rounded-lg transition-all duration-200 hover:scale-105"
  style={{ backgroundColor: '#9ccfd8', color: '#232136' }}
>
  📘 Materials from Textbook
</button>

<button
  onClick={() => setShowHowModal(true)}
  className="py-2 rounded-lg transition-all duration-200 hover:scale-105"
  style={{ backgroundColor: '#c4a7e7', color: '#232136' }}
>
  🛠️ How We Built This Project
  
</button>

{/* 🛠️ HOW WE BUILT THIS PROJECT – MODAL */}
{showHowModal && (
  <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50">
    <div
      className="p-6 rounded-xl shadow-2xl animate-fadeInScale"
      style={{ backgroundColor: '#2a273f', border: '2px solid #44415a', width: '600px', maxHeight: '80vh', overflowY: 'auto' }}
    >
      <h3 className="text-xl font-bold text-center mb-4" style={{ color: '#e0def4' }}>
        🛠️ How We Built This Project
      </h3>

      <div className="text-sm leading-relaxed space-y-4" style={{ color: '#e0def4' }}>

        <div>
          <h4 className="font-bold mb-1">🔧 Tech Stack & Method</h4>
          <ul className="list-disc ml-5 space-y-1">
            <li>React + JavaScript for UI & state management</li>
            <li>HTML5 Canvas for drawing nodes, edges, and animation</li>
            <li>Custom implementation of Prim’s Algorithm (no external libraries)</li>
            <li>Step-by-step state saving to enable Pause / Resume / Previous / Next</li>
            <li>PDF + TXT export using <b>jsPDF</b> and <b>html2canvas</b></li>
            <li>Responsive UI with glassmorphism theme</li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold mb-1">📚 Reference Books</h4>
          <ul className="list-disc ml-5 space-y-1">
            <li>Thomas H. Cormen – <i>Introduction to Algorithms</i> (CLRS), 3rd Edition (Ch. 23: MST)</li>
            <li>Data Structures and Algorithm Analysis — Mark Allen Weiss</li>
            <li>Graph Theory with Applications — Narsingh Deo</li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold mb-1">🌐 Helpful Websites</h4>
          <ul className="list-disc ml-5 space-y-1">
            <li><a href="https://www.geeksforgeeks.org/prims-minimum-spanning-tree-mst-greedy-algo-5/" target="_blank" rel="noopener noreferrer" style={{ color:'#9ccfd8' }}>GeeksForGeeks – Prim’s Algorithm</a></li>
            <li><a href="https://visualgo.net/en/mst" target="_blank" rel="noopener noreferrer" style={{ color:'#9ccfd8' }}>VisuAlgo – MST Animations</a></li>
            <li><a href="https://medium.com/" target="_blank" rel="noopener noreferrer" style={{ color:'#9ccfd8' }}>Medium – UI Ideas & Canvas Logic</a></li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold mb-1">📝 Why We Made It</h4>
          <p>
            To convert a static MST concept into an interactive visual learning tool,
            showing every step of Prim’s Algorithm instead of only the final result.
          </p>
        </div>

      </div>

      <button
        onClick={() => setShowHowModal(false)}
        className="w-full px-4 py-2 rounded-lg mt-5"
        style={{ backgroundColor: '#eb6f92', color: '#232136' }}
      >
        Close
      </button>
    </div>
  </div>
)}



<div className="mb-4">
  <div className="px-5 py-3 rounded-t-lg font-semibold text-center" style={{ backgroundColor: '#4866c9', color: '#fff' }}>
    🎞️ Watch Animated Video
  </div>
  <div className="bg-black rounded-b-lg overflow-hidden" style={{ position: 'relative', paddingTop: '56.25%' }}>
    <iframe
      src="https://www.youtube.com/embed/EHRqQBlZAtU"
      title="Prim's Algorithm Animation"
      frameBorder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
      style={{ position: 'absolute', top:0, left:0, width:'100%', height:'100%' }}
    />
  </div>
</div>

        <button
  onClick={() => setShowRefsModal(true)}
  className="py-2 px-4 rounded-lg font-semibold transition-all duration-200 hover:scale-105"
  style={{ backgroundColor: '#9ccfd8', color: '#232136' }}
>
  📚 References
</button>
{/* 📚 REFERENCES MODAL */}
{showRefsModal && (
  <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50">
    <div
      className="p-6 rounded-xl shadow-2xl animate-fadeInScale"
      style={{ backgroundColor: '#2a273f', border: '2px solid #44415a', width: '550px', maxHeight: '80vh', overflowY: 'auto' }}
    >
      <h3 className="text-xl font-bold text-center mb-4" style={{ color: '#e0def4' }}>
        📚 References
      </h3>

      <div className="text-sm leading-relaxed" style={{ color: '#e0def4' }}>

        <h4 className="font-bold mb-2">📘 Textbooks</h4>
        <ul className="list-disc ml-5 space-y-1">
          <li>Thomas H. Cormen – <i>Introduction to Algorithms</i> (CLRS), 3rd Edition</li>
          <li>Mark Allen Weiss – <i>Data Structures and Algorithm Analysis</i></li>
          <li>Narsingh Deo – <i>Graph Theory with Applications</i></li>
        </ul>

        <h4 className="font-bold mt-4 mb-2">🌐 Online Resources</h4>
        <ul className="list-disc ml-5 space-y-1">
          <li><a href="https://www.geeksforgeeks.org/prims-minimum-spanning-tree-mst-greedy-algo-5/" target="_blank" rel="noopener noreferrer" style={{ color:'#9ccfd8' }}>GeeksForGeeks – Prim’s Algorithm</a></li>
          <li><a href="https://visualgo.net/en/mst" target="_blank" rel="noopener noreferrer" style={{ color:'#9ccfd8' }}>VisuAlgo – MST Visualization</a></li>
          <li><a href="https://www.youtube.com/watch?v=EHRqQBlZAtU" target="_blank" rel="noopener noreferrer" style={{ color:'#9ccfd8' }}>YouTube – Prim’s Algorithm Explanation</a></li>
        </ul>

      </div>

      <button
        onClick={() => setShowRefsModal(false)}
        className="w-full mt-5 px-4 py-2 rounded-lg transition-all duration-200 hover:scale-105"
        style={{ backgroundColor: '#eb6f92', color: '#232136' }}
      >
        Close
      </button>
    </div>
  </div>
)}

      </div>

      <button
        onClick={() => setShowLearnModal(false)}
        className="w-full px-4 py-2 rounded-lg mt-4"
        style={{ backgroundColor: '#eb6f92', color: '#232136' }}
      >
        Close
      </button>
    </div>
  </div>
)}

{/* 🔥 DEVELOPED BY MODAL */}
{showDevelopedByModal && (
  <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50">
    <div className="p-6 rounded-xl shadow-2xl animate-fadeInScale"
      style={{ backgroundColor: '#2a273f', border: '2px solid #44415a', width: '520px' }}>
      
      <h3 className="text-xl font-bold text-center mb-4" style={{ color: '#e0def4' }}>Developed By</h3>

      {/* Student 1 */}
      <div className="flex gap-4 mb-4 items-center">
        <img
          src="/images/member1.jpg"
          className="w-24 h-24 rounded-lg border-2 border-[#44415a] cursor-zoom-in"
          alt="Member 1"
          title="Click to enlarge"
          onClick={() => setZoomImage('/images/member1.jpg')}
        />
        <div style={{ color: '#e0def4' }}>
          <p className="font-bold">Pranav Aathrey</p>
          <p>24BCE5375</p>
        </div>
      </div>

      {/* Student 2 */}
      <div className="flex gap-4 mb-6 items-center">
        <img
          src="/images/member2.jpg"
          className="w-24 h-24 rounded-lg border-2 border-[#44415a] cursor-zoom-in"
          alt="Member 2"
          title="Click to enlarge"
          onClick={() => setZoomImage('/images/member2.jpg')}
        />
        <div style={{ color: '#e0def4' }}>
          <p className="font-bold">Puneeth Reddy T</p>
          <p>24BCE5406</p>
        </div>
      </div>

      {/* Guided By */}
      <h4 className="text-lg font-bold text-center mb-3" style={{ color: '#e0def4' }}>Guided By</h4>
      <div className="flex gap-4 mb-6 items-center">
        <img
          src="/images/member3.jpg"
          className="w-24 h-24 rounded-lg border-2 border-[#44415a] cursor-zoom-in"
          alt="Dr. Swaminathan Annadurai"
          title="Click to enlarge"
          onClick={() => setZoomImage('/images/member3.jpg')}
        />
        <div style={{ color: '#e0def4' }}>
          <p className="font-bold">Dr. Swaminathan Annadurai</p>
          <p>Faculty Guide</p>
        </div>
      </div>

      <button
        onClick={() => setShowDevelopedByModal(false)}
        className="w-full px-4 py-2 rounded-lg"
        style={{ backgroundColor: '#eb6f92', color: '#232136' }}
      >
        Close
      </button>
    </div>
  </div>
)}

{/* 🔍 Image Zoom Modal */}
{zoomImage && (
  <div
    className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-70"
    onClick={() => setZoomImage(null)} // click backdrop to close
  >
    <div
      className="relative p-2 rounded-xl shadow-2xl animate-fadeInScale"
      style={{ backgroundColor: '#2a273f', border: '2px solid #44415a' }}
      onClick={(e) => e.stopPropagation()} // prevent closing when clicking image/card
    >
      <img
        src={zoomImage}
        alt="Zoomed"
        className="max-w-[90vw] max-h-[80vh] rounded-lg"
      />
      <button
        onClick={() => setZoomImage(null)}
        className="absolute -top-3 -right-3 px-3 py-1 rounded-full text-sm font-semibold"
        style={{ backgroundColor: '#eb6f92', color: '#232136', boxShadow: '0 6px 18px rgba(0,0,0,0.45)' }}
        aria-label="Close"
      >
        ✕
      </button>
    </div>
  </div>
)}


        
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fadeIn {
            animation: fadeIn 0.3s ease-out;
          }
          
          /* --- Custom Styles for Checkbox --- */
          input[type='checkbox'] {
            position: relative;
            cursor: pointer;
            /* Hides the default browser checkbox */
            -webkit-appearance: none;
            -moz-appearance: none;
            appearance: none;
          }

          input[type='checkbox']:before {
            content: "";
            position: absolute;
            width: 16px;
            height: 16px;
            top: 0;
            left: 0;
            /* Dark Desaturated Purple Border */
            border: 2px solid #44415a; 
            border-radius: 5px;
            padding: 1px;
            /* Darker Background for Unchecked State */
            background-color: #28243b; 
          }

          input[type='checkbox']:checked:before {
            /* Primary Accent Color for Checked State */
            background-color: #9575cd; 
            border-color: #9575cd; 
          }

          input[type='checkbox']:checked:after {
            content: "";
            display: block;
            width: 5px;
            height: 10px;
            /* Light/Subtle Text Color for the Checkmark */
            border: solid #e0def4; 
            border-width: 0 2px 2px 0;
            -webkit-transform: rotate(45deg);
            -ms-transform: rotate(45deg);
            transform: rotate(45deg);
            position: absolute;
            top: 2px;
            left: 6px;
          }
          
          /* --- Custom Styles for Number Input Spin Buttons --- */
          input[type='number']::-webkit-inner-spin-button, 
          input[type='number']::-webkit-outer-spin-button {
            -webkit-appearance: none;
            margin: 0;
            opacity: 1;
            color: #908caa; /* Sets the color of the arrows themselves */
            background-color: #393552; /* Darker background for the button area */
            border-left: 2px solid #44415a;
          }
          
          input[type='number'] {
            -moz-appearance: textfield;
          }
          /* 🔥 ADDED: fade animation for modal */
          @keyframes fadeInScale {
            from { opacity: 0; transform: scale(0.9); }
            to { opacity: 1; transform: scale(1); }
          }
          .animate-fadeInScale {
            animation: fadeInScale 0.22s ease-out;
          }

          /* --- Speed Button Active Effect --- */
.speed-active {
  background-color: #d9587f !important;
  transform: scale(0.92);
  animation: pulseGlow 0.6s infinite alternate;
}

@keyframes pulseGlow {
  from {
    box-shadow: 0 0 10px rgba(235, 111, 146, 0.4),
                0 0 20px rgba(235, 111, 146, 0.25);
  }
  to {
    box-shadow: 0 0 18px rgba(235, 111, 146, 0.7),
                0 0 28px rgba(235, 111, 146, 0.45);
  }
}


        `}</style>
      </div>
    </div>

  );
}