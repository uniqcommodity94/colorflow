import React, { useRef, useState, useEffect } from 'react';
import { HexColorPicker as ColorPicker } from 'react-colorful';
import jsPDF from 'jspdf';
import JSZip from 'jszip';

let saveAs;
try {
  saveAs = require('file-saver').saveAs;
} catch (e) {
  saveAs = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };
}

export default function App() {
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(10);
  const [brushType, setBrushType] = useState('crayon');
  const [isErasing, setIsErasing] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPos, setLastPos] = useState(null);
  const [pages, setPages] = useState([]);
  const [pageNames, setPageNames] = useState([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const resizeCanvas = () => {
      const canvasWidth = canvas.offsetWidth;
      const canvasHeight = canvas.offsetHeight;
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  useEffect(() => {
    const savedPages = JSON.parse(localStorage.getItem('savedPages') || '[]');
    const savedNames = JSON.parse(localStorage.getItem('pageNames') || '[]');
    if (savedPages.length > 0) {
      setPages(savedPages);
      setPageNames(savedNames);
      setCurrentPageIndex(0);
      drawImage(savedPages[0]);
      setHistory([savedPages[0]]);
    }
  }, []);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const canvasWidth = canvas.offsetWidth;
        const canvasHeight = canvas.offsetHeight;
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
        const x = (canvas.width - img.width * scale) / 2;
        const y = (canvas.height - img.height * scale) / 2;
        ctx.drawImage(img, 0, 0, img.width, img.height, x, y, img.width * scale, img.height * scale);
        const dataUrl = canvas.toDataURL();
        setHistory((prev) => [...prev, dataUrl]);
        const newPages = [...pages];
        newPages[currentPageIndex] = dataUrl;
        setPages(newPages);
        localStorage.setItem('savedPages', JSON.stringify(newPages));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const saveCurrentPage = () => {
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL();
    const newPages = [...pages];
    newPages[currentPageIndex] = dataUrl;
    setPages(newPages);
    setHistory((prev) => [...prev.slice(-19), dataUrl]);
    setRedoStack([]);
    localStorage.setItem('savedPages', JSON.stringify(newPages));
    localStorage.setItem('pageNames', JSON.stringify(pageNames));
  };

  const undo = () => {
    if (history.length < 2) return;
    const current = history[history.length - 1];
    const previous = history[history.length - 2];
    setHistory((prev) => prev.slice(0, prev.length - 1));
    setRedoStack((prev) => [current, ...prev]);
    drawImage(previous);
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setRedoStack((prev) => prev.slice(1));
    setHistory((prev) => [...prev, next]);
    drawImage(next);
  };

  const drawImage = (src) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      const canvasWidth = canvas.offsetWidth;
      const canvasHeight = canvas.offsetHeight;
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
      const x = (canvas.width - img.width * scale) / 2;
      const y = (canvas.height - img.height * scale) / 2;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, img.width, img.height, x, y, img.width * scale, img.height * scale);
    };
    img.src = src;
  };

  const getCanvasCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    let x, y;
    if (e.touches && e.touches.length > 0) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }
    return { x, y };
  };

  const drawLine = (start, end) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (brushType === 'crayon') {
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = brushSize;
    for (let i = 0; i < 5; i++) {
      const offsetX = (Math.random() - 0.5) * brushSize * 0.3;
      const offsetY = (Math.random() - 0.5) * brushSize * 0.3;
      ctx.beginPath();
      ctx.moveTo(start.x + offsetX, start.y + offsetY);
      ctx.lineTo(end.x + offsetX, end.y + offsetY);
      ctx.strokeStyle = isErasing ? '#FFFFFF' : color;
      ctx.stroke();
    }
    return;
    } else if (brushType === 'watercolor') {
    ctx.globalAlpha = 0.1;
    for (let i = 0; i < 6; i++) {
      ctx.lineWidth = brushSize * (1 + Math.random());
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.strokeStyle = isErasing ? '#FFFFFF' : color;
      ctx.stroke();
    }
    return;
    } else if (brushType === 'pencil') {
    ctx.setLineDash([0.5, 2]);
    ctx.lineWidth = brushSize * 0.5;
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = isErasing ? '#FFFFFF' : color;
    } else if (brushType === 'oil') {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      ctx.globalAlpha = 1.0;
      ctx.lineWidth = brushSize * 1.5;
      ctx.strokeStyle = isErasing ? '#FFFFFF' : color;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();

      const blend = (x, y) => {
        const idx = ((Math.floor(y) * canvas.width) + Math.floor(x)) * 4;
        if (idx < 0 || idx + 3 >= data.length) return;
        data[idx] = (data[idx] + parseInt(color.slice(1, 3), 16)) >> 1;
        data[idx + 1] = (data[idx + 1] + parseInt(color.slice(3, 5), 16)) >> 1;
        data[idx + 2] = (data[idx + 2] + parseInt(color.slice(5, 7), 16)) >> 1;
      };

      const steps = 5;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = start.x + (end.x - start.x) * t;
        const y = start.y + (end.y - start.y) * t;
        for (let j = -1; j <= 1; j++) {
          for (let k = -1; k <= 1; k++) {
            blend(x + j, y + k);
          }
        }
      }
      ctx.putImageData(imageData, 0, 0);
      return;
    } else {
      ctx.strokeStyle = isErasing ? '#FFFFFF' : color;
      ctx.globalAlpha = 1.0;
    }

    ctx.setLineDash([]);
    ctx.lineCap = 'round';
    ctx.lineWidth = brushSize;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  };

  const handleMouseDown = (e) => {
    setIsDrawing(true);
    const pos = getCanvasCoordinates(e);
    setLastPos(pos);
  };

  const handleMouseMove = (e) => {
    if (!isDrawing) return;
    const pos = getCanvasCoordinates(e);
    if (lastPos) {
      drawLine(lastPos, pos);
      setLastPos(pos);
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    setLastPos(null);
    saveCurrentPage();
  };

  const [darkMode, setDarkMode] = useState(false);
  const [showToolbar, setShowToolbar] = useState(true);

  return (
  <div className={`w-screen h-screen overflow-hidden font-sans transition-all duration-300 ease-in-out ${darkMode ? 'bg-gradient-to-br from-neutral-900 to-black text-white' : 'bg-gradient-to-br from-rose-100 via-lime-50 to-sky-100 text-gray-900'}`}>
    <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 w-[95%] max-w-6xl z-50 px-6 py-5 rounded-3xl border border-white/40 dark:border-gray-800 shadow-xl backdrop-blur-xl bg-white/70 dark:bg-gray-900/90 flex flex-wrap justify-between items-center gap-4 transition-all duration-500 ${showToolbar ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'}`}>
      <button onClick={() => setDarkMode(!darkMode)} className="px-4 py-1.5 text-sm font-medium rounded-lg bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:brightness-110 transition">
        Toggle {darkMode ? 'Light' : 'Dark'} Mode
      </button>
      <select value={brushType} onChange={(e) => setBrushType(e.target.value)} className="px-2 py-1 rounded border">
        <option value="crayon">Crayon</option>
        <option value="watercolor">Watercolor</option>
        <option value="oil">Oil Paint</option>
        <option value="pencil">Colored Pencil</option>
      </select>
      <button onClick={() => {
        const canvas = canvasRef.current;
        const image = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = image;
        link.download = 'colorflow-export.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }} className="px-3 py-1 bg-blue-500 text-white rounded">Export PNG</button>
      <div className="w-28 h-28 flex items-center justify-center rounded-xl bg-white/90 dark:bg-gray-800 shadow-inner p-2">
        <ColorPicker color={color} onChange={setColor} className="w-full h-full rounded-lg" />
      </div>
      <input type="range" min="1" max="50" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} />
      <input type="file" accept="image/*" onChange={handleImageUpload} ref={fileInputRef} />
      <button onClick={() => setIsErasing(!isErasing)} className="px-3 py-1 rounded bg-gray-300">{isErasing ? 'Eraser ON' : 'Eraser OFF'}</button>
      <button onClick={undo} className="px-3 py-1 bg-yellow-500 text-white rounded">Undo</button>
      <button onClick={redo} className="px-3 py-1 bg-orange-500 text-white rounded">Redo</button>
      <button onClick={saveCurrentPage} className="px-3 py-1 bg-green-500 text-white rounded">Save</button>
    </div>
    <button onClick={() => setShowToolbar(!showToolbar)} className="fixed top-4 right-4 z-50 bg-white/80 dark:bg-gray-800 text-sm px-4 py-2 rounded-full shadow-lg border border-gray-300 dark:border-gray-700 hover:scale-105 transition">
      {showToolbar ? 'Hide Toolbar' : 'Show Toolbar'}
    </button>

    <canvas
      ref={canvasRef}
      style={{ touchAction: 'none' }}
      className="w-[95%] max-w-6xl aspect-[4/3] mt-[190px] mx-auto rounded-[2.5rem] shadow-[0_20px_70px_rgba(0,0,0,0.15)] bg-white dark:bg-neutral-950 border-[2px] border-white/30 dark:border-gray-800"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleMouseDown}
      onTouchMove={handleMouseMove}
      onTouchEnd={handleMouseUp}
    />
  </div>
);
}
