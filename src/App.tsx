import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Rect, Circle, Line, Text, Group, Path } from 'react-konva';
import { Menu, Play, Square, Save, FolderOpen, Plus, Settings, ZoomIn, ZoomOut, Move, RotateCw, FileText } from 'lucide-react';

// Basic Component Types
type ComponentType = 'Resistor' | 'Capacitor' | 'Inductor' | 'VoltageSource' | 'CurrentSource' | 'Diode' | 'Ground';

interface Point {
  x: number;
  y: number;
}

interface Pin {
  id: string;
  x: number;
  y: number;
  nodeId?: string;
}

interface CircuitComponent {
  id: string;
  type: ComponentType;
  position: Point;
  rotation: number;
  value: string;
  pins: Pin[];
}

interface Wire {
  id: string;
  startPinId: string;
  endPinId: string;
  points: number[]; // [x1, y1, x2, y2]
}

export default function App() {
  const [components, setComponents] = useState<CircuitComponent[]>([]);
  const [wires, setWires] = useState<Wire[]>([]);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [selectedTool, setSelectedTool] = useState<ComponentType | 'Select' | 'Wire'>('Select');
  const [isSimulating, setIsSimulating] = useState(false);
  const [wiringStartPin, setWiringStartPin] = useState<{compId: string, pinId: string, x: number, y: number} | null>(null);
  const [mousePos, setMousePos] = useState<Point>({x: 0, y: 0});
  const [netlist, setNetlist] = useState<string>('');
  const [showNetlist, setShowNetlist] = useState(false);
  const [simResult, setSimResult] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'netlist' | 'result'>('netlist');
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null);
  
  const stageRef = useRef<any>(null);
  const workerRef = useRef<Worker | null>(null);
  const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  // Initialize NGSpice Web Worker
  useEffect(() => {
    workerRef.current = new Worker('/wasm/spiceWorker.js');
    workerRef.current.onmessage = (e) => {
      if (e.data.type === 'initialized') {
        console.log('NGSpice worker initialized');
      } else if (e.data.type === 'result' || e.data.type === 'error') {
        setIsSimulating(false);
        setSimResult(e.data.output + (e.data.error ? '\n\nErrors:\n' + e.data.error : ''));
        setActiveTab('result');
      }
    };
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setStageSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Grid drawing
  const GRID_SIZE = 20;
  const drawGrid = () => {
    const lines = [];
    const width = stageSize.width / scale;
    const height = stageSize.height / scale;
    const startX = -position.x / scale;
    const startY = -position.y / scale;

    for (let i = Math.floor(startX / GRID_SIZE) * GRID_SIZE; i < startX + width; i += GRID_SIZE) {
      lines.push(<Line key={`v${i}`} points={[i, startY, i, startY + height]} stroke="#e0e0e0" strokeWidth={1 / scale} />);
    }
    for (let i = Math.floor(startY / GRID_SIZE) * GRID_SIZE; i < startY + height; i += GRID_SIZE) {
      lines.push(<Line key={`h${i}`} points={[startX, i, startX + width, i]} stroke="#e0e0e0" strokeWidth={1 / scale} />);
    }
    return lines;
  };

  const handleStageClick = (e: any) => {
    if (selectedTool === 'Select' || selectedTool === 'Wire') {
      // If clicking on empty stage
      if (e.target === e.target.getStage()) {
        if (wiringStartPin) setWiringStartPin(null);
        setSelectedComponentId(null);
        setSelectedWireId(null);
      }
      return;
    }

    const stage = e.target.getStage();
    const pointerPosition = stage.getPointerPosition();
    
    // Snap to grid
    const x = Math.round((pointerPosition.x - position.x) / scale / GRID_SIZE) * GRID_SIZE;
    const y = Math.round((pointerPosition.y - position.y) / scale / GRID_SIZE) * GRID_SIZE;

    const compId = `${selectedTool}-${Date.now()}`;
    const newComponent: CircuitComponent = {
      id: compId,
      type: selectedTool as ComponentType,
      position: { x, y },
      rotation: 0,
      value: getDefaultValue(selectedTool as ComponentType),
      pins: getPinsForComponent(selectedTool as ComponentType, compId)
    };

    setComponents([...components, newComponent]);
    setSelectedTool('Select');
  };

  const getDefaultValue = (type: ComponentType) => {
    switch(type) {
      case 'Resistor': return '1k';
      case 'Capacitor': return '1uF';
      case 'Inductor': return '1mH';
      case 'VoltageSource': return '5V';
      case 'CurrentSource': return '1A';
      case 'Diode': return '1N4148';
      default: return '';
    }
  };

  const getPinsForComponent = (type: ComponentType, compId: string): Pin[] => {
    switch(type) {
      case 'Resistor': return [{id: `${compId}-p1`, x: -20, y: 0}, {id: `${compId}-p2`, x: 20, y: 0}];
      case 'Capacitor': return [{id: `${compId}-p1`, x: -20, y: 0}, {id: `${compId}-p2`, x: 20, y: 0}];
      case 'Inductor': return [{id: `${compId}-p1`, x: -20, y: 0}, {id: `${compId}-p2`, x: 20, y: 0}];
      case 'Diode': return [{id: `${compId}-p1`, x: -20, y: 0}, {id: `${compId}-p2`, x: 20, y: 0}];
      case 'VoltageSource': return [{id: `${compId}-p1`, x: 0, y: -20}, {id: `${compId}-p2`, x: 0, y: 20}];
      case 'CurrentSource': return [{id: `${compId}-p1`, x: 0, y: -20}, {id: `${compId}-p2`, x: 0, y: 20}];
      case 'Ground': return [{id: `${compId}-p1`, x: 0, y: 0}];
      default: return [{id: `${compId}-p1`, x: -20, y: 0}, {id: `${compId}-p2`, x: 20, y: 0}];
    }
  };

  const handlePinClick = (e: any, compId: string, pin: Pin, absX: number, absY: number) => {
    e.cancelBubble = true; // Prevent stage click
    
    if (selectedTool !== 'Wire') {
      setSelectedTool('Wire');
    }

    if (!wiringStartPin) {
      setWiringStartPin({ compId, pinId: pin.id, x: absX, y: absY });
    } else {
      if (wiringStartPin.pinId !== pin.id) {
        const newWire: Wire = {
          id: `wire-${Date.now()}`,
          startPinId: wiringStartPin.pinId,
          endPinId: pin.id,
          points: [wiringStartPin.x, wiringStartPin.y, absX, absY]
        };
        setWires([...wires, newWire]);
      }
      setWiringStartPin(null);
      setSelectedTool('Select');
    }
  };

  const rotateComponent = (id: string) => {
    setComponents(components.map(c => {
      if (c.id === id) {
        return { ...c, rotation: (c.rotation + 90) % 360 };
      }
      return c;
    }));
  };

  // SPICE Netlist Generation
  const getNetlistString = () => {
    let spice = "* Circuit Safari Clone Netlist\n";
    let nodeCounter = 1;
    const pinToNode: Record<string, string> = {};

    // Helper to get or assign a node
    const getNode = (pinId: string) => {
      if (pinToNode[pinId]) return pinToNode[pinId];
      
      // Find all connected pins via wires
      const connectedPins = new Set<string>([pinId]);
      let changed = true;
      while(changed) {
        changed = false;
        wires.forEach(w => {
          if (connectedPins.has(w.startPinId) && !connectedPins.has(w.endPinId)) {
            connectedPins.add(w.endPinId);
            changed = true;
          }
          if (connectedPins.has(w.endPinId) && !connectedPins.has(w.startPinId)) {
            connectedPins.add(w.startPinId);
            changed = true;
          }
        });
      }

      // Check if any connected pin belongs to a Ground component
      let isGround = false;
      components.forEach(c => {
        if (c.type === 'Ground' && connectedPins.has(c.pins[0].id)) {
          isGround = true;
        }
      });

      const assignedNode = isGround ? "0" : `N${nodeCounter++}`;
      connectedPins.forEach(p => {
        pinToNode[p] = assignedNode;
      });

      return assignedNode;
    };

    let rCount = 1, vCount = 1, cCount = 1, lCount = 1, iCount = 1, dCount = 1;
    let hasDiode = false;

    components.forEach(comp => {
      if (comp.type === 'Ground') return; // Ground just defines node 0

      const n1 = getNode(comp.pins[0].id);
      const n2 = comp.pins.length > 1 ? getNode(comp.pins[1].id) : "0";

      if (comp.type === 'Resistor') {
        spice += `R${rCount++} ${n1} ${n2} ${comp.value}\n`;
      } else if (comp.type === 'VoltageSource') {
        // Assuming pin 0 is positive, pin 1 is negative
        spice += `V${vCount++} ${n1} ${n2} DC ${comp.value.replace('V', '')}\n`;
      } else if (comp.type === 'CurrentSource') {
        spice += `I${iCount++} ${n1} ${n2} DC ${comp.value.replace('A', '')}\n`;
      } else if (comp.type === 'Capacitor') {
        spice += `C${cCount++} ${n1} ${n2} ${comp.value}\n`;
      } else if (comp.type === 'Inductor') {
        spice += `L${lCount++} ${n1} ${n2} ${comp.value}\n`;
      } else if (comp.type === 'Diode') {
        spice += `D${dCount++} ${n1} ${n2} DMOD\n`;
        hasDiode = true;
      }
    });

    if (hasDiode) {
      spice += `.MODEL DMOD D\n`;
    }

    spice += ".OP\n"; // Add operating point analysis by default
    spice += ".END\n";
    return spice;
  };

  const generateNetlist = () => {
    setNetlist(getNetlistString());
    setActiveTab('netlist');
    setShowNetlist(true);
  };

  const runSimulation = () => {
    if (isSimulating) {
      setIsSimulating(false);
      return;
    }
    
    const spice = getNetlistString();
    setNetlist(spice);
    
    if (workerRef.current) {
      setIsSimulating(true);
      setSimResult('Simulating...');
      setActiveTab('result');
      setShowNetlist(true);
      workerRef.current.postMessage({ type: 'simulate', netlist: spice });
    } else {
      alert("Spice worker not initialized yet.");
    }
  };

  const renderComponentSymbol = (comp: CircuitComponent) => {
    switch(comp.type) {
      case 'Resistor':
        return (
          <Group>
            <Line points={[-20, 0, -10, 0, -5, -10, 5, 10, 10, 0, 20, 0]} stroke="black" strokeWidth={2} />
            <Text text={comp.value} x={-10} y={-20} fontSize={12} />
          </Group>
        );
      case 'VoltageSource':
        return (
          <Group>
            <Circle x={0} y={0} radius={15} stroke="black" strokeWidth={2} />
            <Text text="+" x={-4} y={-12} fontSize={12} />
            <Text text="-" x={-3} y={2} fontSize={12} />
            <Line points={[0, -15, 0, -20]} stroke="black" strokeWidth={2} />
            <Line points={[0, 15, 0, 20]} stroke="black" strokeWidth={2} />
            <Text text={comp.value} x={20} y={-5} fontSize={12} />
          </Group>
        );
      case 'CurrentSource':
        return (
          <Group>
            <Circle x={0} y={0} radius={15} stroke="black" strokeWidth={2} />
            <Line points={[0, 10, 0, -10]} stroke="black" strokeWidth={2} />
            <Line points={[-5, -5, 0, -10, 5, -5]} stroke="black" strokeWidth={2} />
            <Line points={[0, -15, 0, -20]} stroke="black" strokeWidth={2} />
            <Line points={[0, 15, 0, 20]} stroke="black" strokeWidth={2} />
            <Text text={comp.value} x={20} y={-5} fontSize={12} />
          </Group>
        );
      case 'Capacitor':
        return (
          <Group>
            <Line points={[-20, 0, -5, 0]} stroke="black" strokeWidth={2} />
            <Line points={[5, 0, 20, 0]} stroke="black" strokeWidth={2} />
            <Line points={[-5, -10, -5, 10]} stroke="black" strokeWidth={2} />
            <Line points={[5, -10, 5, 10]} stroke="black" strokeWidth={2} />
            <Text text={comp.value} x={-10} y={-20} fontSize={12} />
          </Group>
        );
      case 'Inductor':
        return (
          <Group>
            <Line points={[-20, 0, -10, 0]} stroke="black" strokeWidth={2} />
            <Line points={[10, 0, 20, 0]} stroke="black" strokeWidth={2} />
            <Path data="M -10 0 Q -5 -10 0 0 Q 5 -10 10 0" stroke="black" strokeWidth={2} fill="transparent" />
            <Text text={comp.value} x={-10} y={-20} fontSize={12} />
          </Group>
        );
      case 'Diode':
        return (
          <Group>
            <Line points={[-20, 0, -10, 0]} stroke="black" strokeWidth={2} />
            <Line points={[10, 0, 20, 0]} stroke="black" strokeWidth={2} />
            <Line points={[-10, -10, -10, 10, 10, 0, -10, -10]} stroke="black" strokeWidth={2} />
            <Line points={[10, -10, 10, 10]} stroke="black" strokeWidth={2} />
            <Text text={comp.value} x={-15} y={-20} fontSize={12} />
          </Group>
        );
      case 'Ground':
        return (
          <Group>
            <Line points={[0, 0, 0, 10]} stroke="black" strokeWidth={2} />
            <Line points={[-10, 10, 10, 10]} stroke="black" strokeWidth={2} />
            <Line points={[-6, 14, 6, 14]} stroke="black" strokeWidth={2} />
            <Line points={[-2, 18, 2, 18]} stroke="black" strokeWidth={2} />
          </Group>
        );
      default:
        return <Rect x={-15} y={-10} width={30} height={20} fill="gray" />;
    }
  };

  // Calculate absolute pin position accounting for rotation
  const getAbsolutePinPos = (comp: CircuitComponent, pin: Pin) => {
    const rad = comp.rotation * Math.PI / 180;
    const rx = pin.x * Math.cos(rad) - pin.y * Math.sin(rad);
    const ry = pin.x * Math.sin(rad) + pin.y * Math.cos(rad);
    return { x: comp.position.x + rx, y: comp.position.y + ry };
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* Top Toolbar */}
      <div className="h-14 bg-white border-b flex items-center justify-between px-4 shadow-sm z-10 w-full">
        <div className="flex items-center space-x-4">
          <Menu className="w-6 h-6 text-gray-600" />
          <h1 className="text-lg font-semibold text-gray-800">Circuit Simulator</h1>
        </div>
        <div className="flex items-center space-x-2">
          <button 
            onClick={generateNetlist}
            className="flex items-center px-4 py-2 rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200"
          >
            <FileText className="w-4 h-4 mr-2" />
            SPICE Netlist
          </button>
          <button 
            onClick={runSimulation}
            className={`flex items-center px-4 py-2 rounded-md ${isSimulating ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}
          >
            {isSimulating ? <Square className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            {isSimulating ? 'Stop' : 'Simulate'}
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex flex-1 relative w-full h-full">
        {/* Left Sidebar - Components */}
        <div className="w-16 bg-white border-r flex flex-col items-center py-4 space-y-4 z-10 h-full">
          <button onClick={() => setSelectedTool('Select')} className={`p-2 rounded-lg ${selectedTool === 'Select' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`} title="Select/Move">
            <Move className="w-6 h-6" />
          </button>
          <div className="w-8 h-px bg-gray-200 my-2"></div>
          <button onClick={() => setSelectedTool('Wire')} className={`p-2 rounded-lg ${selectedTool === 'Wire' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`} title="Wire">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4l16 16M4 20L20 4"/></svg>
          </button>
          <button onClick={() => setSelectedTool('Resistor')} className={`p-2 rounded-lg ${selectedTool === 'Resistor' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`} title="Resistor">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12h4l2-4 4 8 4-8 4 8 2-4h2"/></svg>
          </button>
          <button onClick={() => setSelectedTool('Capacitor')} className={`p-2 rounded-lg ${selectedTool === 'Capacitor' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`} title="Capacitor">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12h6M14 12h6M10 6v12M14 6v12"/></svg>
          </button>
          <button onClick={() => setSelectedTool('Inductor')} className={`p-2 rounded-lg ${selectedTool === 'Inductor' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`} title="Inductor">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12h4c1.5 0 2.5-1.5 2.5-3s-1-3-2.5-3-2.5 1.5-2.5 3 1 3 2.5 3c1.5 0 2.5-1.5 2.5-3s-1-3-2.5-3-2.5 1.5-2.5 3 1 3 2.5 3h4"/></svg>
          </button>
          <button onClick={() => setSelectedTool('Diode')} className={`p-2 rounded-lg ${selectedTool === 'Diode' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`} title="Diode">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12h6M14 12h6M10 6v12l4-6-4-6z"/></svg>
          </button>
          <button onClick={() => setSelectedTool('VoltageSource')} className={`p-2 rounded-lg ${selectedTool === 'VoltageSource' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`} title="Voltage Source">
            <Circle className="w-6 h-6" />
          </button>
          <button onClick={() => setSelectedTool('CurrentSource')} className={`p-2 rounded-lg ${selectedTool === 'CurrentSource' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`} title="Current Source">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M9 11l3-3 3 3"/></svg>
          </button>
          <button onClick={() => setSelectedTool('Ground')} className={`p-2 rounded-lg ${selectedTool === 'Ground' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`} title="Ground">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v10M6 12h12M8 16h8M10 20h4"/></svg>
          </button>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 relative bg-[#f8f9fa] overflow-hidden h-full" id="canvas-container">
          <Stage
            width={stageSize.width - 64}
            height={stageSize.height - 56}
            scaleX={scale}
            scaleY={scale}
            x={position.x}
            y={position.y}
            draggable={selectedTool === 'Select' && !wiringStartPin}
            onDragEnd={(e) => {
              if (e.target === e.target.getStage()) {
                setPosition({ x: e.target.x(), y: e.target.y() });
              }
            }}
            onClick={handleStageClick}
            onMouseMove={(e) => {
              const stage = e.target.getStage();
              if (stage) {
                const pointer = stage.getPointerPosition();
                if (pointer) {
                  setMousePos({
                    x: (pointer.x - position.x) / scale,
                    y: (pointer.y - position.y) / scale
                  });
                }
              }
            }}
            onWheel={(e) => {
              e.evt.preventDefault();
              const scaleBy = 1.1;
              const stage = e.target.getStage();
              if(!stage) return;
              const oldScale = stage.scaleX();
              const pointer = stage.getPointerPosition();
              if(!pointer) return;

              const mousePointTo = {
                x: (pointer.x - stage.x()) / oldScale,
                y: (pointer.y - stage.y()) / oldScale,
              };

              const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
              setScale(newScale);
              setPosition({
                x: pointer.x - mousePointTo.x * newScale,
                y: pointer.y - mousePointTo.y * newScale,
              });
            }}
          >
            <Layer>
              {drawGrid()}
              
              {/* Draw Wires */}
              {wires.map((wire) => {
                // Update wire positions dynamically based on component positions
                let startPos = {x: 0, y: 0};
                let endPos = {x: 0, y: 0};
                
                components.forEach(c => {
                  c.pins.forEach(p => {
                    if (p.id === wire.startPinId) startPos = getAbsolutePinPos(c, p);
                    if (p.id === wire.endPinId) endPos = getAbsolutePinPos(c, p);
                  });
                });

                return (
                  <Line
                    key={wire.id}
                    points={[startPos.x, startPos.y, endPos.x, endPos.y]}
                    stroke={selectedWireId === wire.id ? "#ef4444" : "#3b82f6"}
                    strokeWidth={selectedWireId === wire.id ? 3 : 2}
                    lineCap="round"
                    lineJoin="round"
                    hitStrokeWidth={10}
                    onClick={(e) => {
                      if (selectedTool === 'Select') {
                        e.cancelBubble = true;
                        setSelectedWireId(wire.id);
                        setSelectedComponentId(null);
                      }
                    }}
                    onMouseEnter={(e) => {
                      if (selectedTool === 'Select') {
                        const container = e.target.getStage()?.container();
                        if(container) container.style.cursor = 'pointer';
                      }
                    }}
                    onMouseLeave={(e) => {
                      const container = e.target.getStage()?.container();
                      if(container) container.style.cursor = 'default';
                    }}
                  />
                );
              })}

              {/* Draw Active Wire */}
              {wiringStartPin && (
                <Line
                  points={[wiringStartPin.x, wiringStartPin.y, mousePos.x, mousePos.y]}
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dash={[5, 5]}
                />
              )}

              {/* Draw Components */}
              {components.map((comp) => (
                <Group
                  key={comp.id}
                  x={comp.position.x}
                  y={comp.position.y}
                  rotation={comp.rotation}
                  draggable={selectedTool === 'Select'}
                  onClick={(e) => {
                    if (selectedTool === 'Select') {
                      e.cancelBubble = true;
                      setSelectedComponentId(comp.id);
                      setSelectedWireId(null);
                    }
                  }}
                  onDragStart={(e) => {
                    if (selectedTool === 'Select') {
                      setSelectedComponentId(comp.id);
                      setSelectedWireId(null);
                    }
                  }}
                  onDragEnd={(e) => {
                    const newComps = components.map(c => {
                      if (c.id === comp.id) {
                        const newX = Math.round(e.target.x() / GRID_SIZE) * GRID_SIZE;
                        const newY = Math.round(e.target.y() / GRID_SIZE) * GRID_SIZE;
                        e.target.position({x: newX, y: newY});
                        return { ...c, position: { x: newX, y: newY } };
                      }
                      return c;
                    });
                    setComponents(newComps);
                  }}
                  onDblClick={() => rotateComponent(comp.id)}
                >
                  {/* Highlight box if selected */}
                  {selectedComponentId === comp.id && (
                    <Rect x={-25} y={-25} width={50} height={50} stroke="#ef4444" strokeWidth={1} dash={[4, 4]} />
                  )}
                  {renderComponentSymbol(comp)}
                  
                  {/* Draw Pins */}
                  {comp.pins.map((pin) => {
                    const absPos = getAbsolutePinPos(comp, pin);
                    return (
                      <Circle
                        key={pin.id}
                        x={pin.x}
                        y={pin.y}
                        radius={6}
                        fill={wiringStartPin?.pinId === pin.id ? "#3b82f6" : "transparent"}
                        stroke={selectedTool === 'Wire' ? "red" : "transparent"}
                        strokeWidth={1}
                        onClick={(e) => handlePinClick(e, comp.id, pin, absPos.x, absPos.y)}
                        onMouseEnter={(e) => {
                          const container = e.target.getStage()?.container();
                          if(container) container.style.cursor = 'crosshair';
                          e.target.fill('#3b82f6');
                        }}
                        onMouseLeave={(e) => {
                          const container = e.target.getStage()?.container();
                          if(container) container.style.cursor = 'default';
                          if (wiringStartPin?.pinId !== pin.id) {
                            e.target.fill('transparent');
                          }
                        }}
                      />
                    );
                  })}
                </Group>
              ))}
            </Layer>
          </Stage>

          {/* Zoom Controls */}
          <div className="absolute bottom-6 right-6 flex flex-col bg-white rounded-lg shadow-md border">
            <button onClick={() => setScale(s => s * 1.2)} className="p-2 hover:bg-gray-100 border-b text-gray-600">
              <ZoomIn className="w-5 h-5" />
            </button>
            <button onClick={() => setScale(s => s / 1.2)} className="p-2 hover:bg-gray-100 text-gray-600">
              <ZoomOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Right Sidebar - Properties */}
        {(selectedComponentId || selectedWireId) && (
          <div className="w-64 bg-white border-l flex flex-col p-4 z-10 h-full shadow-lg overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4 text-gray-800">Properties</h2>
            
            {selectedComponentId && (() => {
              const comp = components.find(c => c.id === selectedComponentId);
              if (!comp) return null;
              return (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Type</label>
                    <div className="mt-1 text-sm font-medium text-gray-900">{comp.type}</div>
                  </div>
                  
                  {comp.type !== 'Ground' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Value</label>
                      <input 
                        type="text" 
                        value={comp.value}
                        onChange={(e) => {
                          setComponents(components.map(c => c.id === comp.id ? { ...c, value: e.target.value } : c));
                        }}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                        placeholder={getDefaultValue(comp.type)}
                      />
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Rotation</label>
                    <div className="mt-1 flex items-center space-x-2">
                      <span className="text-sm w-12">{comp.rotation}°</span>
                      <button onClick={() => rotateComponent(comp.id)} className="p-1.5 bg-gray-100 rounded hover:bg-gray-200 text-gray-700">
                        <RotateCw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="pt-6 border-t mt-6">
                    <button 
                      onClick={() => {
                        setComponents(components.filter(c => c.id !== comp.id));
                        setWires(wires.filter(w => !comp.pins.find(p => p.id === w.startPinId || p.id === w.endPinId)));
                        setSelectedComponentId(null);
                      }}
                      className="w-full flex justify-center items-center px-4 py-2 bg-red-50 text-red-600 rounded-md hover:bg-red-100 text-sm font-medium transition-colors"
                    >
                      Delete Component
                    </button>
                  </div>
                </div>
              );
            })()}

            {selectedWireId && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500">Type</label>
                  <div className="mt-1 text-sm font-medium text-gray-900">Wire Connection</div>
                </div>
                <div className="pt-6 border-t mt-6">
                  <button 
                    onClick={() => {
                      setWires(wires.filter(w => w.id !== selectedWireId));
                      setSelectedWireId(null);
                    }}
                    className="w-full flex justify-center items-center px-4 py-2 bg-red-50 text-red-600 rounded-md hover:bg-red-100 text-sm font-medium transition-colors"
                  >
                    Delete Wire
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Netlist & Simulation Modal */}
      {showNetlist && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex space-x-4">
                <button 
                  onClick={() => setActiveTab('netlist')}
                  className={`text-lg font-semibold ${activeTab === 'netlist' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  SPICE Netlist
                </button>
                <button 
                  onClick={() => setActiveTab('result')}
                  className={`text-lg font-semibold ${activeTab === 'result' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Simulation Result
                </button>
              </div>
              <button onClick={() => setShowNetlist(false)} className="text-gray-500 hover:text-gray-700">
                <Square className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-auto">
              {activeTab === 'netlist' ? (
                <pre className="bg-gray-50 p-4 rounded border font-mono text-sm whitespace-pre-wrap">
                  {netlist}
                </pre>
              ) : (
                <pre className="bg-gray-900 text-green-400 p-4 rounded border font-mono text-sm whitespace-pre-wrap min-h-[200px]">
                  {simResult || 'No results yet.'}
                </pre>
              )}
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-end">
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(activeTab === 'netlist' ? netlist : simResult);
                  alert('Copied to clipboard!');
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Copy to Clipboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
