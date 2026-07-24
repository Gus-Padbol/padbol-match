const mockToFile = jest.fn();

jest.mock('write-excel-file/browser', () => ({
  __esModule: true,
  default: jest.fn(() => ({ toFile: mockToFile })),
}));

import {
  appendJsonWorksheet,
  createExcelWorkbook,
  downloadExcelWorkbook,
} from './excelWorkbook';

describe('excelWorkbook', () => {
  beforeEach(() => {
    const writeExcelFile = require('write-excel-file/browser').default;
    writeExcelFile.mockReturnValue({ toFile: mockToFile });
  });

  test('crea una hoja con encabezados, filas y nombre seguro', () => {
    const workbook = createExcelWorkbook();
    const sheet = appendJsonWorksheet(
      workbook,
      [
        { Nombre: 'Ana', Puntos: 12 },
        { Nombre: 'Leo', Puntos: 8 },
      ],
      'Jugadores / Ranking'
    );

    expect(sheet.sheet).toBe('Jugadores   Ranking');
    expect(sheet.data[0]).toEqual([
      { value: 'Nombre', fontWeight: 'bold' },
      { value: 'Puntos', fontWeight: 'bold' },
    ]);
    expect(sheet.data[1]).toEqual(['Ana', 12]);
    expect(sheet.stickyRowsCount).toBe(1);
  });

  test('entrega todas las hojas al generador y descarga el nombre solicitado', async () => {
    const workbook = createExcelWorkbook();
    appendJsonWorksheet(workbook, [{ Total: 25 }], 'Resumen');

    await downloadExcelWorkbook(workbook, 'reporte.xlsx');

    const writeExcelFile = require('write-excel-file/browser').default;
    expect(writeExcelFile).toHaveBeenCalledWith(workbook.sheets);
    expect(mockToFile).toHaveBeenCalledWith('reporte.xlsx');
  });
});
