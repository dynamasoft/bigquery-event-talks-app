# BigQuery Pulse — Release Notes Tracker

BigQuery Pulse is a web dashboard built with Python Flask on the backend and plain vanilla HTML, JavaScript, and CSS on the frontend. The application fetches the official Google Cloud BigQuery Release Notes RSS feed, parses the contents into granular category-coded updates, and displays them on a timeline. It also features keyword search, category filters, and an interactive Twitter (X) sharing mechanism for single or multiple selected updates.

---

## ✨ Features

* **Granular Feed Decomposition**: Automatically parses daily Google Cloud release updates, splitting them into individual cards categorized as **Features**, **Issues**, **Changes**, or **Deprecations**.
* **Modern Glassmorphic UI**: High-fidelity dark mode styling featuring visual card hover animations, glowing gradients, and color-coded category badges.
* **On-Demand Refresh**: Live refresh button with spinner animations, allowing you to bypass cache controls to pull the absolute newest logs instantly.
* **Dual-Caching Engine**: Employs a local JSON caching system on the backend to avoid hitting Google's feed server on every request.
* **Real-time Search & Filter**: Instant client-side search matching keywords and filter chips to isolate specific update types.
* **Selected Tweet Builder**: Select one or multiple updates directly from the timeline to auto-compose a structured post and publish to X (Twitter) using Web Intents. Character limits are automatically calculated, and descriptions are truncated gracefully.

---

## 🛠️ Technology Stack

* **Backend**: Python 3.13+, Flask, BeautifulSoup4 (HTML parsing), Feedparser (RSS reading), Requests (HTTP client)
* **Frontend**: HTML5, Vanilla CSS (Custom HSL properties, Glassmorphism, animations), Vanilla JavaScript (AJAX, State management, custom event bindings)

---

## 📂 File Structure

```
bq-releases-notes/
├── app.py                  # Main Flask entry point (feed fetch, cache controller, parser)
├── requirements.txt        # Python library dependencies
├── .gitignore              # Ignored files configuration
├── README.md               # Project documentation
├── templates/
│   └── index.html          # Frontend dashboard HTML
└── static/
    ├── css/
    │   └── style.css       # Core stylesheets & dark-mode visual elements
    └── js/
        └── main.js         # Client-side state logic, search/filtering, and Twitter intent builders
```

---

## 🚀 Getting Started

### Prerequisites
Make sure Python 3.10+ is installed on your machine.

### Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/dynamasoft/bigquery-event-talks-app.git
   cd bigquery-event-talks-app
   ```

2. **Create and activate a virtual environment**:
   * On Windows:
     ```powershell
     python -m venv .venv
     .\.venv\Scripts\activate
     ```
   * On macOS/Linux:
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```

3. **Install the dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the Flask application**:
   ```bash
   python app.py
   ```

5. **Open the browser**:
   Navigate to **[http://127.0.0.1:5000](http://127.0.0.1:5000)** to view the application dashboard.

---

## 💡 How It Works

* **Parser**: In `app.py`, `BeautifulSoup` traverses raw HTML tags under each entry in Google's feed and parses sections by the `<h3>` headers. 
* **Cache**: When `/api/notes` is hit, the server serves the local `feed_cache.json` if it's less than 1 hour old. Requesting `/api/notes?refresh=true` forces an HTTP request to the Google feed XML URL, parses the live contents, overwrites the local cache, and responds with the new results.
* **Twitter Intent**: Select checkboxes are placed on every card. Clicking cards toggles their state in a JavaScript map. When you click "Tweet Selection", `main.js` builds a bullet-pointed text string matching the selected items, adds hashtags and reference links, truncates text to fit under 280 characters, and launches X's compose intent URL.
