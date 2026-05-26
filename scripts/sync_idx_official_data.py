#!/usr/bin/env python3
import json
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

REPO = Path('/root/projects/market-pulse-ai-56')
SRC = Path('/opt/idx-official-data')
LIST = Path('/root/list_perusahaan.xlsx')
PUBLIC = REPO / 'public/data/idx-official'
JSON_DST = PUBLIC / 'json'
EXCEL_DST = PUBLIC / 'excel'
INDEX = PUBLIC / 'index.json'

DONE_STATUSES = {'selesai', 'partial', 'partial_llm', 'gagal'}

def now():
    return datetime.now(timezone.utc).isoformat()

def read_json(path):
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except Exception:
        return {}

def copy_if_changed(src, dst):
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists() and dst.stat().st_size == src.stat().st_size:
        try:
            if dst.read_bytes() == src.read_bytes():
                return False
        except Exception:
            pass
    shutil.copy2(src, dst)
    return True

def company_lookup():
    lookup = {}
    rows_total = 0
    status_counts = {}
    processed = 0
    if LIST.exists():
        df = pd.read_excel(LIST).fillna('')
        rows_total = len(df)
        for _, row in df.iterrows():
            code = str(row.get('Kode Saham', '')).strip().upper()
            if not code:
                continue
            status = str(row.get('Official Data Status', '')).strip().lower()
            if status:
                status_counts[status] = status_counts.get(status, 0) + 1
            if status in DONE_STATUSES:
                processed += 1
            lookup[code] = {
                'company_name': str(row.get('Nama Perusahaan', '')).strip(),
                'sheet_status': status or None,
                'scraped_at': str(row.get('Official Data Scraped At', '')).strip() or None,
                'error': str(row.get('Official Data Error', '')).strip() or None,
            }
    return lookup, rows_total, processed, status_counts

def main():
    PUBLIC.mkdir(parents=True, exist_ok=True)
    JSON_DST.mkdir(parents=True, exist_ok=True)
    EXCEL_DST.mkdir(parents=True, exist_ok=True)
    lookup, rows_total, processed, status_counts = company_lookup()

    changed = 0
    items = []
    for src_json in sorted((SRC / 'extracted').glob('*/*_official_data*.json')):
        code = src_json.parent.name.upper()
        partial = src_json.name.endswith('_official_data_partial.json')
        dst_json = JSON_DST / code / src_json.name
        changed += int(copy_if_changed(src_json, dst_json))

    for src_excel in sorted((SRC / 'excel').glob('*_official_data*.xlsx')):
        if '_test' in src_excel.name:
            continue
        changed += int(copy_if_changed(src_excel, EXCEL_DST / src_excel.name))

    for code_dir in sorted(JSON_DST.glob('*')):
        if not code_dir.is_dir():
            continue
        code = code_dir.name.upper()
        full = code_dir / f'{code}_official_data.json'
        partial = code_dir / f'{code}_official_data_partial.json'
        chosen = full if full.exists() else partial
        if not chosen.exists():
            continue
        data = read_json(chosen)
        meta = lookup.get(code, {})
        status = (data.get('processing_status') or meta.get('sheet_status') or data.get('status') or ('partial' if chosen == partial else 'selesai'))
        company = data.get('company_name') or meta.get('company_name') or code
        excel_name = f'{code}_official_data_partial.xlsx' if chosen == partial else f'{code}_official_data.xlsx'
        full_excel = EXCEL_DST / f'{code}_official_data.xlsx'
        partial_excel = EXCEL_DST / f'{code}_official_data_partial.xlsx'
        excel_path = partial_excel if chosen == partial and partial_excel.exists() else full_excel
        items.append({
            'code': code,
            'company_name': company,
            'status': status,
            'json': f'/data/idx-official/json/{code}/{chosen.name}',
            'excel': f'/data/idx-official/excel/{excel_path.name}' if excel_path.exists() else f'/data/idx-official/excel/{excel_name}',
            'partial': chosen == partial,
            'scraped_at': data.get('scraped_at') or meta.get('scraped_at'),
            'error': meta.get('error'),
            'has_llm_fallback': bool(data.get('partial_llm_fallback')),
        })

    counts = {}
    for item in items:
        status = str(item.get('status') or 'unknown')
        counts[status] = counts.get(status, 0) + 1

    index = {
        'generated_at': now(),
        'count': len(items),
        'summary': {
            'universe_total': rows_total,
            'processed_total': processed,
            'remaining_total': max(rows_total - processed, 0) if rows_total else None,
            'published_total': len(items),
            'status_counts': counts,
            'sheet_status_counts': status_counts,
        },
        'items': items,
    }
    old = INDEX.read_text(encoding='utf-8') if INDEX.exists() else ''
    new = json.dumps(index, indent=2, ensure_ascii=False) + '\n'
    if old != new:
        INDEX.write_text(new, encoding='utf-8')
        changed += 1

    subprocess.run(['git', 'add', 'public/data/idx-official'], cwd=REPO, check=True)
    diff = subprocess.run(['git', 'diff', '--cached', '--quiet'], cwd=REPO)
    if diff.returncode == 0:
        return
    msg = f'Sync IDX official data ({len(items)} published)'
    subprocess.run(['git', 'commit', '-m', msg], cwd=REPO, check=True)
    subprocess.run(['git', 'push'], cwd=REPO, check=True)
    print(f'IDX official sync: pushed. changed_files_or_copies={changed} published={len(items)} processed={processed}/{rows_total}')

if __name__ == '__main__':
    main()
