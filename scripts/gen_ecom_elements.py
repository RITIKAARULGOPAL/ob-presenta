# Regenerates src/lib/ecomExpressSlides.generated.ts from the extracted PPTX
# shape data at public/concept-library/ecom-express/elements/extracted.json.
# That JSON itself comes from python-pptx reading the original .pptx (see
# PROGRESS.md for the extraction commands) — this script only does the
# JSON -> FreeformElement[] TypeScript conversion. Run from the repo root:
#   python scripts/gen_ecom_elements.py
import json

data = json.load(open('public/concept-library/ecom-express/elements/extracted.json', encoding='utf-8'))

PT_TO_PX = 128.0 / 72.0  # px-equivalent per pt, in our 1280-wide canvas space
CANVAS_W = 1280.0
CANVAS_H = 720.0

# These six placeholders inherit their font size from the slide layout/master
# rather than carrying an explicit run size, so python-pptx can't recover it —
# set by eye against the PowerPoint-rendered reference PNGs instead.
TITLE_OVERRIDE = {
    'Design Concept': {'size': 9, 'bold': True, 'color': '#1a1a1a'},
    'Workplace Aspirations': {'size': 16, 'bold': True, 'color': '#1a1a1a'},
    'Brand Landscape': {'size': 16, 'bold': True, 'color': '#1a1a1a'},
    'Let us dive in to understanding ECOM a notch better.': {'size': 9, 'bold': False, 'color': '#595959'},
    'Design Cues': {'size': 16, 'bold': True, 'color': '#1a1a1a'},
    'Bringing the Workplace Aspiration & Brand Landscape together': {'size': 9, 'bold': False, 'color': '#595959'},
}


def esc(s):
    return s.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n')


def font_family_for(name):
    if name and 'courier' in name.lower():
        return 'monospace'
    return None


out = []
out.append('// AUTO-GENERATED from the E-Com Express reference deck via python-pptx.')
out.append('// Regenerate via scripts/gen_ecom_elements.py if the source slides ever change; do not hand-edit.')
out.append("import type { FreeformElement } from '@/types/slide';")
out.append('')

var_names = []
eid = 0
for s in data['slides']:
    idx = s['index']
    var = f'ECOM_SLIDE_{idx}_ELEMENTS'
    var_names.append(var)
    out.append(f'export const {var}: FreeformElement[] = [')
    for sh in s['shapes']:
        eid += 1
        x = round(sh['x'] / CANVAS_W, 5)
        y = round(sh['y'] / CANVAS_H, 5)
        w = round(sh['w'] / CANVAS_W, 5)
        h = round(sh['h'] / CANVAS_H, 5)
        if w <= 0 or h <= 0:
            continue
        if sh.get('image'):
            url = f"/concept-library/ecom-express/elements/{sh['image']}"
            out.append(f'  {{ id: "elem_{eid}", type: "image", x: {x}, y: {y}, w: {w}, h: {h}, url: "{url}" }},')
        elif sh.get('text'):
            full_text = ''.join(r['text'] for para in sh['text'] for r in para['runs'])
            override = TITLE_OVERRIDE.get(full_text.strip())
            paragraphs_ts = []
            sizes = []
            font_name = None
            for para in sh['text']:
                align_raw = para.get('align') or ''
                align = 'center' if 'CENTER' in align_raw else ('right' if 'RIGHT' in align_raw else 'left')
                runs_ts = []
                for r in para['runs']:
                    size = override['size'] if override else (r['size'] if r['size'] else None)
                    if size:
                        sizes.append(size)
                    color = override['color'] if override else r['color']
                    bold = override['bold'] if override else r['bold']
                    font_name = font_name or r.get('font')
                    color_field = f'"{color}"' if color else 'undefined'
                    runs_ts.append(
                        '{ text: "%s", bold: %s, italic: %s, color: %s }' % (
                            esc(r['text']),
                            'true' if bold else 'false',
                            'true' if r['italic'] else 'false',
                            color_field,
                        )
                    )
                paragraphs_ts.append('{ align: "%s", runs: [%s] }' % (align, ', '.join(runs_ts)))
            font_size_px = round((sizes[0] if sizes else 10) * PT_TO_PX, 2)
            family = font_family_for(font_name)
            family_field = f'"{family}"' if family else 'undefined'
            out.append(
                '  { id: "elem_%d", type: "text", x: %s, y: %s, w: %s, h: %s, fontSize: %s, fontFamily: %s, paragraphs: [%s] },'
                % (eid, x, y, w, h, font_size_px, family_field, ', '.join(paragraphs_ts))
            )
        elif sh.get('fillColor'):
            out.append(f'  {{ id: "elem_{eid}", type: "shape", x: {x}, y: {y}, w: {w}, h: {h}, color: "{sh["fillColor"]}" }},')
    out.append('];')
    out.append('')

with open('src/lib/ecomExpressSlides.generated.ts', 'w', encoding='utf-8') as f:
    f.write('\n'.join(out))
print('wrote', len(out), 'lines; vars:', var_names)
