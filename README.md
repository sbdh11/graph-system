# SAP Order-to-Cash (O2C) Graph Explorer

An interactive full-stack application that visualizes SAP Order-to-Cash data as a graph and provides a natural-language chat interface for querying business processes.

### 1. Prerequisites
- **Node.js** (LTS recommended)
- **npm**

### 2. Setup Backend
In the project root:
```bash
npm install
npm run serve
```
The server will start on `http://localhost:3000`.

### 3. Setup Frontend
In a new terminal:
```bash
cd frontend
npm install
npm run dev
```
Open the URL printed in the terminal (usually `http://localhost:5173`).

---

##  Features

- **Interactive Graph**: Visualize relationships between Orders, Deliveries, Billings, and Payments.
- **Conversational Queries**: Ask questions like "trace billing 91150083" or "find broken flows".
- **Visual Feedback**: Focus graph highlighting with glow effects and animated particles on trace results.
- **Business Logic**: Built-in rules for detecting process anomalies and top-performing products.

---

##  Project Structure

- `frontend/`: React + Vite application using `react-force-graph`.
- `src/`: Node.js/Express backend containing:
  - `core/graph.js`: In-memory graph implementation.
  - `services/queryEngine.js`: Business logic for O2C trancations.
  - `llm/translator.js`: Rule-based natural language intent parser.
- `sap-o2c-data/`: Source JSONL datasets for Orders, Deliveries, Billings, etc.
- `walkthroughs/`: Detailed logs and design documentation from the development process.

---

##  Walkthroughs & Documentation

For a deeper dive into how this system was built and refined, check out the files in the `/walkthroughs` folder:

- **[O2C Graph Fragmentation](walkthroughs/cursor_markdown.md)**: Solving node connection issues and ensuring full process chains.
- **[Chat UI Refactor](walkthroughs/walkthrough4)**: Designing the structured results cards and improving UX.
- **[Graph Glow Effects](walkthroughs/walkthrough5)**: Implementing the high-impact visual highlighting system.
- **[Rule-Based Translator](walkthroughs/walkthrough3.md)**: Building the deterministic natural language parser.

---

## Testing & Linting

- **Backend Tests**: `node --test`
- **Frontend Lint**: `npm --prefix frontend run lint`

---

## .env Configuration

Rename the `.env.example` file to `.env` file in the root directory and add your Gemini API key:
```env
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-flash-latest
```
*If no key is provided, the system falls back to rule-based logic.*
