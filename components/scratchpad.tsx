"use client";

import {
  Check,
  Eraser,
  Pencil,
  Redo2,
  RotateCcw,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import {
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type DrawingTool = "pen" | "eraser";
type Point = { x: number; y: number };
type Stroke = {
  tool: DrawingTool;
  color: string;
  width: number;
  points: Point[];
};

type ScratchpadProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (imageDataUrl: string) => void;
};

const COLORS = ["#172033", "#2764d8", "#d94b4b"];
const WIDTHS = [3, 5, 8];

const drawStroke = (context: CanvasRenderingContext2D, stroke: Stroke) => {
  if (stroke.points.length === 0) return;

  context.save();
  context.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
  context.strokeStyle = stroke.color;
  context.fillStyle = stroke.color;
  context.lineWidth = stroke.tool === "eraser" ? stroke.width * 4 : stroke.width;
  context.lineCap = "round";
  context.lineJoin = "round";

  if (stroke.points.length === 1) {
    const [point] = stroke.points;
    context.beginPath();
    context.arc(point.x, point.y, context.lineWidth / 2, 0, Math.PI * 2);
    context.fill();
  } else {
    context.beginPath();
    context.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let index = 1; index < stroke.points.length - 1; index += 1) {
      const current = stroke.points[index];
      const next = stroke.points[index + 1];
      context.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
    }
    const last = stroke.points[stroke.points.length - 1];
    context.lineTo(last.x, last.y);
    context.stroke();
  }
  context.restore();
};

const renderStrokes = (canvas: HTMLCanvasElement, strokes: Stroke[]) => {
  const context = canvas.getContext("2d");
  if (!context) return;
  const ratio = window.devicePixelRatio || 1;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  strokes.forEach((stroke) => drawStroke(context, stroke));
};

export default function Scratchpad({ open, onClose, onSubmit }: ScratchpadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activePointerRef = useRef<number | null>(null);
  const activeStrokeRef = useRef<Stroke | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const [history, setHistory] = useState<Stroke[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [tool, setTool] = useState<DrawingTool>("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(WIDTHS[0]);
  const strokes = history[historyIndex] ?? [];

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) renderStrokes(canvas, strokesRef.current);
  }, []);

  useEffect(() => {
    strokesRef.current = strokes;
    redraw();
  }, [redraw, strokes]);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const bounds = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      const nextWidth = Math.max(1, Math.round(bounds.width * ratio));
      const nextHeight = Math.max(1, Math.round(bounds.height * ratio));
      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
      }
      redraw();
    };

    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(canvas);
    resizeCanvas();
    return () => observer.disconnect();
  }, [open, redraw]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  const commitStrokes = (nextStrokes: Stroke[]) => {
    const nextHistory = [...history.slice(0, historyIndex + 1), nextStrokes];
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
  };

  const pointFromEvent = (event: ReactPointerEvent<HTMLCanvasElement>): Point => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (activePointerRef.current !== null || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointerRef.current = event.pointerId;
    activeStrokeRef.current = {
      tool,
      color,
      width,
      points: [pointFromEvent(event)],
    };
    redraw();
    const context = event.currentTarget.getContext("2d");
    if (context) drawStroke(context, activeStrokeRef.current);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (activePointerRef.current !== event.pointerId || !activeStrokeRef.current) return;
    event.preventDefault();
    activeStrokeRef.current.points.push(pointFromEvent(event));
    redraw();
    const context = event.currentTarget.getContext("2d");
    if (context) drawStroke(context, activeStrokeRef.current);
  };

  const finishStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (activePointerRef.current !== event.pointerId || !activeStrokeRef.current) return;
    const completed = activeStrokeRef.current;
    activePointerRef.current = null;
    activeStrokeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    commitStrokes([...strokes, completed]);
  };

  const exportDrawing = () => {
    const canvas = canvasRef.current;
    if (!canvas || strokes.length === 0) return;
    const output = document.createElement("canvas");
    output.width = canvas.width;
    output.height = canvas.height;
    const context = output.getContext("2d");
    if (!context) return;

    const ratio = window.devicePixelRatio || 1;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, output.width, output.height);
    context.save();
    context.scale(ratio, ratio);
    context.strokeStyle = "#e8edf5";
    context.lineWidth = 1;
    for (let y = 32; y < output.height / ratio; y += 32) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(output.width / ratio, y);
      context.stroke();
    }
    context.restore();

    const ink = document.createElement("canvas");
    ink.width = canvas.width;
    ink.height = canvas.height;
    renderStrokes(ink, strokes);
    context.drawImage(ink, 0, 0);
    onSubmit(output.toDataURL("image/jpeg", 0.92));
  };

  if (!open) return null;

  return (
    <div className="scratchpad-overlay" role="dialog" aria-modal="true" aria-labelledby="scratchpad-title">
      <section className="scratchpad-dialog">
        <header className="scratchpad-header">
          <div>
            <span><Pencil size={17} /> 직접 풀이</span>
            <h2 id="scratchpad-title">화면에 풀어보세요</h2>
          </div>
          <button className="scratchpad-close" type="button" onClick={onClose} aria-label="풀이판 닫기"><X size={22} /></button>
        </header>

        <div className="scratchpad-toolbar" aria-label="풀이판 도구">
          <div className="scratchpad-tool-group">
            <button type="button" className={tool === "pen" ? "active" : ""} aria-pressed={tool === "pen"} onClick={() => setTool("pen")}><Pencil size={18} /> 펜</button>
            <button type="button" className={tool === "eraser" ? "active" : ""} aria-pressed={tool === "eraser"} onClick={() => setTool("eraser")}><Eraser size={18} /> 지우개</button>
          </div>
          <div className="scratchpad-colors" aria-label="펜 색상">
            {COLORS.map((item) => (
              <button
                key={item}
                type="button"
                className={color === item ? "selected" : ""}
                style={{ "--pen-color": item } as React.CSSProperties}
                onClick={() => { setColor(item); setTool("pen"); }}
                aria-label={`${item === COLORS[0] ? "검정" : item === COLORS[1] ? "파랑" : "빨강"} 펜`}
                aria-pressed={color === item && tool === "pen"}
              >{color === item && tool === "pen" ? <Check size={13} /> : null}</button>
            ))}
          </div>
          <div className="scratchpad-widths" aria-label="펜 굵기">
            {WIDTHS.map((item) => (
              <button key={item} type="button" className={width === item ? "selected" : ""} onClick={() => setWidth(item)} aria-label={`굵기 ${item}`} aria-pressed={width === item}>
                <span style={{ width: item + 4, height: item + 4 }} />
              </button>
            ))}
          </div>
          <div className="scratchpad-history-tools">
            <button type="button" onClick={() => setHistoryIndex((current) => Math.max(0, current - 1))} disabled={historyIndex === 0} aria-label="실행 취소"><Undo2 size={19} /></button>
            <button type="button" onClick={() => setHistoryIndex((current) => Math.min(history.length - 1, current + 1))} disabled={historyIndex === history.length - 1} aria-label="다시 실행"><Redo2 size={19} /></button>
            <button type="button" onClick={() => commitStrokes([])} disabled={strokes.length === 0} aria-label="전체 지우기"><Trash2 size={19} /></button>
          </div>
        </div>

        <div className="scratchpad-canvas-wrap">
          <canvas
            ref={canvasRef}
            aria-label="수학 풀이를 쓰는 공간"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishStroke}
            onPointerCancel={finishStroke}
          />
          {strokes.length === 0 && <div className="scratchpad-hint" aria-hidden="true"><RotateCcw size={17} /><span>펜·손가락·마우스로 여기에 풀이를 써보세요</span></div>}
        </div>

        <footer className="scratchpad-footer">
          <span>풀이 이미지는 질문할 때만 AI에 전송돼요.</span>
          <div>
            <button type="button" className="scratchpad-cancel" onClick={onClose}>취소</button>
            <button type="button" className="scratchpad-submit" onClick={exportDrawing} disabled={strokes.length === 0}>AI에게 풀이 물어보기</button>
          </div>
        </footer>
      </section>
    </div>
  );
}
