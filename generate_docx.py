import docx
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

doc = docx.Document()

# Page Margins
sections = doc.sections
for section in sections:
    section.top_margin = Inches(0.7)
    section.bottom_margin = Inches(0.7)
    section.left_margin = Inches(0.8)
    section.right_margin = Inches(0.8)

# Styles
style = doc.styles['Normal']
font = style.font
font.name = 'Arial'
font.size = Pt(10)
font.color.rgb = RGBColor(0x1e, 0x29, 0x3b)

# Title
title_p = doc.add_paragraph()
title_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
title_run = title_p.add_run('СОГЛАШЕНИЕ О КОНФИДЕНЦИАЛЬНОСТИ (NDA)')
title_run.bold = True
title_run.font.size = Pt(13)
title_run.font.color.rgb = RGBColor(0x0f, 0x17, 0x2a)

sub_p = doc.add_paragraph()
sub_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
sub_run = sub_p.add_run('о защите коммерческой тайны, проектной документации и цифровых моделей (BIM)')
sub_run.font.size = Pt(9.5)
sub_run.font.italic = True
sub_run.font.color.rgb = RGBColor(0x64, 0x74, 0x8b)

# City & Date Table
cd_table = doc.add_table(rows=1, cols=2)
cd_table.alignment = WD_TABLE_ALIGNMENT.CENTER
cd_table.autofit = False
cd_table.columns[0].width = Inches(3.4)
cd_table.columns[1].width = Inches(3.4)

cd_left = cd_table.cell(0, 0).paragraphs[0]
cd_left.add_run('г. ________________________').bold = True

cd_right = cd_table.cell(0, 1).paragraphs[0]
cd_right.alignment = WD_ALIGN_PARAGRAPH.RIGHT
cd_right.add_run('«___» ____________ 202_ г.').bold = True

p_space = doc.add_paragraph()
p_space.paragraph_format.space_before = Pt(4)
p_space.paragraph_format.space_after = Pt(4)

# Preamble
p_pre = doc.add_paragraph()
p_pre.paragraph_format.space_after = Pt(6)
p_pre.paragraph_format.line_spacing = 1.15
r = p_pre.add_run('Заказчик (Раскрывающая сторона): ')
r.bold = True
p_pre.add_run('____________________________________________________________________________________, в лице ________________________________________________, действующего на основании ________________________________, с одной стороны, и\n')

r2 = p_pre.add_run('Исполнитель (Получающая сторона): ')
r2.bold = True
p_pre.add_run('Индивидуальный предприниматель Искаков Дмитрий Рашитович (ИП Искаков Д.Р.), бренд проектного производства BIMTWIN, действующий на основании Талона о государственной регистрации индивидуального предпринимателя, с другой стороны,\nдалее совместно именуемые «Стороны», заключили настоящее Соглашение о нижеследующем:')

def add_heading(text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.keep_with_next = True
    run = p.add_run(text)
    run.bold = True
    run.font.size = Pt(10.5)
    run.font.color.rgb = RGBColor(0x0f, 0x17, 0x2a)

def add_p(text, bold_prefix=""):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.line_spacing = 1.15
    if bold_prefix:
        r_b = p.add_run(bold_prefix)
        r_b.bold = True
    p.add_run(text)

# 1. Subject
add_heading('1. Предмет Соглашения')
add_p('1.1. Стороны намерены осуществлять расчетно-техническое и проектное взаимодействие, включая передачу исходных материалов для предварительной оценки, выполнения BIM-моделирования, разработки разделов проектной и рабочей документации, независимого BIM-аудита, координации разделов, поиска междисциплинарных коллизий (Clash Detection в Navisworks / Revit) и верификации объемов материалов (QTO) в отношении Объекта (Объектов) Заказчика:')
add_p(' _________________________________________________________________________________________________', 'Наименование / строительный адрес объекта:')
add_p(' ________________________________________ (далее — «Объект»).', 'Ориентировочная площадь / характеристики:')
add_p('1.2. В целях исполнения указанных задач Раскрывающая сторона предоставляет Получающей стороне доступ к исходной исходно-разрешительной, архитектурной, конструктивной, инженерной, технологической и сопутствующей документации.')

# 2. Definition
add_heading('2. Понятие Конфиденциальной информации')
add_p('2.1. Под «Конфиденциальной информацией» понимаются любые сведения, передаваемые в любой доступной форме (электронной, цифровой, графической, бумажной, устной), включая, но не ограничиваясь:')

bullets = [
    'Архитектурно-градостроительные концепции, эскизы, объемно-планировочные решения;',
    'Проектную и рабочую документацию в форматах DWG, DXF, PDF, сканированные чертежи по разделам АР, КР, ОВ, ВК, ЭОМ, СС, ТМ, ГП и др.;',
    'Цифровые информационные модели (BIM) в исходных и обменных форматах (Autodesk Revit .RVT, IFC, Navisworks .NWD/.NWC, CAD);',
    'Спецификации оборудования, ведомости объемов работ (ВОР), сметные расчеты, коммерческие предложения;',
    'Информацию о подрядчиках, поставщиках, субпроектировщиках, бюджетах, сроках реализации и коммерческих условиях проекта.'
]
for b in bullets:
    p_b = doc.add_paragraph(style='List Bullet')
    p_b.paragraph_format.space_after = Pt(2)
    p_b.paragraph_format.line_spacing = 1.15
    p_b.add_run(b)

add_p('Все передаваемые Заказчиком материалы, чертежи, спецификации, а также производные цифровые BIM-модели остаются исключительной собственностью Заказчика и ни при каких обстоятельствах не могут быть переданы третьим лицам, опубликованы в портфолио, на сайтах или в социальных сетях без прямого письменного согласия Заказчика.', 'Гарантия нераспространения: ')

# 3. Obligations
add_heading('3. Обязательства Получающей стороны')
add_p('3.1. Получающая сторона безоговорочно обязуется:')
bullets_ob = [
    'Использовать полученную Конфиденциальную информацию исключительно для целей оценки, моделирования, аудита и выпуска документации по согласованному Объекту;',
    'Обеспечить режим строгой конфиденциальности и предоставлять доступ к информации только тем специалистам и инженерам, которым такой доступ объективно необходим для выполнения работ;',
    'Не копировать, не воспроизводить и не передавать материалы третьим лицам без предварительного письменного согласия Раскрывающей стороны;',
    'Хранить электронные файлы и базы данных в защищенной цифровой среде с ограничением прав доступа;',
    'По письменному требованию Раскрывающей стороны либо по завершении взаимных обязательств незамедлительно уничтожить или возвратить все предоставленные материалы и их цифровые копии.'
]
for b in bullets_ob:
    p_b = doc.add_paragraph(style='List Bullet')
    p_b.paragraph_format.space_after = Pt(2)
    p_b.paragraph_format.line_spacing = 1.15
    p_b.add_run(b)

# 4. Exceptions
add_heading('4. Исключения из конфиденциальности')
add_p('4.1. Обязательства по сохранению тайны не распространяются на сведения, которые являются общеизвестными, были официально известны Получающей стороне до их раскрытия, либо подлежат раскрытию по законному требованию государственных органов или суда.')

# 5. Term
add_heading('5. Срок действия Соглашения')
add_p('5.1. Настоящее Соглашение вступает в силу с даты его подписания (включая обмен подписанными скан-копиями по электронной почте или в мессенджерах) и сохраняет свою силу в течение 3 (трех) лет с даты подписания.')

# 6. Liability
add_heading('6. Ответственность Сторон')
add_p('6.1. В случае нарушения обязательств виновная Сторона обязуется возместить другой Стороне документально подтвержденный реальный ущерб в порядке, предусмотренном действующим законодательством.')

# 7. Signatures & Requisites
add_heading('7. Реквизиты и подписи Сторон')

tbl = doc.add_table(rows=1, cols=2)
tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
tbl.autofit = False
tbl.columns[0].width = Inches(3.4)
tbl.columns[1].width = Inches(3.4)

# Set borders
def set_cell_border(cell, **kwargs):
    tcPr = cell._tc.get_or_add_tcPr()
    tcBorders = tcPr.first_child_found_in("w:tcBorders")
    if tcBorders is None:
        tcBorders = OxmlElement('w:tcBorders')
        tcPr.append(tcBorders)
    for edge in ('top', 'left', 'bottom', 'right'):
        edge_data = kwargs.get(edge)
        if edge_data:
            tag = 'w:{}'.format(edge)
            element = tcBorders.find(qn(tag))
            if element is None:
                element = OxmlElement(tag)
                tcBorders.append(element)
            for key, val in edge_data.items():
                element.set(qn('w:{}'.format(key)), str(val))

cell_left = tbl.cell(0, 0)
cell_right = tbl.cell(0, 1)

# Format left cell (Client)
p_cl_h = cell_left.paragraphs[0]
p_cl_h.paragraph_format.space_after = Pt(4)
r = p_cl_h.add_run('ЗАКАЗЧИК:')
r.bold = True
r.font.size = Pt(9.5)

p_cl_b = cell_left.add_paragraph()
p_cl_b.paragraph_format.line_spacing = 1.2
p_cl_b.paragraph_format.space_after = Pt(12)
p_cl_b.add_run('Организация / ФИО:\n_________________________________________\n')
p_cl_b.add_run('БИН / ИИН / Рег. №:\n_________________________________________\n')
p_cl_b.add_run('Адрес:\n_________________________________________\n')
p_cl_b.add_run('Телефон / Email:\n_________________________________________\n')
p_cl_b.add_run('Банк / Расчетный счет (IBAN):\n_________________________________________\n\n')
p_cl_b.add_run('Подпись: ______________________ (М.П.)')

# Format right cell (Contractor)
p_co_h = cell_right.paragraphs[0]
p_co_h.paragraph_format.space_after = Pt(4)
r = p_co_h.add_run('ИСПОЛНИТЕЛЬ:')
r.bold = True
r.font.size = Pt(9.5)

p_co_b = cell_right.add_paragraph()
p_co_b.paragraph_format.line_spacing = 1.2
p_co_b.paragraph_format.space_after = Pt(12)
p_co_b.add_run('ИП Искаков Д.Р.\n').bold = True
p_co_b.add_run('BIMTWIN Production\n')
p_co_b.add_run('ИИН: 840405350469\n')
p_co_b.add_run('Адрес: 110000, РК, г. Костанай, ул. Абая 28/1\n')
p_co_b.add_run('Банк: АО «Kaspi Bank»\n')
p_co_b.add_run('ИИК: KZ14722S000029502043 (KZT)\n')
p_co_b.add_run('БИК: CASPKZKA\n')
p_co_b.add_run('Email: iskakovd0504@gmail.com\n')
p_co_b.add_run('Тел.: +7 (777) 555-67-89\n')
p_co_b.add_run('Сайт: https://bimtwin.kz\n\n')
p_co_b.add_run('Подпись: ___________________ / Искаков Д.Р. (М.П.)')

# Save document
doc.save('nda.docx')
print("Successfully generated nda.docx")
