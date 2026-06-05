import React, { useState, useMemo, useRef } from 'react';

// --- 核心運算邏輯 (全數以單價為基礎運算) ---
const calculateTarget = (targetMode, x, y) => {
  if (targetMode === 'yield') {
    if (x === 0) return 0;
    return (y * 12) / (x * 100);
  } else if (targetMode === 'price') {
    if (y === 0) return 0;
    return (x * 12) / y / 100;
  } else if (targetMode === 'rent') {
    return (x * y * 100) / 12;
  }
  return 0;
};

// --- 幫助函式：動態格式化顯示 (支援單價/總價切換) ---
const formatValue = (type, val, isTotal, area) => {
  let numStr = '';
  let unit = '';

  if (type === 'yield') {
    numStr = val.toFixed(2);
    unit = '%';
  } else if (type === 'price') {
    const finalVal = isTotal && area > 0 ? val * area : val;
    numStr = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 1 }).format(finalVal);
    unit = `萬${isTotal ? '' : '/坪'}`;
  } else if (type === 'rent') {
    if (isTotal && area > 0) {
      const finalVal = (val * area) / 10000;
      numStr = new Intl.NumberFormat('zh-TW', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(finalVal);
      unit = '萬元';
    } else {
      numStr = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 }).format(val);
      unit = '元/坪';
    }
  }
  
  return (
    <span className="inline-flex items-baseline justify-center">
      <span>{numStr}</span>
      <span className="text-[0.8em] opacity-60 font-normal ml-1 tracking-wide">{unit}</span>
    </span>
  );
};

export default function App() {
  const [mode, setMode] = useState('yield');
  const [isTotalMode, setIsTotalMode] = useState(false);
  const [swapAxes, setSwapAxes] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(true);
  
  const initialInputs = { price: 100, rent: 2000, yieldRate: 2.4, area: '' };
  const [inputs, setInputs] = useState(initialInputs);

  const initialStepConfigs = {
    price: { type: 'percent', percentValue: 5, absValue: 10 },
    rent: { type: 'percent', percentValue: 5, absValue: 50 },
    yieldRate: { type: 'percent', percentValue: 5, absValue: 0.2 }
  };
  const [stepConfigs, setStepConfigs] = useState(initialStepConfigs);

  const [hoverPos, setHoverPos] = useState({ r: null, c: null });
  const tableRef = useRef(null);

  const handleReset = () => {
    setInputs(initialInputs);
    setStepConfigs(initialStepConfigs);
    setMode('yield');
    setIsTotalMode(false);
    setSwapAxes(false);
    setShowHeatmap(true);
    setHoverPos({ r: null, c: null });
  };

  const handleScreenshot = async () => {
    if (!tableRef.current) return;
    try {
      if (!window.html2canvas) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }
      const canvas = await window.html2canvas(tableRef.current, { backgroundColor: '#ffffff', scale: 2 });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = '租金敏感度分析矩陣.png';
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('截圖失敗', err);
    }
  };

  const handleAreaChange = (e) => {
    const newAreaStr = e.target.value;
    const newArea = Number(newAreaStr);
    const oldArea = Number(inputs.area);

    if (isTotalMode) {
      if (!newArea || newArea <= 0) {
        setInputs(prev => ({
          ...prev,
          price: oldArea ? prev.price / oldArea : prev.price,
          rent: oldArea ? (prev.rent * 10000) / oldArea : prev.rent * 10000,
          area: newAreaStr
        }));
        setStepConfigs(prev => ({
          ...prev,
          price: { ...prev.price, absValue: oldArea ? prev.price.absValue / oldArea : prev.price.absValue },
          rent: { ...prev.rent, absValue: oldArea ? (prev.rent.absValue * 10000) / oldArea : prev.rent.absValue * 10000 }
        }));
        setIsTotalMode(false);
      } else {
        setInputs(prev => ({ ...prev, area: newAreaStr }));
      }
    } else {
      setInputs(prev => ({ ...prev, area: newAreaStr }));
    }
  };

  const handleModeSwitch = (toTotal) => {
    const area = Number(inputs.area);
    if (!area || area <= 0) return;
    
    if (toTotal && !isTotalMode) {
      setInputs(prev => ({ ...prev, price: prev.price * area, rent: (prev.rent * area) / 10000 }));
      setStepConfigs(prev => ({
        ...prev,
        price: { ...prev.price, absValue: prev.price.absValue * area },
        rent: { ...prev.rent, absValue: (prev.rent.absValue * area) / 10000 }
      }));
      setIsTotalMode(true);
    } else if (!toTotal && isTotalMode) {
      setInputs(prev => ({ ...prev, price: prev.price / area, rent: (prev.rent * 10000) / area }));
      setStepConfigs(prev => ({
        ...prev,
        price: { ...prev.price, absValue: prev.price.absValue / area },
        rent: { ...prev.rent, absValue: (prev.rent.absValue * 10000) / area }
      }));
      setIsTotalMode(false);
    }
  };

  const handleInputChange = (field, valueStr) => {
    const val = parseFloat(valueStr) || 0;
    setInputs(prev => ({ ...prev, [field]: valueStr === '' ? '' : val }));
  };

  const handleStepConfigChange = (field, key, valueStr) => {
    setStepConfigs(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        [key]: key === 'type' ? valueStr : (valueStr === '' ? '' : parseFloat(valueStr) || 0)
      }
    }));
  };

  // --- 拉桿專用邏輯區塊 ---
  const getSliderConfigInfo = (varType, isPercent) => {
    if (isPercent) return { min: 1, max: 10, step: 1, unit: '%' };
    if (varType === 'price') return { min: 1, max: 30, step: 1, unit: '萬/坪' };
    if (varType === 'rent') return { min: 50, max: 500, step: 50, unit: '元/坪' };
    if (varType === 'yieldRate') return { min: 0.05, max: 0.5, step: 0.05, unit: '%' };
    return { min: 1, max: 10, step: 1, unit: '' };
  };

  const getSliderValue = (varType) => {
    const config = stepConfigs[varType];
    if (config.type === 'percent') return config.percentValue;
    // 將總價反推回單價層次，讓拉桿視覺始終保持單價邏輯
    if (isTotalMode && varType !== 'yieldRate' && inputs.area > 0) {
      if (varType === 'rent') return Math.round((config.absValue * 10000) / inputs.area);
      return Number((config.absValue / inputs.area).toFixed(4));
    }
    return config.absValue;
  };

  const handleSliderChange = (varType, valueStr) => {
    const val = parseFloat(valueStr);
    const config = stepConfigs[varType];
    if (config.type === 'percent') {
      handleStepConfigChange(varType, 'percentValue', val);
    } else {
      let finalVal = val;
      // 將拉桿的單價設定，根據目前的模式換算回實際需要的級距儲存
      if (isTotalMode && varType !== 'yieldRate' && inputs.area > 0) {
        if (varType === 'rent') finalVal = (val * inputs.area) / 10000;
        else finalVal = val * inputs.area;
      }
      handleStepConfigChange(varType, 'absValue', finalVal);
    }
  };

  // 動態渲染拉桿元件 (支援橫向 X 軸與直向 Y 軸)
  const renderSlider = (axis, varType, label) => {
    const config = stepConfigs[varType];
    const isPercent = config.type === 'percent';
    const { min, max, step, unit } = getSliderConfigInfo(varType, isPercent);
    const val = getSliderValue(varType);
    const displayVal = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 }).format(val);
    const onChange = (e) => handleSliderChange(varType, e.target.value);

    if (axis === 'x') {
      return (
        <div className="flex items-center gap-3 px-4 py-2.5 h-full">
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-sm font-bold text-slate-700 tracking-wide">{label}</span>
            <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">微調</span>
          </div>
          <div className="flex items-center gap-2 w-[160px] sm:w-[220px]">
            <span className="text-[10px] text-slate-400 font-bold">{min}</span>
            <input type="range" min={min} max={max} step={step} value={val} onChange={onChange} className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
            <span className="text-[10px] text-slate-400 font-bold">{max}</span>
          </div>
          <div className="flex items-center">
            <span className="text-sm font-black text-blue-700 bg-blue-50 px-2 py-1 rounded-md border border-blue-100 whitespace-nowrap shadow-sm">
              {displayVal} <span className="text-[9px] font-bold ml-0.5">{unit}</span>
            </span>
          </div>
        </div>
      );
    } else {
      return (
        <div className="flex flex-col items-center gap-3 px-2.5 py-4 w-full h-full">
          <div className="flex items-center">
            <span className="text-xs font-black text-blue-700 bg-blue-50 px-1.5 py-1.5 rounded-md border border-blue-100 text-center leading-tight shadow-sm whitespace-nowrap">
              {displayVal}<br/><span className="text-[9px] font-bold">{unit}</span>
            </span>
          </div>
          <div className="flex flex-col items-center gap-2 h-[160px] sm:h-[220px]">
            <span className="text-[10px] text-slate-400 font-bold">{max}</span>
            <input 
               type="range" orient="vertical" min={min} max={max} step={step} value={val} onChange={onChange} 
               className="flex-1 w-1.5 bg-slate-200 rounded-lg cursor-ns-resize accent-blue-600 [appearance:slider-vertical]" 
               style={{ WebkitAppearance: 'slider-vertical' }} 
            />
            <span className="text-[10px] text-slate-400 font-bold">{min}</span>
          </div>
          <div className="flex flex-col items-center gap-1.5 whitespace-nowrap">
             <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1 py-1.5 rounded" style={{ writingMode: 'vertical-rl' }}>微調</span>
             <span className="text-sm font-bold text-slate-700 tracking-widest" style={{ writingMode: 'vertical-rl' }}>{label}</span>
          </div>
        </div>
      );
    }
  };

  const getUnitValues = () => {
    const area = Number(inputs.area) || 1;
    return {
      priceUnit: isTotalMode ? inputs.price / area : inputs.price,
      rentUnit: isTotalMode ? (inputs.rent * 10000) / area : inputs.rent,
    };
  };

  const steps = [-3, -2, -1, 0, 1, 2, 3];

  const generateUnitAxis = (baseUnit, type, area, isTotalMode) => {
      const config = stepConfigs[type];
      const isTotal = isTotalMode && area > 0 && type !== 'yieldRate';
      let displayBase = baseUnit;
      if (isTotal) displayBase = type === 'rent' ? (baseUnit * area) / 10000 : baseUnit * area;

      return steps.map(s => {
          let displayVal = config.type === 'percent' 
            ? displayBase * (1 + s * (config.percentValue / 100))
            : displayBase + (s * config.absValue);
          
          if (isTotal) return type === 'rent' ? (displayVal * 10000) / area : displayVal / area;
          return displayVal;
      });
  };

  const matrixData = useMemo(() => {
    const { priceUnit, rentUnit } = getUnitValues();
    const yieldRate = Number(inputs.yieldRate) || 0;
    const area = Number(inputs.area) || 0;
    const effectiveIsTotal = isTotalMode && area > 0;

    let stdLabelX, stdLabelY, stdTypeX, stdTypeY, resultType, baseResult = 0;

    if (mode === 'yield') {
      stdLabelY = '房地售價'; stdTypeY = 'price';
      stdLabelX = '月租金'; stdTypeX = 'rent'; resultType = 'yield';
      baseResult = calculateTarget('yield', priceUnit, rentUnit);
    } else if (mode === 'price') {
      stdLabelY = '預期收益率'; stdTypeY = 'yieldRate';
      stdLabelX = '月租金'; stdTypeX = 'rent'; resultType = 'price';
      baseResult = calculateTarget('price', rentUnit, yieldRate);
    } else if (mode === 'rent') {
      stdLabelY = '預期收益率'; stdTypeY = 'yieldRate';
      stdLabelX = '房地售價'; stdTypeX = 'price'; resultType = 'rent';
      baseResult = calculateTarget('rent', priceUnit, yieldRate);
    }

    const stdAxisY = generateUnitAxis(stdTypeY === 'price' ? priceUnit : yieldRate, stdTypeY, area, isTotalMode);
    const stdAxisX = generateUnitAxis(stdTypeX === 'rent' ? rentUnit : priceUnit, stdTypeX, area, isTotalMode);

    const labelX = swapAxes ? stdLabelY : stdLabelX;
    const labelY = swapAxes ? stdLabelX : stdLabelY;
    const typeX = swapAxes ? stdTypeY : stdTypeX;
    const typeY = swapAxes ? stdTypeX : stdTypeY;
    const axisX = swapAxes ? stdAxisY : stdAxisX;
    const axisY = swapAxes ? stdAxisX : stdAxisY;

    const grid = axisY.map(yVal => {
      return axisX.map(xVal => {
        const currentStdY = swapAxes ? xVal : yVal;
        const currentStdX = swapAxes ? yVal : xVal;
        let val = 0;
        if (mode === 'yield') val = calculateTarget('yield', currentStdY, currentStdX);
        else if (mode === 'price') val = calculateTarget('price', currentStdX, currentStdY);
        else if (mode === 'rent') val = calculateTarget('rent', currentStdX, currentStdY);
        return { xVal, yVal, value: val };
      });
    });

    // 動態計算目前矩陣的最大值與最小值，用作熱度圖渲染依據
    let maxVal = -Infinity;
    let minVal = Infinity;
    grid.forEach(row => {
      row.forEach(cell => {
        if (cell.value > maxVal) maxVal = cell.value;
        if (cell.value < minVal) minVal = cell.value;
      });
    });

    return { labelX, labelY, typeX, typeY, resultType, axisX, axisY, grid, baseResult, effectiveIsTotal, area, maxVal, minVal };
  }, [mode, inputs, steps, isTotalMode, stepConfigs, swapAxes]);

  const getCellColor = (value, baseResult, isCenter, maxVal, minVal) => {
    if (isCenter) return 'bg-white text-blue-800 shadow-sm';
    if (!showHeatmap) return 'bg-blue-50/40 text-gray-700';
    if (baseResult === 0) return 'bg-white text-gray-700';

    // 改良版動態熱度圖邏輯：依據數值與矩陣極值的相對位置決定顏色深度
    if (value > baseResult) {
       const range = maxVal - baseResult;
       if (range === 0) return 'bg-blue-50/40 text-gray-700';
       const intensity = (value - baseResult) / range;
       if (intensity >= 0.8) return 'bg-rose-300 text-rose-900 font-bold';
       if (intensity >= 0.5) return 'bg-rose-200 text-rose-900 font-semibold';
       if (intensity >= 0.2) return 'bg-rose-100 text-rose-800 font-medium';
       return 'bg-rose-50 text-rose-700';
    } else if (value < baseResult) {
       const range = baseResult - minVal;
       if (range === 0) return 'bg-blue-50/40 text-gray-700';
       const intensity = (baseResult - value) / range;
       if (intensity >= 0.8) return 'bg-emerald-300 text-emerald-900 font-bold';
       if (intensity >= 0.5) return 'bg-emerald-200 text-emerald-900 font-semibold';
       if (intensity >= 0.2) return 'bg-emerald-100 text-emerald-800 font-medium';
       return 'bg-emerald-50 text-emerald-700';
    }
    
    return 'bg-blue-50/40 text-gray-700';
  };

  const renderAxisHeader = (type, val, step, isHovered) => {
    const isBase = step === 0;
    const config = stepConfigs[type];
    let stepText = isBase ? '基準' : '';

    if (!isBase) {
        const sign = step > 0 ? '+' : '';
        stepText = config.type === 'percent' 
          ? `${sign}${parseFloat((step * config.percentValue).toFixed(2))}%`
          : `${sign}${new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 1 }).format(step * config.absValue)}`;
    }

    const formatType = type === 'yieldRate' ? 'yield' : type;
    const valText = formatValue(formatType, val, matrixData.effectiveIsTotal, matrixData.area);
    
    return (
      <div className={`text-sm transition-colors ${isHovered ? 'font-bold text-white' : (isBase ? 'font-bold text-blue-700' : 'text-gray-600')}`}>
        <div>{valText}</div>
        <div className={`text-xs ${isHovered ? 'opacity-90 text-blue-100' : 'opacity-75'}`}>({stepText})</div>
      </div>
    );
  };

  const renderInputCard = (field, label, unit, stepUnitAbs) => {
     const config = stepConfigs[field];
     const mainValue = inputs[field];
     const mainStep = field === 'yieldRate' ? '0.1' : (field === 'rent' ? (isTotalMode ? '0.1' : '50') : '1');
     const configStep = config.type === 'percent' ? '1' : mainStep;

     return (
        <div className="flex flex-col bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-400/20 transition-all h-full">
           <div className="flex flex-col px-5 py-4 bg-gray-50/50 flex-1">
             <label className="block text-sm font-bold text-gray-500 tracking-wide mb-2">{label}</label>
             <div className="flex items-baseline gap-2 mt-auto">
               <input
                  type="number"
                  step={mainStep}
                  value={mainValue}
                  onChange={(e) => handleInputChange(field, e.target.value)}
                  className="flex-1 w-0 bg-transparent outline-none font-bold text-gray-800 text-3xl placeholder-gray-300 text-right"
                  placeholder="0"
               />
               <span className="text-base font-bold text-gray-400 shrink-0">{unit}</span>
             </div>
           </div>
           
           <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-white">
              <div className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                敏感度間距
              </div>
              <div className="flex items-center gap-2">
                <div className="flex bg-gray-100 p-1 rounded-lg text-xs font-bold text-gray-500">
                  <button type="button" onClick={() => handleStepConfigChange(field, 'type', 'percent')} className={`px-2 py-1 rounded-md transition-all ${config.type === 'percent' ? 'bg-white shadow-sm text-blue-600' : 'hover:text-gray-700'}`}>% 比例</button>
                  <button type="button" onClick={() => handleStepConfigChange(field, 'type', 'absolute')} className={`px-2 py-1 rounded-md transition-all ${config.type === 'absolute' ? 'bg-white shadow-sm text-blue-600' : 'hover:text-gray-700'}`}>± 數值</button>
                </div>
                <div className="flex items-center border border-gray-200 rounded-lg bg-white overflow-hidden focus-within:border-blue-400 transition-colors">
                  <input
                      type="number"
                      step={configStep}
                      value={config.type === 'percent' ? config.percentValue : config.absValue}
                      onChange={e => handleStepConfigChange(field, config.type === 'percent' ? 'percentValue' : 'absValue', e.target.value)}
                      className="w-14 text-sm p-1.5 text-center outline-none font-bold text-gray-700"
                  />
                  <span className="text-xs font-bold text-gray-400 pr-2">{config.type === 'percent' ? '%' : stepUnitAbs}</span>
                </div>
              </div>
           </div>
        </div>
     );
  };

  const hasArea = Number(inputs.area) > 0;

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-6 lg:p-8 font-sans flex justify-center">
      <div className="w-full max-w-7xl flex flex-col gap-6">
        
        {/* --- 區塊一：全局標題與控制列 --- */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
           <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">
                房地產租金收益敏感度分析
              </h1>
              <p className="text-sm text-slate-500 mt-1.5">設定目標與雙變數，快速產生影響力矩陣圖表。</p>
           </div>
           <button
             onClick={handleReset}
             className="flex items-center justify-center gap-1.5 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-sm font-semibold transition-all shadow-sm focus:ring-2 focus:ring-slate-200"
           >
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
             </svg>
             重置所有數值
           </button>
        </div>

        {/* --- 區塊二：核心控制儀表板 --- */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 md:p-8 flex flex-col gap-8">
          
          <div className="flex flex-col items-center gap-3">
             <span className="text-sm font-extrabold text-slate-400 uppercase tracking-widest">第一步：選擇計算目標</span>
             <div className="flex flex-wrap sm:flex-nowrap bg-slate-100/80 p-1.5 rounded-2xl w-full max-w-2xl">
               {[
                  { id: 'yield', label: '計算 租金收益率' },
                  { id: 'price', label: '計算 合理售價' },
                  { id: 'rent', label: '計算 目標租金' }
               ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setMode(opt.id)}
                    className={`flex-1 px-4 py-3 text-base sm:text-lg font-bold rounded-xl transition-all duration-200 ${mode === opt.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 scale-[1.02]' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'}`}
                  >
                    {opt.label}
                  </button>
               ))}
             </div>
          </div>

          <div className="border-t border-slate-100"></div>

          <div className="flex flex-col gap-3">
             <span className="text-sm font-extrabold text-slate-400 uppercase tracking-widest text-center">第二步：輸入變數條件</span>
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
               {mode !== 'price' && renderInputCard('price', isTotalMode ? '房屋總售價' : '房地售價單價', isTotalMode ? '萬元' : '萬/坪', isTotalMode ? '萬元' : '萬')}
               {mode !== 'rent' && renderInputCard('rent', isTotalMode ? '總月租金' : '月租金單價', isTotalMode ? '萬元' : '元/坪', isTotalMode ? '萬元' : '元')}
               {mode !== 'yield' && renderInputCard('yieldRate', '預期租金收益率', '%', '%')}
               
               <div className="flex flex-col bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-400/20 transition-all h-full">
                 <div className="flex flex-col px-5 py-4 bg-gray-50/50 flex-1">
                   <label className="block text-sm font-bold text-gray-500 tracking-wide mb-2">房地面積 (選填)</label>
                   <div className="flex items-baseline gap-2 mt-auto">
                     <input
                        type="number"
                        value={inputs.area}
                        onChange={handleAreaChange}
                        className="flex-1 w-0 bg-transparent outline-none font-bold text-gray-800 text-3xl placeholder-gray-300 text-right"
                        placeholder="0"
                     />
                     <span className="text-base font-bold text-gray-400 shrink-0">坪</span>
                   </div>
                 </div>
                 <div className="flex items-center justify-center px-5 py-3 border-t border-gray-100 bg-white">
                    <div className="flex w-full bg-slate-100 p-1 rounded-lg text-sm font-bold text-slate-500">
                      <button onClick={() => handleModeSwitch(false)} className={`flex-1 py-1.5 rounded-md transition-all ${!isTotalMode ? 'bg-white shadow-sm text-blue-600' : 'hover:text-slate-700'}`}>顯示單價</button>
                      <button onClick={() => handleModeSwitch(true)} disabled={!hasArea} className={`flex-1 py-1.5 rounded-md transition-all ${isTotalMode ? 'bg-white shadow-sm text-blue-600' : 'hover:text-slate-700'} ${!hasArea ? 'opacity-40 cursor-not-allowed' : ''}`}>顯示總價</button>
                    </div>
                 </div>
               </div>
             </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between bg-gradient-to-r from-blue-50 via-blue-50/50 to-indigo-50 border border-blue-200/60 rounded-2xl p-6 sm:px-10 sm:py-8 shadow-inner relative overflow-hidden mt-2">
             <div className="absolute right-0 top-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl transform translate-x-1/3 -translate-y-1/3"></div>
             
             <div className="flex items-center gap-3 relative z-10 mb-4 sm:mb-0">
                <div className="w-1.5 h-10 bg-blue-600 rounded-full"></div>
                <h3 className="text-lg sm:text-xl font-bold text-blue-900 tracking-wide">當前基礎計算結果</h3>
             </div>
             
             <div className="text-5xl sm:text-6xl font-black text-blue-700 relative z-10 flex items-baseline drop-shadow-sm">
               {formatValue(matrixData.resultType, matrixData.baseResult, matrixData.effectiveIsTotal, matrixData.area)}
             </div>
          </div>

        </div>

        {/* --- 區塊三：矩陣圖表與拉桿 --- */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-4 md:p-6 lg:p-8 flex flex-col flex-1 overflow-hidden">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-100">
            <div>
              <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-3">
                分析矩陣視圖
                {matrixData.effectiveIsTotal && <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-md text-xs font-bold tracking-widest uppercase">總價模式</span>}
              </h2>
              <p className="text-sm text-slate-500 mt-1.5">拖曳上方與左側的拉桿，即時預覽不同梯度下的敏感度交叉數值。</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setSwapAxes(!swapAxes)} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                X/Y 互換
              </button>
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/60">
                <button onClick={() => setShowHeatmap(false)} className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-all ${!showHeatmap ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  單色
                </button>
                <button onClick={() => setShowHeatmap(true)} className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-all ${showHeatmap ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  色階
                </button>
              </div>
              <button onClick={handleScreenshot} className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 border border-slate-800 rounded-xl text-sm font-semibold text-white hover:bg-slate-700 transition-colors shadow-sm ml-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                匯出圖片
              </button>
            </div>
          </div>

          {/* 核心網格佈局：包含兩個拉桿與矩陣本身 */}
          <div className="flex-1 flex flex-col min-h-[500px]">
             <div className="grid grid-cols-[auto_1fr] grid-rows-[auto_1fr] gap-3 md:gap-4 w-full h-full">
                
                {/* 1. 左上角留白區 */}
                <div className="col-start-1 row-start-1"></div>
                
                {/* 2. 上方拉桿 (控制 X 軸) - 縮短並置中 */}
                <div className="col-start-2 row-start-1 bg-white border border-slate-200 rounded-2xl shadow-sm w-fit h-fit place-self-center">
                   {renderSlider('x', matrixData.typeX, matrixData.labelX)}
                </div>

                {/* 3. 左方拉桿 (控制 Y 軸) - 縮短並置中 */}
                <div className="col-start-1 row-start-2 bg-white border border-slate-200 rounded-2xl shadow-sm w-fit h-fit place-self-center">
                   {renderSlider('y', matrixData.typeY, matrixData.labelY)}
                </div>

                {/* 4. 矩陣主體 (Ref 綁定於此，確保截圖不含拉桿) */}
                <div className="col-start-2 row-start-2 overflow-x-auto bg-white border border-slate-200 rounded-2xl shadow-sm">
                   <div ref={tableRef} className="p-3 md:p-4 min-w-max bg-white">
                      <table className="w-full border-collapse min-w-[650px]" onMouseLeave={() => setHoverPos({ r: null, c: null })}>
                        <thead>
                          <tr>
                            <th className="p-2 border border-slate-200 bg-slate-50 relative w-32 h-20 min-w-[120px]">
                               <div className="absolute top-2 right-2 text-xs text-slate-500 font-bold tracking-wide">{matrixData.labelX} →</div>
                               <div className="absolute bottom-2 left-2 text-xs text-slate-500 font-bold tracking-wide">↓ {matrixData.labelY}</div>
                               <svg className="absolute inset-0 w-full h-full text-slate-200" preserveAspectRatio="none" viewBox="0 0 100 100">
                                  <line x1="0" y1="0" x2="100" y2="100" stroke="currentColor" strokeWidth="1"></line>
                               </svg>
                            </th>
                            {matrixData.axisX.map((xVal, colIndex) => {
                              const isHovered = hoverPos.c === colIndex;
                              return (
                                <th key={`head-x-${colIndex}`} 
                                    className={`p-2 border border-slate-200 text-center transition-all duration-150 relative
                                              ${steps[colIndex] === 0 && !isHovered ? 'border-b-2 border-b-blue-500' : ''}
                                              ${isHovered ? '!bg-blue-600 shadow-[inset_0_-3px_0_#1e3a8a] z-20' : 'bg-slate-50'}`}>
                                  {renderAxisHeader(matrixData.typeX, xVal, steps[colIndex], isHovered)}
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {matrixData.grid.map((row, rowIndex) => {
                            const isHoverActive = hoverPos.r !== null;
                            const isRowHovered = hoverPos.r === rowIndex;
                            return (
                              <tr key={`row-${rowIndex}`}>
                                <th className={`p-2 border border-slate-200 text-left align-middle transition-all duration-150 relative
                                              ${steps[rowIndex] === 0 && !isRowHovered ? 'border-r-2 border-r-blue-500' : ''}
                                              ${isRowHovered ? '!bg-blue-600 shadow-[inset_-3px_0_0_#1e3a8a] z-20' : 'bg-slate-50'}`}>
                                   {renderAxisHeader(matrixData.typeY, matrixData.axisY[rowIndex], steps[rowIndex], isRowHovered)}
                                </th>
                                {row.map((cell, colIndex) => {
                                  const isCenter = rowIndex === 3 && colIndex === 3;
                                  const isCrosshair = isHoverActive && (hoverPos.r === rowIndex || hoverPos.c === colIndex);
                                  const isTarget = isHoverActive && hoverPos.r === rowIndex && hoverPos.c === colIndex;
                                  
                                  let hoverClass = '';
                                  if (isTarget) {
                                    // 目標單元格：強烈外凸、放大、深藍色底
                                    hoverClass = '!bg-blue-600 !text-white ring-2 ring-blue-800 ring-inset z-30 shadow-2xl scale-105';
                                  } else if (isCrosshair) {
                                    // 十字準星軸線：改用內凹陰影 (inset shadow) 搭配淺藍底色，營造軌道感
                                    hoverClass = '!bg-blue-100/90 !text-blue-900 z-20 shadow-[inset_0_0_15px_rgba(37,99,235,0.15)] ring-1 ring-blue-200/50';
                                  } else if (isCenter) {
                                    hoverClass = 'ring-2 ring-slate-300/80 ring-inset z-10';
                                  }

                                  return (
                                    <td 
                                      key={`cell-${rowIndex}-${colIndex}`} 
                                      onMouseEnter={() => setHoverPos({ r: rowIndex, c: colIndex })}
                                      className={`p-3 border border-slate-100 text-center transition-all duration-150 cursor-default relative
                                        ${getCellColor(cell.value, matrixData.baseResult, isCenter, matrixData.maxVal, matrixData.minVal)}
                                        ${hoverClass}`}
                                    >
                                      <span className={`${isCenter || isTarget ? 'text-lg font-bold' : 'text-sm'} transition-all duration-150`}>
                                        {formatValue(matrixData.resultType, cell.value, matrixData.effectiveIsTotal, matrixData.area)}
                                      </span>
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                   </div>
                </div>

             </div>
          </div>
        </div>
      </div>
    </div>
  );
}