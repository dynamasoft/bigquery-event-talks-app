import os
import time
import json
import re
import requests
import feedparser
from bs4 import BeautifulSoup
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# Cache configuration
CACHE_FILE = "feed_cache.json"
CACHE_EXPIRY_SECONDS = 3600  # 1 hour

def parse_entry_html(html_content, base_link, date_str, entry_id, updated):
    soup = BeautifulSoup(html_content, 'html.parser')
    updates = []
    
    current_type = None
    current_elements = []
    
    for child in soup.contents:
        # Ignore whitespace strings at root level
        if isinstance(child, str) and not child.strip():
            continue
            
        if child.name == 'h3':
            # Save previous update if it exists
            if current_type or current_elements:
                updates.append(create_update_dict(current_type, current_elements, base_link, date_str, len(updates), updated))
            current_type = child.get_text().strip()
            current_elements = []
        else:
            current_elements.append(child)
                
    # Append the last update
    if current_type or current_elements:
        updates.append(create_update_dict(current_type, current_elements, base_link, date_str, len(updates), updated))
        
    # Fallback if no h3 was found (treat entire block as one update)
    if not updates and html_content.strip():
        updates.append({
            'id': f"{entry_id}_0",
            'type': 'Update',
            'html': html_content,
            'text': re.sub(r'\s+', ' ', soup.get_text().strip()),
            'link': base_link,
            'date': date_str,
            'raw_date': updated,
            'index': 0
        })
        
    return updates

def create_update_dict(update_type, elements, base_link, date_str, index, raw_date):
    html_parts = []
    text_parts = []
    for el in elements:
        html_parts.append(str(el))
        if hasattr(el, 'get_text'):
            text_parts.append(el.get_text())
        else:
            text_parts.append(str(el))
            
    html_content = "".join(html_parts).strip()
    text_content = " ".join(text_parts).strip()
    text_content = re.sub(r'\s+', ' ', text_content)
    
    clean_link = base_link.split('#')[0]
    update_id = f"{clean_link}#{date_str.replace(' ', '_')}_{index}"
    
    return {
        'id': update_id,
        'type': update_type or 'Update',
        'html': html_content,
        'text': text_content,
        'link': f"{clean_link}#{date_str.replace(' ', '_')}",
        'date': date_str,
        'raw_date': raw_date,
        'index': index
    }

def fetch_and_cache_feed(force=False):
    now = time.time()
    
    # Check if cache exists and is fresh
    if not force and os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                cache_data = json.load(f)
            
            if now - cache_data.get('timestamp', 0) < CACHE_EXPIRY_SECONDS:
                return cache_data.get('entries', []), cache_data.get('timestamp', 0)
        except Exception as e:
            # If cache reading fails, fallback to fetching
            print(f"Error reading cache: {e}")
            
    # Fetch from source
    url = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    
    response = requests.get(url, headers=headers, timeout=15)
    response.raise_for_status()
    
    feed = feedparser.parse(response.text)
    
    parsed_entries = []
    for entry in feed.entries:
        date_str = entry.title
        entry_id = entry.id
        link = entry.link
        updated = entry.get('updated', '')
        
        content_html = ""
        if 'content' in entry and entry.content:
            content_html = entry.content[0].value
        elif 'summary' in entry:
            content_html = entry.summary
            
        updates = parse_entry_html(content_html, link, date_str, entry_id, updated)
        
        parsed_entries.append({
            'date': date_str,
            'raw_date': updated,
            'link': link,
            'id': entry_id,
            'updates': updates
        })
        
    # Write to cache
    cache_data = {
        'timestamp': now,
        'entries': parsed_entries
    }
    try:
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(cache_data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error writing cache: {e}")
        
    return parsed_entries, now

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/notes')
def get_notes():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    try:
        entries, timestamp = fetch_and_cache_feed(force=force_refresh)
        return jsonify({
            'status': 'success',
            'last_updated': timestamp,
            'entries': entries
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

if __name__ == '__main__':
    # Run the application locally on port 5000
    app.run(debug=True, host='127.0.0.1', port=5000)
