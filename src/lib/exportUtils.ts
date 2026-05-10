import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export async function exportToPDF(data: any[], filename: string, title?: string) {
  const doc = new jsPDF('l', 'pt', 'a4');
  const timestamp = new Date().toLocaleString();
  const pdfTitle = title || filename.toUpperCase();

  // Header 
  doc.setFontSize(22);
  doc.setTextColor(15, 118, 110); // Emerald 700
  doc.text(pdfTitle, 40, 50);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generado el: ${timestamp}`, 40, 75);
  doc.text(`Sistema de Gestión de Intendencia`, 40, 88);

  if (!data || data.length === 0) {
    doc.text('No hay datos registrados para este reporte.', 40, 120);
  } else {
    const keys = Object.keys(data[0]);
    const headers = [keys.map(k => k.toUpperCase().replace(/_/g, ' '))];
    const body = data.map(item => keys.map(key => item[key]?.toString() || ''));

    autoTable(doc, {
      head: headers,
      body: body,
      startY: 110,
      styles: {
        fontSize: 9,
        cellPadding: 8,
        font: 'helvetica',
      },
      headStyles: {
        fillColor: [15, 118, 110], // Emerald 700
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center'
      },
      alternateRowStyles: {
        fillColor: [245, 247, 249]
      },
      margin: { top: 110, left: 40, right: 40, bottom: 40 },
      didDrawPage: (data) => {
        // Page number
        const str = `Página ${(doc as any).getNumberOfPages()}`;
        doc.setFontSize(10);
        const pageSize = doc.internal.pageSize;
        const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
        doc.text(str, data.settings.margin.left, pageHeight - 20);
      }
    });
  }

  const fullFileName = `${filename}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fullFileName);
}

export async function exportToExcel(data: any[], filename: string) {
  const sheets = [{ name: "Data", data }];
  await exportMultipleSheetsToExcel(sheets, filename);
}

export async function exportMultipleSheetsToExcel(sheets: {name: string, data: any[]}[], filename: string) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema de Gestión';
  workbook.created = new Date();

  sheets.forEach(sheet => {
    if (!sheet.data || sheet.data.length === 0) {
      const ws = workbook.addWorksheet(sheet.name);
      ws.addRow(['No hay datos registrados']);
      return;
    }

    const firstRow = sheet.data[0];
    const columns = Object.keys(firstRow).map(key => ({
      header: key.toUpperCase(),
      key: key,
      width: Math.max(key.length + 5, 15) // default width
    }));

    // Setup worksheet for beautiful printing
    const worksheet = workbook.addWorksheet(sheet.name, {
      pageSetup: {
        paperSize: 9, // A4
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 999, // Fit to 1 page wide, multiple pages tall
        margins: {
          left: 0.4, right: 0.4,
          top: 0.6, bottom: 0.6,
          header: 0.3, footer: 0.3
        },
        printTitlesRow: '1:1' // Repeat header rows on every page
      },
      headerFooter: {
        firstHeader: `&L&B${sheet.name}&R&BReporte Generado: &D`,
        evenHeader: `&L&B${sheet.name}&R&BReporte Generado: &D`,
        oddHeader: `&L&B${sheet.name}&R&BReporte Generado: &D`,
        firstFooter: `&LConfidencial&R&BPage &P of &N`,
        evenFooter: `&LConfidencial&R&BPage &P of &N`,
        oddFooter: `&LConfidencial&R&BPage &P of &N`,
      }
    });

    worksheet.columns = columns;

    // Add data
    sheet.data.forEach(item => {
      worksheet.addRow(item);
    });

    // Style the header
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0F766E' } // Techy/Elegant Emerald 700 
      };
      cell.font = {
        name: 'Segoe UI',
        color: { argb: 'FFFFFFFF' },
        bold: true,
        size: 11
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'medium', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };
    });
    headerRow.height = 30;

    // Auto-fit columns and style body
    worksheet.columns.forEach((col, idx) => {
      let maxLength = col.header ? col.header.length : 10;
      
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber > 1) { // Skip header
          const cell = row.getCell(idx + 1); // 1-based start
          const cellValue = cell.value ? cell.value.toString() : '';
          
          if (cellValue.length > maxLength) {
            maxLength = cellValue.length;
          }

          // Cell formatting
          cell.font = {
            name: 'Segoe UI',
            size: 10,
            color: { argb: 'FF1F2937' } // Gray 800
          };

          cell.alignment = {
            vertical: 'middle',
            horizontal: 'left',
            wrapText: true
          };

          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
          };

          // Zebra striping for better readability
          if (rowNumber % 2 === 0) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF3F4F6' } // Gray 100
            };
          } else {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFFFFF' } // White
            };
          }
        }
      });
      // Give column nice padded max width
      col.width = Math.min(maxLength + 4, 80); 
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  saveAsExcelFile(buffer, filename);
}

function saveAsExcelFile(buffer: any, fileName: string) {
  import('file-saver').then(FileSaver => {
    const EXCEL_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8';
    const EXCEL_EXTENSION = '.xlsx';
    const blob = new Blob([buffer], { type: EXCEL_TYPE });
    
    // Add date format correctly for file name
    const timestamp = new Date().toISOString().split('T')[0];
    const fullFileName = `${fileName}_${timestamp}${EXCEL_EXTENSION}`;
    
    FileSaver.default.saveAs(blob, fullFileName);
  });
}
