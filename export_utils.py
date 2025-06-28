# export_utils.py – Finalized Export Helpers
import io
import pandas as pd
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from pptx import Presentation
from pptx.util import Inches

def to_excel_bytes(bundle: dict) -> bytes:
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        pd.DataFrame([bundle['Metadata']]).to_excel(writer, sheet_name='Metadata', index=False)
        pd.DataFrame([bundle['Capture']]).to_excel(writer, sheet_name='Form Inputs', index=False)
        pd.DataFrame.from_dict(bundle['Recommendations'], orient='index').to_excel(writer, sheet_name='Recommendations')
        pd.DataFrame.from_dict(bundle.get('Opportunities', {}), orient='index').to_excel(writer, sheet_name='Opportunities')
    return output.getvalue()

def to_pdf_bytes(bundle: dict) -> bytes:
    output = io.BytesIO()
    c = canvas.Canvas(output, pagesize=letter)
    text = c.beginText(50, 750)
    text.setFont("Helvetica", 10)
    text.textLine("SHI Field Configurator – PDF Export")
    text.textLine(f"Date: {bundle['Metadata'].get('visit_date')}")
    text.textLine("---")
    for section, recs in bundle['Recommendations'].items():
        text.textLine(f"{section}:")
        for rec in recs:
            text.textLine(f"  - {rec['recommend'][:90]}...")
    c.drawText(text)
    c.showPage()
    c.save()
    return output.getvalue()

def to_pptx_bytes(bundle: dict) -> bytes:
    prs = Presentation()
    title_slide = prs.slides.add_slide(prs.slide_layouts[0])
    title_slide.shapes.title.text = "SHI Field Configurator"
    title_slide.placeholders[1].text = f"{bundle['Metadata']['account_name']} – {bundle['Metadata']['visit_date']}"

    for section, recs in bundle['Recommendations'].items():
        slide = prs.slides.add_slide(prs.slide_layouts[1])
        slide.shapes.title.text = section
        content = slide.placeholders[1].text_frame
        for rec in recs:
            p = content.add_paragraph()
            p.text = f"- {rec['recommend'][:150]}"

    output = io.BytesIO()
    prs.save(output)
    return output.getvalue()
