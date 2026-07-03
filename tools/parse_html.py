import sys
from bs4 import BeautifulSoup

def main():
    if len(sys.argv) < 2:
        print("Usage: python tools/parse_html.py <aozora-html-path>", file=sys.stderr)
        raise SystemExit(2)

    file_path = sys.argv[1]
    
    with open(file_path, "rb") as f:
        raw = f.read()

    html = raw.decode("shift_jis", errors="ignore")
    soup = BeautifulSoup(html, "html.parser")

    print(f"Title: {soup.title.string if soup.title else 'No Title'}")
    
    headings = soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
    print(f"\n--- Headings Found ({len(headings)}) ---")
    for b in headings[:50]:
        print(f"{b.name}: {b.get_text(strip=True)[:50]}")
        
    print(f"\n--- Other Potential Structure Elements ---")
    # Aozora Bunko sometimes uses div classes for parts/chapters
    for div in soup.find_all('div', class_=True):
        if any(c in div.get('class', []) for c in ['part', 'chapter', 'section', 'midashi']):
            print(f"div.{div.get('class')}: {div.get_text(strip=True)[:50]}")

if __name__ == '__main__':
    main()
