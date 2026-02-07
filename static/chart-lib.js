// Simple lightweight charting library for closed network use
// No external dependencies required

class SimpleLineChart {
  constructor(canvasId, options = {}) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.series = {}; // { name: { data: [], color, unit } }
    this.gridColor = options.gridColor || 'rgba(255,255,255,0.05)';
    this.textColor = options.textColor || '#c0c0c0';
    this.maxPoints = options.maxPoints || 60;
    // allow customizing padding to move chart closer to title
    this.padding = (typeof options.padding === 'number') ? options.padding : 30;
    // for dual axis we compute ranges dynamically per-draw
    this.leftAxis = { min: options.leftMin || 0, max: options.leftMax || null };
    this.rightAxis = { min: options.rightMin || 0, max: options.rightMax || 100 };
  }

  // axis: 'left' or 'right'
  addSeries(name, color, unit = '', axis = 'right') {
    this.series[name] = {
      data: [],
      color: color,
      unit: unit,
      axis: axis
    };
  }

  setSeriesData(name, values) {
    if (this.series[name]) {
      this.series[name].data = values.slice(-this.maxPoints);
    }
  }

  setLabels(labels){
    // labels correspond to data points (timestamps formatted)
    this.labels = (labels || []).slice(-this.maxPoints);
  }

  draw() {
    if (!this.ctx || !this.canvas) return;

    const width = this.canvas.clientWidth || this.canvas.width;
    const height = this.canvas.clientHeight || this.canvas.height;
    
    // Set canvas resolution
    this.canvas.width = width;
    this.canvas.height = height;

    const padding = this.padding;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    // Draw background
    this.ctx.fillStyle = 'transparent';
    this.ctx.fillRect(0, 0, width, height);

    // Draw grid lines
    this.ctx.strokeStyle = this.gridColor;
    this.ctx.lineWidth = 1;

    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const y = padding + (chartHeight / 5) * i;
      this.ctx.beginPath();
      this.ctx.moveTo(padding, y);
      this.ctx.lineTo(width - padding, y);
      this.ctx.stroke();
    }

    // Compute axis ranges dynamically
    const leftSeriesData = [];
    const rightSeriesData = [];
    Object.values(this.series).forEach(s => {
      if (s.axis === 'left') leftSeriesData.push(...s.data.filter(v => typeof v === 'number'));
      else rightSeriesData.push(...s.data.filter(v => typeof v === 'number'));
    });

    const leftMax = this.leftAxis.max != null ? this.leftAxis.max : (leftSeriesData.length ? Math.max(...leftSeriesData) : 1);
    const leftMin = this.leftAxis.min != null ? this.leftAxis.min : 0;
    const rightMax = this.rightAxis.max != null ? this.rightAxis.max : (rightSeriesData.length ? Math.max(...rightSeriesData) : 100);
    const rightMin = this.rightAxis.min != null ? this.rightAxis.min : 0;

    this._leftMin = leftMin; this._leftMax = leftMax;
    this._rightMin = rightMin; this._rightMax = rightMax;

    // Draw left Y axis labels only if there's left-axis data
    const showLeftAxis = leftSeriesData.length > 0;
    if (showLeftAxis) {
      this.ctx.fillStyle = this.textColor;
      this.ctx.font = '12px sans-serif';
      this.ctx.textAlign = 'right';
      for (let i = 0; i <= 5; i++) {
        const val = leftMin + (leftMax - leftMin) * (5 - i) / 5;
        const y = padding + (chartHeight / 5) * i;
        this.ctx.fillText(val.toFixed(1), padding - 8, y + 4);
      }
    }

    // Draw X axis
    this.ctx.strokeStyle = this.textColor;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(padding, height - padding);
    this.ctx.lineTo(width - padding, height - padding);
    this.ctx.stroke();

    // Draw X axis labels if present (sparse to avoid clutter)
    if (Array.isArray(this.labels) && this.labels.length){
      const step = Math.max(1, Math.floor(this.labels.length / 6));
      this.ctx.fillStyle = this.textColor;
      this.ctx.font = '11px sans-serif';
      this.ctx.textAlign = 'center';
      for (let i = 0; i < this.labels.length; i += step){
        const x = padding + (chartWidth / (this.labels.length - 1 || 1)) * i;
        const y = height - padding + 18;
        this.ctx.fillText(this.labels[i], x, y);
      }
      // Draw a compact time-window label centered under the X axis
      try {
        const first = this.labels[0];
        const last = this.labels[this.labels.length - 1];
        if (first && last) {
          this.ctx.font = '12px sans-serif';
          this.ctx.textAlign = 'center';
          const txt = `${first} → ${last}`;
          this.ctx.fillText(txt, padding + chartWidth / 2, height - padding + 36);
        }
      } catch (e) { /* noop */ }
    }

    // Draw left Y axis line only when showing left axis
    if (showLeftAxis) {
      this.ctx.beginPath();
      this.ctx.moveTo(padding, padding);
      this.ctx.lineTo(padding, height - padding);
      this.ctx.stroke();
    }

    // Draw right Y axis labels and line
    this.ctx.textAlign = 'left';
    for (let i = 0; i <= 5; i++) {
      const val = rightMin + (rightMax - rightMin) * (5 - i) / 5;
      const y = padding + (chartHeight / 5) * i;
      this.ctx.fillText(val.toFixed(1), width - padding + 12, y + 4);
    }
    this.ctx.beginPath();
    this.ctx.moveTo(width - padding, padding);
    this.ctx.lineTo(width - padding, height - padding);
    this.ctx.stroke();

    // Draw each series
    Object.entries(this.series).forEach(([name, series]) => {
      const data = series.data;
      if (data.length === 0) return;

      // Draw line
      this.ctx.strokeStyle = series.color;
      this.ctx.lineWidth = 2.5;
      this.ctx.lineJoin = 'round';
      this.ctx.beginPath();

      for (let i = 0; i < data.length; i++) {
        const x = padding + (chartWidth / (data.length - 1 || 1)) * i;
        const val = data[i];
        let normalized = 0;
        if (series.axis === 'left') {
          normalized = (val - leftMin) / (leftMax - leftMin || 1);
        } else {
          normalized = (val - rightMin) / (rightMax - rightMin || 1);
        }
        const y = height - padding - normalized * chartHeight;

        if (i === 0) {
          this.ctx.moveTo(x, y);
        } else {
          this.ctx.lineTo(x, y);
        }
      }
      this.ctx.stroke();

      // Draw data points
      this.ctx.fillStyle = series.color;
      for (let i = 0; i < data.length; i++) {
        const x = padding + (chartWidth / (data.length - 1 || 1)) * i;
        const val = data[i];
        let normalized = 0;
        if (series.axis === 'left') {
          normalized = (val - leftMin) / (leftMax - leftMin || 1);
        } else {
          normalized = (val - rightMin) / (rightMax - rightMin || 1);
        }
        const y = height - padding - normalized * chartHeight;
        this.ctx.beginPath();
        this.ctx.arc(x, y, 2, 0, Math.PI * 2);
        this.ctx.fill();
      }
    });

    // Draw legend
    const legendX = width - 200;
    const legendY = padding;
    let legendOffset = 0;

    this.ctx.font = '12px sans-serif';
    this.ctx.textAlign = 'left';

    Object.entries(this.series).forEach(([name, series]) => {
      // Color box
      this.ctx.fillStyle = series.color;
      this.ctx.fillRect(legendX, legendY + legendOffset, 12, 12);

      // Label
      this.ctx.fillStyle = this.textColor;
      this.ctx.fillText(name, legendX + 16, legendY + legendOffset + 10);
      legendOffset += 18;
    });
  }
}

// Initialize chart globally
window.metricsChart = null;

function initChart() {
  window.metricsChart = new SimpleLineChart('metrics-chart', {
    leftMin: 0,
    leftMax: 100,
    rightMin: 0,
    rightMax: null,
    maxPoints: 60,
    padding: 30
  });

  // show percentage series on the LEFT axis per user request
  window.metricsChart.addSeries('Latency (%)', '#3498db', '%', 'left');
  window.metricsChart.addSeries('Packet Loss %', '#e74c3c', '%', 'left');
  window.metricsChart.addSeries('Availability %', '#2ecc71', '%', 'left');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initChart);
} else {
  initChart();
}

