# Google Sheets Chart Best Practices

## Professional Chart Defaults

### ALWAYS Include These Options
```javascript
{
  title: "Descriptive Chart Title",
  legend: { position: 'right', textStyle: { fontSize: 12 } },
  colors: ['#4285F4', '#EA4335', '#FBBC04', '#34A853', '#FF6D01'],
  chartArea: { width: '70%', height: '70%' },
  titleTextStyle: { fontSize: 16, bold: true }
}
```

---

## Chart Type Selection Guide

### Bar Charts
**Use for**: Comparing categories, ranking items
```javascript
{
  chartType: 'bar',
  hAxis: { title: 'Value', format: 'short' },
  vAxis: { title: 'Category' },
  bar: { groupWidth: '75%' }
}
```
**Example**: Sales by product, revenue by region

### Column Charts
**Use for**: Time-based comparisons, categorical data
```javascript
{
  chartType: 'column',
  hAxis: { title: 'Category' },
  vAxis: { title: 'Value', format: 'short' }
}
```
**Example**: Monthly sales, quarterly revenue

### Line Charts
**Use for**: Trends over time, continuous data
```javascript
{
  chartType: 'line',
  hAxis: { title: 'Time Period' },
  vAxis: { title: 'Value', format: 'short' },
  curveType: 'function' // Smooth lines
}
```
**Example**: Stock prices, temperature over time

### Pie Charts
**Use for**: Part-to-whole relationships (max 5-7 slices)
```javascript
{
  chartType: 'pie',
  pieHole: 0.4, // Donut chart
  sliceVisibilityThreshold: 0.02 // Hide slices < 2%
}
```
**Example**: Market share, budget allocation

### Scatter Charts
**Use for**: Correlation, distribution
```javascript
{
  chartType: 'scatter',
  hAxis: { title: 'X Variable' },
  vAxis: { title: 'Y Variable' },
  trendlines: { 0: {} } // Add trendline
}
```
**Example**: Price vs. quantity, height vs. weight

---

## Axis Configuration

### Number Formatting
```javascript
vAxis: {
  format: 'short',    // 1.2K instead of 1200
  // OR
  format: 'decimal',  // 1,200.00
  // OR
  format: '#,##0',    // 1,200
  // OR
  format: '$#,##0'    // $1,200
}
```

### Axis Labels
```javascript
hAxis: {
  title: 'Month',
  textStyle: { fontSize: 11 },
  slantedText: true,
  slantedTextAngle: 45
},
vAxis: {
  title: 'Sales ($)',
  textStyle: { fontSize: 11 },
  minValue: 0,
  maxValue: 1000
}
```

---

## Color Palettes

### Material Design (Default)
```javascript
colors: ['#4285F4', '#EA4335', '#FBBC04', '#34A853', '#FF6D01']
```

### Professional Blue
```javascript
colors: ['#1E88E5', '#42A5F5', '#64B5F6', '#90CAF9', '#BBDEFB']
```

### Warm Palette
```javascript
colors: ['#FF6F00', '#FF8F00', '#FFA000', '#FFB300', '#FFC107']
```

### Cool Palette
```javascript
colors: ['#00796B', '#00897B', '#009688', '#26A69A', '#4DB6AC']
```

---

## Chart Area & Spacing

### Optimal Layout
```javascript
{
  chartArea: {
    width: '70%',   // Leave room for legend
    height: '70%',  // Leave room for title and labels
    left: 80,       // Space for Y-axis labels
    top: 60,        // Space for title
    right: 100,     // Space for legend
    bottom: 60      // Space for X-axis labels
  }
}
```

### Compact Layout (No Legend)
```javascript
{
  chartArea: {
    width: '85%',
    height: '75%'
  },
  legend: { position: 'none' }
}
```

---

## Legend Configuration

### Right Position (Default)
```javascript
legend: {
  position: 'right',
  alignment: 'center',
  textStyle: { fontSize: 12 }
}
```

### Bottom Position (Many Series)
```javascript
legend: {
  position: 'bottom',
  maxLines: 3,
  textStyle: { fontSize: 11 }
}
```

### No Legend (Single Series)
```javascript
legend: { position: 'none' }
```

---

## Common Chart Patterns

### Sales by Product (Bar Chart)
```javascript
{
  chartType: 'bar',
  range: 'A1:B20',
  title: 'Sales by Product',
  hAxis: { title: 'Sales ($)', format: '$#,##0' },
  vAxis: { title: 'Product' },
  legend: { position: 'none' },
  colors: ['#4285F4']
}
```

### Monthly Revenue (Line Chart)
```javascript
{
  chartType: 'line',
  range: 'A1:B13',
  title: 'Monthly Revenue Trend',
  hAxis: { title: 'Month' },
  vAxis: { title: 'Revenue ($)', format: 'short' },
  curveType: 'function',
  colors: ['#34A853']
}
```

### Market Share (Pie Chart)
```javascript
{
  chartType: 'pie',
  range: 'A1:B6',
  title: 'Market Share by Company',
  pieHole: 0.4,
  sliceVisibilityThreshold: 0.02,
  legend: { position: 'right' }
}
```

---

## Best Practices

### DO:
- ✅ Always include a descriptive title
- ✅ Label axes with units (%, $, etc.)
- ✅ Use consistent color schemes
- ✅ Position legend where it doesn't obscure data
- ✅ Format large numbers (1.2K vs 1200)
- ✅ Use appropriate chart type for data

### DON'T:
- ❌ Create 3D charts (hard to read)
- ❌ Use too many colors (max 5-7)
- ❌ Omit axis labels
- ❌ Make pie charts with >7 slices
- ❌ Use default ugly colors
- ❌ Cram chart area to 100% (leave breathing room)

---

## Chart Positioning

### Default Position
```javascript
// Position to the right of data
positionRow: 2,
positionCol: lastColumn + 2
```

### Custom Position
```javascript
// Specific cell position
positionRow: 5,
positionCol: 10,
offsetX: 0,
offsetY: 0
```
