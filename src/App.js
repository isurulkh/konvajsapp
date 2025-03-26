import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Stage, Layer, Line, Circle, Text, Group } from 'react-konva';
import Konva from 'konva';
import './App.css';
import './fontawesome.css';

const CLOSE_TOLERANCE = 15;
const MIN_POINT_DISTANCE = 10;
const GRID_SIZE = 20;
const POINT_RADIUS = 5;
const HOVER_POINT_RADIUS = 7;
const DEFAULT_COLOR = '#3b82f6'; // Blue-600
const HOVER_COLOR = '#ef4444';   // Red-500

// --- Helper Function ---
// Now accepts a dpi parameter so that we convert pixel distances to inches,
// then multiply by the scale (which represents "real-world units per inch").
const calculatePolygonMetrics = (points, scale, dpi) => {
  if (points.length < 3) {
    return { width: 0, height: 0, area: 0, perimeter: 0 };
  }
  const xValues = points.map(p => p.x);
  const yValues = points.map(p => p.y);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);

  let areaCalc = 0;
  let perimeterCalc = 0;
  const uniquePoints =
    points[0] === points[points.length - 1] && points.length > 1
      ? points.slice(0, -1)
      : points;

  for (let i = 0; i < uniquePoints.length; i++) {
    const p1 = uniquePoints[i];
    const p2 = uniquePoints[(i + 1) % uniquePoints.length];
    areaCalc += p1.x * p2.y - p2.x * p1.y;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    perimeterCalc += Math.sqrt(dx * dx + dy * dy);
  }
  areaCalc = Math.abs(areaCalc) / 2;

  // Convert pixel measurements to inches using dpi, then multiply by scale.
  return {
    width: ((maxX - minX) / dpi) * scale,
    height: ((maxY - minY) / dpi) * scale,
    area: ((areaCalc / (dpi * dpi)) * (scale * scale)),
    perimeter: (perimeterCalc / dpi) * scale,
  };
};

const App = () => {
  // --- State ---
  const [points, setPoints] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  // "scale" now represents real-world units per inch.
  const [scale, setScale] = useState(10);
  // New DPI state (dots per inch)
  const [dpi, setDpi] = useState(96);
  const [metrics, setMetrics] = useState({ width: 0, height: 0, area: 0, perimeter: 0 });
  const [polygonColor, setPolygonColor] = useState(DEFAULT_COLOR);
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [showDimensions, setShowDimensions] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [hoveredPointIndex, setHoveredPointIndex] = useState(null);
  const [selectedPointIndex, setSelectedPointIndex] = useState(null);
  const [isDraggingStage, setIsDraggingStage] = useState(false);
  const [tempLineEnd, setTempLineEnd] = useState(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 550 });

  // --- Refs ---
  const stageRef = useRef(null);
  const containerRef = useRef(null);
  const stageContainerRef = useRef(null);
  const fileInputRef = useRef(null);

  // --- Effects ---
  useEffect(() => {
    const handleResize = () => {
      if (stageContainerRef.current) {
        setStageSize({
          width: stageContainerRef.current.offsetWidth,
          height: 550,
        });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const pointsToCalc =
      !isDrawing && points.length > 2 && points[0] !== points[points.length - 1]
        ? [...points, points[0]]
        : points;
    setMetrics(calculatePolygonMetrics(pointsToCalc, scale, dpi));
  }, [points, scale, dpi, isDrawing]);

  useEffect(() => {
    let newCursor = 'default';
    if (isDrawing) {
      newCursor = 'crosshair';
      const stage = stageRef.current;
      const pointerPos = stage?.getPointerPosition();
      if (pointerPos && points.length >= 3) {
        const distToFirst = distance(pointerPos, points[0]);
        if (distToFirst < CLOSE_TOLERANCE * 1.5) {
          newCursor = 'pointer';
        }
      }
    } else if (hoveredPointIndex !== null) {
      newCursor = 'grab';
    } else if (isDraggingStage) {
      newCursor = 'grabbing';
    } else if (points.length > 0 && hoveredPointIndex === null) {
      newCursor = 'grab';
    }
    const stageContainer = stageContainerRef.current;
    if (stageContainer && stageContainer.style.cursor !== newCursor) {
      stageContainer.style.cursor = newCursor;
    }
    if (isDraggingStage) {
      document.body.style.cursor = 'grabbing';
    } else {
      if (document.body.style.cursor === 'grabbing') {
        document.body.style.cursor = 'default';
      }
    }
  }, [isDrawing, isDraggingStage, hoveredPointIndex, points]);

  // --- Helper Functions ---
  const snapToGrid = useCallback((pos) => {
    if (!pos) return { x: 0, y: 0 };
    const stage = stageRef.current;
    if (!stage) return pos;
    const point = {
      x: (pos.x - stage.x()) / stage.scaleX(),
      y: (pos.y - stage.y()) / stage.scaleY(),
    };
    const snapped = {
      x: Math.round(point.x / GRID_SIZE) * GRID_SIZE,
      y: Math.round(point.y / GRID_SIZE) * GRID_SIZE,
    };
    return {
      x: snapped.x * stage.scaleX() + stage.x(),
      y: snapped.y * stage.scaleY() + stage.y(),
    };
  }, []);

  const distance = (p1, p2) => {
    if (!p1 || !p2) return Infinity;
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const buildLinesFromPoints = useCallback((currentPoints, drawingActive) => {
    if (currentPoints.length < 2) return [];
    const linesArr = [];
    const numSegments = drawingActive ? currentPoints.length - 1 : currentPoints.length;
    for (let i = 0; i < numSegments; i++) {
      const p1 = currentPoints[i];
      let p2;
      if (i === currentPoints.length - 1) {
        if (!drawingActive && currentPoints.length > 2) {
          p2 = currentPoints[0];
        } else {
          continue;
        }
      } else {
        p2 = currentPoints[i + 1];
      }
      if (p1 !== p2) {
        linesArr.push({ start: p1, end: p2 });
      }
    }
    return linesArr;
  }, []);

  const closePolygon = useCallback(() => {
    if (points.length < 3) return;
    setPoints(prevPoints => {
      if (distance(prevPoints[0], prevPoints[prevPoints.length - 1]) > 1) {
        return [...prevPoints, prevPoints[0]];
      }
      return prevPoints;
    });
    setIsDrawing(false);
    setTempLineEnd(null);
    setSelectedPointIndex(null);
  }, [points]);

  const deletePoint = useCallback(
    (indexToDelete) => {
      if (isDrawing || indexToDelete === null) return;
      const uniquePointsCheck =
        points[0] === points[points.length - 1] && points.length > 1
          ? points.slice(0, -1)
          : points;
      if (uniquePointsCheck.length <= 3) {
        alert('Cannot delete point, polygon must have at least 3 unique points.');
        return;
      }
      setPoints(prevPoints => {
        const wasClosed = prevPoints.length > 1 && prevPoints[0] === prevPoints[prevPoints.length - 1];
        const filteredPoints = prevPoints.filter((_, i) => i !== indexToDelete);
        if (wasClosed && filteredPoints.length >= 3) {
          if (filteredPoints[filteredPoints.length - 1] !== filteredPoints[0]) {
            if (indexToDelete === 0) {
              return [...filteredPoints.slice(0, -1), filteredPoints[0]];
            } else {
              return [...filteredPoints, filteredPoints[0]];
            }
          } else {
            return filteredPoints;
          }
        } else {
          return filteredPoints;
        }
      });
      setSelectedPointIndex(null);
      setHoveredPointIndex(null);
    },
    [isDrawing, points]
  );

  const resetDrawing = useCallback(() => {
    setPoints([]);
    setIsDrawing(false);
    setMetrics({ width: 0, height: 0, area: 0, perimeter: 0 });
    const stage = stageRef.current;
    if (stage) {
      stage.position({ x: 0, y: 0 });
      stage.scale({ x: 1, y: 1 });
    }
    setZoom(1);
    setStagePos({ x: 0, y: 0 });
    setHoveredPointIndex(null);
    setSelectedPointIndex(null);
    setTempLineEnd(null);
  }, []);

  // --- New: Save and Load Functionality ---
  const saveSketch = () => {
    const data = {
      points,
      polygonColor,
      scale,
      dpi,
      strokeWidth,
      showDimensions,
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sketch.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadSketch = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        setPoints(data.points || []);
        setPolygonColor(data.polygonColor || DEFAULT_COLOR);
        setScale(data.scale || 10);
        setDpi(data.dpi || 96);
        setStrokeWidth(data.strokeWidth || 2);
        setShowDimensions(data.showDimensions !== undefined ? data.showDimensions : true);
        setIsDrawing(false);
      } catch (err) {
        alert('Error loading sketch file');
      }
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        selectedPointIndex !== null &&
        !isDrawing
      ) {
        if (
          document.activeElement.tagName === 'INPUT' ||
          document.activeElement.tagName === 'TEXTAREA'
        )
          return;
        e.preventDefault();
        deletePoint(selectedPointIndex);
      }
      if (e.key === 'Escape') {
        if (isDrawing) resetDrawing();
        else if (selectedPointIndex !== null) setSelectedPointIndex(null);
      }
    };
    const container = containerRef.current;
    if (container) {
      container.setAttribute('tabindex', '-1');
      container.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      if (container) container.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedPointIndex, isDrawing, deletePoint, resetDrawing]);

  // --- Event Handlers ---
  const getPointerPos = () => {
    const stage = stageRef.current;
    return stage?.getPointerPosition();
  };

  const handleMouseDown = (e) => {
    if (e.target !== stageRef.current) return;
    if (isDrawing) {
      const pointerPos = getPointerPos();
      if (!pointerPos) return;
      const snappedPos = snapToGrid(pointerPos);
      if (points.length >= 3) {
        const distToFirst = distance(snappedPos, points[0]);
        if (distToFirst < CLOSE_TOLERANCE) {
          closePolygon();
          return;
        }
      }
      if (points.length > 0) {
        const distToLast = distance(snappedPos, points[points.length - 1]);
        if (distToLast < MIN_POINT_DISTANCE) return;
      }
      setPoints(prev => [...prev, snappedPos]);
    } else {
      setSelectedPointIndex(null);
    }
  };

  const handleMouseMove = (e) => {
    if (!isDrawing || points.length === 0) return;
    const pointerPos = getPointerPos();
    if (!pointerPos) return;
    const snappedPos = snapToGrid(pointerPos);
    setTempLineEnd(snappedPos);
  };

  const startDrawing = () => {
    resetDrawing();
    setIsDrawing(true);
    containerRef.current?.focus();
  };

  const finishDrawing = () => {
    if (points.length < 3) {
      alert('Please draw at least a triangle (3 unique points).');
      return;
    }
    closePolygon();
  };

  const handleZoom = (e) => {
    e.evt.preventDefault();
    if (isDrawing) return;
    const scaleBy = 1.1;
    const stage = stageRef.current;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };
    const direction = e.evt.deltaY < 0 ? 1 : -1;
    const newScale = Math.max(0.1, Math.min(10, oldScale * (direction > 0 ? scaleBy : 1 / scaleBy)));
    stage.scale({ x: newScale, y: newScale });
    setZoom(newScale);
    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    stage.position(newPos);
    setStagePos(newPos);
  };

  const handleStageDragStart = (e) => {
    if (e.target.getClassName() !== 'Stage') return;
    if (!isDrawing) setIsDraggingStage(true);
  };

  const handleStageDragEnd = () => {
    if (isDraggingStage) {
      setIsDraggingStage(false);
      setStagePos(stageRef.current.position());
    }
  };

  const handlePointDragMove = (e, index) => {
    if (isDrawing) return;
    const pointerPos = { x: e.target.x(), y: e.target.y() };
    const snappedAbsPos = snapToGrid(pointerPos);
    e.target.position(snappedAbsPos);
    setPoints(prevPoints => {
      const newPoints = [...prevPoints];
      newPoints[index] = snappedAbsPos;
      const isClosed =
        !isDrawing &&
        newPoints.length > 1 &&
        distance(newPoints[0], newPoints[newPoints.length - 1]) < 1;
      if (isClosed && index === 0) {
        newPoints[newPoints.length - 1] = snappedAbsPos;
      }
      return newPoints;
    });
  };

  const handlePointDragStart = (e, index) => {
    if (!isDrawing) {
      setIsDraggingStage(false);
      e.target.moveToTop();
      setSelectedPointIndex(index);
    }
  };

  const handlePointDragEnd = (e, index) => {
    if (!isDrawing) containerRef.current?.focus();
  };

  const handlePointMouseEnter = (index) => {
    if (!isDrawing) setHoveredPointIndex(index);
  };

  const handlePointMouseLeave = () => {
    if (!isDrawing) setHoveredPointIndex(null);
  };

  const handlePointClick = (e, index) => {
    if (!isDrawing) {
      setSelectedPointIndex(index);
      e.evt.stopPropagation();
      containerRef.current?.focus();
    }
  };

  // --- Derived State for Rendering ---
  const renderablePoints = points;
  const renderableLines = buildLinesFromPoints(points, isDrawing);
  const isPolygonEffectivelyClosed = !isDrawing && points.length >= 3;
  const uniquePointCount =
    points.length > 0 && distance(points[0], points[points.length - 1]) < 1
      ? points.length - 1
      : points.length;

  return (
    <div ref={containerRef} className="polygon-container" tabIndex={-1} style={{ outline: 'none' }}>
      {/* Header */}
      <header className="app-header">
        <h1>Polygon Drawing & Measurement Tool</h1>
        <p>
          Click "Start Drawing" then click on the canvas to place points. Click near the start point or "Complete" to finish.
          Drag points or the canvas when not drawing. Select a point and press "Delete" to remove it.
        </p>
      </header>

      {/* Controls Toolbar */}
      <div className="toolbar">
        <div className="toolbar-section">
          <button
            className={`button button-primary ${isDrawing ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={startDrawing}
            disabled={isDrawing}
            title="Start drawing a new polygon"
          >
            <i className="fas fa-pencil-alt fa-fw"></i> Start Drawing
          </button>
          <button
            className={`button button-success ${(!isDrawing || uniquePointCount < 3) ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={finishDrawing}
            disabled={!isDrawing || uniquePointCount < 3}
            title="Complete the current polygon"
          >
            <i className="fas fa-check-circle fa-fw"></i> Complete
          </button>
          <button className="button button-danger" onClick={resetDrawing} title="Clear the canvas and reset view">
            <i className="fas fa-trash-alt fa-fw"></i> Reset
          </button>
        </div>

        <div className="divider"></div>

        {/* Save/Load controls */}
        <div className="toolbar-section">
          <button className="button" onClick={saveSketch} title="Save your current sketch">
            <i className="fas fa-save fa-fw"></i> Save Sketch
          </button>
          <button
            className="button"
            onClick={() => fileInputRef.current?.click()}
            title="Load a saved sketch"
          >
            <i className="fas fa-folder-open fa-fw"></i> Load Sketch
          </button>
          <input
            type="file"
            accept="application/json"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={loadSketch}
          />
        </div>

        <div className="divider"></div>

        <div className="toolbar-section">
          <div className="control-group" title={`Set scale (units/inch): ${scale}`}>
            <label htmlFor="scale">
              <i className="fas fa-ruler fa-fw"></i> Scale:
            </label>
            <input
              id="scale"
              type="number"
              min="0.1"
              step="0.1"
              value={scale}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val > 0) setScale(val);
              }}
              disabled={isDrawing}
            />
          </div>
          <div className="control-group" title="Set DPI (dots per inch)">
            <label htmlFor="dpi">
              <i className="fas fa-tachometer-alt fa-fw"></i> DPI:
            </label>
            <input
              id="dpi"
              type="number"
              min="1"
              step="1"
              value={dpi}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val > 0) setDpi(val);
              }}
              disabled={isDrawing}
            />
          </div>
          <div className="control-group" title="Polygon color">
            <label htmlFor="polygonColor">
              <i className="fas fa-palette fa-fw"></i> Color:
            </label>
            <input
              id="polygonColor"
              type="color"
              value={polygonColor}
              onChange={(e) => setPolygonColor(e.target.value)}
              disabled={isDrawing}
            />
          </div>
          <div className="control-group" title={`Line thickness: ${strokeWidth}px`}>
            <label htmlFor="strokeWidth">
              <i className="fas fa-paint-brush fa-fw"></i> Width:
            </label>
            <input
              id="strokeWidth"
              type="range"
              min="1"
              max="10"
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
              disabled={isDrawing}
            />
            <span className="value-display">{strokeWidth}px</span>
          </div>
          <div className="control-group" title="Show/hide length labels on sides">
            <input
              id="showDimensions"
              type="checkbox"
              checked={showDimensions}
              onChange={() => setShowDimensions(!showDimensions)}
              disabled={isDrawing}
            />
            <label htmlFor="showDimensions" className="cursor-pointer">
              Show Dimensions
            </label>
          </div>
          <div className="control-group" title="Show/hide background grid">
            <input
              id="showGrid"
              type="checkbox"
              checked={showGrid}
              onChange={() => setShowGrid(!showGrid)}
            />
            <label htmlFor="showGrid" className="cursor-pointer">
              Show Grid
            </label>
          </div>
        </div>
      </div>

      {/* Stage Area */}
      <div ref={stageContainerRef} className="canvas-container konva-stage">
        <div className="status-indicator">
          {isDrawing ? (
            <>
              <span className="status-dot status-dot-blue status-dot-pulse"></span> Drawing...
            </>
          ) : uniquePointCount > 0 ? (
            <>
              <span className={`status-dot ${selectedPointIndex !== null ? 'status-dot-green' : 'status-dot-gray'}`}></span>
              {selectedPointIndex !== null ? `P${selectedPointIndex + 1} selected` : 'Edit Mode'}
            </>
          ) : (
            <>
              <span className="status-dot status-dot-gray"></span> Idle
            </>
          )}
        </div>
        <div className="zoom-controls">
          <button
            onClick={() => handleZoom({ evt: { preventDefault: () => {}, deltaY: 100 } })}
            disabled={isDrawing || zoom <= 0.1}
            title="Zoom Out"
          >
            <i className="fas fa-search-minus"></i>
          </button>
          <div className="zoom-display">{Math.round(zoom * 100)}%</div>
          <button
            onClick={() => handleZoom({ evt: { preventDefault: () => {}, deltaY: -100 } })}
            disabled={isDrawing || zoom >= 10}
            title="Zoom In"
          >
            <i className="fas fa-search-plus"></i>
          </button>
          <div className="zoom-divider"></div>
          <button
            onClick={() => {
              const stage = stageRef.current;
              if (stage) {
                stage.scale({ x: 1, y: 1 });
                stage.position({ x: 0, y: 0 });
                setZoom(1);
                setStagePos({ x: 0, y: 0 });
              }
            }}
            disabled={isDrawing}
            title="Reset View"
          >
            <i className="fas fa-expand"></i>
          </button>
        </div>

        <Stage
          width={stageSize.width}
          height={stageSize.height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onWheel={handleZoom}
          draggable={!isDrawing}
          onDragStart={handleStageDragStart}
          onDragEnd={handleStageDragEnd}
          ref={stageRef}
        >
          <Layer>
            {showGrid && (
              <>
                {Array.from({ length: 100 }).map((_, i) => {
                  const y = Math.round((i - 50) * GRID_SIZE * zoom + stagePos.y);
                  return (
                    <Line
                      key={`h-${i}`}
                      points={[-10000, y, 10000, y]}
                      stroke="#e0e0e0"
                      strokeWidth={0.5}
                      listening={false}
                    />
                  );
                })}
                {Array.from({ length: 100 }).map((_, i) => {
                  const x = Math.round((i - 50) * GRID_SIZE * zoom + stagePos.x);
                  return (
                    <Line
                      key={`v-${i}`}
                      points={[x, -10000, x, 10000]}
                      stroke="#e0e0e0"
                      strokeWidth={0.5}
                      listening={false}
                    />
                  );
                })}
              </>
            )}

            {isPolygonEffectivelyClosed && uniquePointCount > 2 && (
              <Line
                points={points.flatMap(p => [p.x, p.y])}
                closed={true}
                fill={`${polygonColor}4D`}
                listening={false}
              />
            )}

            {renderableLines.map((line, i) =>
              line?.start && line?.end ? (
                <Line
                  key={`line-${i}`}
                  points={[line.start.x, line.start.y, line.end.x, line.end.y]}
                  stroke={polygonColor}
                  strokeWidth={strokeWidth / zoom}
                  lineCap="round"
                  lineJoin="round"
                  listening={false}
                />
              ) : null
            )}

            {isDrawing && points.length > 0 && tempLineEnd && (
              <Line
                points={[
                  points[points.length - 1].x,
                  points[points.length - 1].y,
                  tempLineEnd.x,
                  tempLineEnd.y,
                ]}
                stroke={polygonColor}
                strokeWidth={strokeWidth / zoom}
                dash={[4 / zoom, 4 / zoom]}
                listening={false}
              />
            )}

            {isDrawing &&
              points.length >= 3 &&
              tempLineEnd &&
              distance(tempLineEnd, points[0]) < CLOSE_TOLERANCE && (
                <Line
                  points={[
                    points[points.length - 1].x,
                    points[points.length - 1].y,
                    points[0].x,
                    points[0].y,
                  ]}
                  stroke={HOVER_COLOR}
                  strokeWidth={strokeWidth / zoom}
                  dash={[4 / zoom, 4 / zoom]}
                  listening={false}
                />
              )}

            {renderablePoints.map((point, i) => {
              if (!isDrawing && points.length > 1 && point === points[0] && i === points.length - 1)
                return null;
              const isHovered = hoveredPointIndex === i;
              const isSelected = selectedPointIndex === i;
              const radius = Math.max(
                2.5,
                (isSelected ? HOVER_POINT_RADIUS + 1 : isHovered ? HOVER_POINT_RADIUS : POINT_RADIUS) / zoom
              );
              const fillColor = isSelected ? HOVER_COLOR : polygonColor;
              return (
                <Circle
                  key={`point-${i}`}
                  x={point.x}
                  y={point.y}
                  radius={radius}
                  fill={fillColor}
                  stroke={isSelected ? '#333' : 'white'}
                  strokeWidth={Math.max(0.5, (isSelected ? 1.5 : 1) / zoom)}
                  shadowColor="rgba(0,0,0,0.4)"
                  shadowBlur={Math.max(1, (isHovered || isSelected ? 8 : 3) / zoom)}
                  shadowOffsetY={Math.max(0.5, 1 / zoom)}
                  draggable={!isDrawing}
                  onDragStart={(e) => handlePointDragStart(e, i)}
                  onDragMove={(e) => handlePointDragMove(e, i)}
                  onDragEnd={(e) => handlePointDragEnd(e, i)}
                  onMouseEnter={() => handlePointMouseEnter(i)}
                  onMouseLeave={handlePointMouseLeave}
                  onClick={(e) => handlePointClick(e, i)}
                  hitStrokeWidth={Math.max(8, 12 / zoom)}
                />
              );
            })}

            {isDrawing && points.length >= 3 && (
              <Circle
                x={points[0].x}
                y={points[0].y}
                radius={CLOSE_TOLERANCE / zoom}
                stroke={DEFAULT_COLOR}
                strokeWidth={1 / zoom}
                dash={[3 / zoom, 3 / zoom]}
                opacity={0.6}
                listening={false}
              />
            )}

            {!isDrawing &&
              showDimensions &&
              uniquePointCount > 2 &&
              renderableLines.map((line, i) => {
                if (!line?.start || !line?.end) return null;
                const midX = (line.start.x + line.end.x) / 2;
                const midY = (line.start.y + line.end.y) / 2;
                const dx = line.end.x - line.start.x;
                const dy = line.end.y - line.start.y;
                const lengthPx = Math.sqrt(dx * dx + dy * dy);
                if (lengthPx < 1) return null;
                const lengthUnits = lengthPx / dpi * scale;
                const offset = 12 / zoom;
                const textOffset = offset + 6 / zoom;
                const norm = lengthPx;
                const nx = -dy / norm;
                const ny = dx / norm;
                const angleRad = Math.atan2(dy, dx);
                const angleDeg = (angleRad * 180) / Math.PI;
                const flip = Math.abs(angleDeg) > 90;
                return (
                  <Group key={`dim-${i}`} listening={false}>
                    <Text
                      x={midX + nx * textOffset}
                      y={midY + ny * textOffset}
                      text={lengthUnits.toFixed(1)}
                      fontSize={Math.max(6, 10 / zoom)}
                      fill="#374151"
                      align="center"
                      verticalAlign="middle"
                      rotation={flip ? angleDeg + 180 : angleDeg}
                      padding={Math.max(1, 2 / zoom)}
                      background="rgba(255,255,255,0.7)"
                      cornerRadius={Math.max(1, 2 / zoom)}
                    />
                  </Group>
                );
              })}
          </Layer>
        </Stage>
      </div>

      {/* Metrics Display */}
      <div className="info-panel">
        <h3>
          <i className="fas fa-ruler-combined"></i> Polygon Metrics
        </h3>
        {isPolygonEffectivelyClosed && uniquePointCount > 2 ? (
          <>
            <div className="info-grid">
              <div className="info-item">
                <strong>Points</strong>
                <div className="info-value">{uniquePointCount}</div>
              </div>
              <div className="info-item">
                <strong>Width</strong>
                <div className="info-value">
                  {metrics.width.toFixed(2)} <span className="unit">units</span>
                </div>
              </div>
              <div className="info-item">
                <strong>Height</strong>
                <div className="info-value">
                  {metrics.height.toFixed(2)} <span className="unit">units</span>
                </div>
              </div>
              <div className="info-item">
                <strong>Perimeter</strong>
                <div className="info-value">
                  {metrics.perimeter.toFixed(2)} <span className="unit">units</span>
                </div>
              </div>
              <div className="info-item">
                <strong>Area</strong>
                <div className="info-value">
                  {metrics.area.toFixed(2)} <span className="unit">sq. units</span>
                </div>
              </div>
            </div>
            <div className="coordinates-section">
              <h4>Point Coordinates (Scaled)</h4>
              <div className="coordinates-list">
                {points.map((point, i) => {
                  if (!isDrawing && points.length > 1 && point === points[0] && i === points.length - 1)
                    return null;
                  return (
                    <div key={`coord-${i}`} className={`coordinate-item ${selectedPointIndex === i ? 'coordinate-item-selected' : ''}`}>
                      <strong>P{i + 1}:</strong> ({(point.x / dpi * scale).toFixed(1)}, {(point.y / dpi * scale).toFixed(1)})
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div className="empty-metrics-placeholder">
            <i className="fas fa-draw-polygon"></i>
            <p>Draw a polygon (at least 3 points) to view metrics.</p>
          </div>
        )}
      </div>

      <footer className="app-footer">Polygon Tool - React & Konva</footer>
    </div>
  );
};

export default App;
