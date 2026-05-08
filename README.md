# Fantasy Website

## Running the Website

**IMPORTANT:** You cannot open `index.html` directly in your browser due to CORS restrictions. You must run a local web server.

### Option 1: Python (Recommended)
```bash
python -m http.server 8000
```
Then open: http://localhost:8000

### Option 2: Node.js (if you have it)
```bash
npx serve
```
Then open the URL shown in the terminal.

### Option 3: VS Code Live Server
If you're using VS Code, install the "Live Server" extension and click "Go Live" in the bottom right.

## Generating Data

Install Python dependencies once (`python-dotenv` is required for ESPN credentials):

```bash
pip install -r requirements.txt
```

Copy `.env.example` to `.env` if you have not already, and set `ESPN_LEAGUE_ID`, `ESPN_S2`, and `ESPN_SWID` for the ESPN Fantasy API.

Run the slimify script to generate JSON data:
```bash
python slimify_fantasy_html.py
```

This will create:
- `data-2025.json`
- `data-2024.json`
- `index.html`

## Troubleshooting

If you see "Failed to load data" errors:
1. Make sure you're running from a web server (not opening the file directly)
2. Check that `data-2025.json` and `data-2024.json` exist in the same folder
3. Check the browser console (F12) for detailed error messages

