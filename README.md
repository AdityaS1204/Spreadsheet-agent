# Excel Agent

AI-powered Google Sheets add-on that uses natural language to manipulate spreadsheets.

## Project Structure

```
excel-agent/
├── Code.gs              # Google Apps Script backend
├── Sidebar.html         # UI for the sidebar
├── appsscript.json      # Apps Script manifest
└── backend/             # Node.js API server
    ├── server.js        # Express server with /plan API
    ├── package.json     # Dependencies
    └── .env.example     # Environment variables template
```

## Setup

### 1. Backend Server

```bash
cd backend

# Install dependencies
npm install

# Create .env file with your Groq API key
cp .env.example .env
# Edit .env and add your GROQ_API_KEY

# Run the server
npm run dev
```

The server will start at `http://localhost:3000`

### 2. Google Apps Script

1. Go to [Google Apps Script](https://script.google.com)
2. Create a new project
3. Copy the contents of `Code.gs`, `Sidebar.html`, and `appsscript.json`
4. Update `BACKEND_URL` in `Code.gs` to your server URL
5. Deploy and test in Google Sheets

## API Endpoints

### POST /plan
Analyzes user prompt and sheet schema to generate an action plan.

**Request:**
```json
{
  "prompt": "Create a bar chart of sales by region",
  "sheetSchema": {
    "sheetName": "Sales Data",
    "headers": [...],
    "sampleData": [...],
    "rowCount": 100,
    "colCount": 5
  }
}
```

**Response:**
```json
{
  "success": true,
  "plan": {
    "summary": "Creating bar chart of sales by region",
    "steps": [
      {
        "stepNumber": 1,
        "action": "CREATE_CHART",
        "description": "Create bar chart",
        "params": {
          "type": "bar",
          "dataRange": "A1:B10",
          "title": "Sales by Region"
        }
      }
    ]
  }
}
```

## Available Actions

| Action | Description |
|--------|-------------|
| CONVERT_DATATYPE | Convert column data type |
| ADD_FORMULA | Add formulas to a column |
| CREATE_CHART | Create charts |
| SORT_DATA | Sort data by column |
| FILTER_DATA | Filter rows by condition |
| ADD_COLUMN | Add new columns |
| DELETE_COLUMN | Delete columns |
| DELETE_ROWS | Delete rows by condition |
| FORMAT_CELLS | Format cell ranges |
| CLEAN_DATA | Clean/transform data |
| AGGREGATE | Add SUM/AVG/etc formulas |
| YOY_CALCULATION | Year-over-Year calculations |

## Environment Variables

| Variable | Description |
|----------|-------------|
| GROQ_API_KEY | Your Groq API key |
| PORT | Server port (default: 3000) |
