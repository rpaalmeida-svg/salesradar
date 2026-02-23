const XLSX = require('xlsx');

function parseExcel(buffer) {
  const wb = XLSX.read(buffer, { cellStyles: true });
  const sh = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null });

  const countSpaces = s => s ? s.match(/^(\s*)/)?.[1].length || 0 : 0;

  const extractYear = s => {
    const match = s?.match(/\d{4}/);
    return match ? parseInt(match[0]) : new Date().getFullYear();
  };

  // Encontrar a coluna com valores: procurar a última coluna numérica nas linhas de marca (sp=20)
  let valueCol = 1; // default coluna B
  for (let i = 0; i < Math.min(100, sh.length); i++) {
    const row = sh[i];
    if (row && row[0] && countSpaces(String(row[0])) === 20) {
      // Linha de marca — procurar o último valor numérico
      for (let j = row.length - 1; j >= 1; j--) {
        if (row[j] !== null && row[j] !== undefined && typeof row[j] === 'number') {
          valueCol = j;
          break;
        }
      }
      if (valueCol > 1) break; // encontrou coluna diferente da B
    }
  }

  console.log(`📊 Parser: usando coluna ${valueCol} para valores`);

  const dados = [];
  let mes, mesYear, cli, cat;

  sh.forEach(row => {
    const c = row[0] ? String(row[0]) : null;
    const v = row[valueCol];

    if (c) {
      const sp = countSpaces(c);
      const t = c.trim();

      if (sp === 5) {
        mes = t;
        mesYear = extractYear(t);
        cli = null;
        cat = null;
      } else if (sp === 10) {
        cli = t;
        cat = null;
      } else if (sp === 15) {
        cat = t.includes('Todos / Se puede vender /')
          ? t.replace('Todos / Se puede vender / ', '').trim()
          : t === 'Todos / Se puede vender'
            ? 'Gastos envio'
            : t;
      } else if (sp === 20 && mes && cli && cat) {
        dados.push({
          mes,
          year: mesYear,
          cliente: cli,
          categoria: cat,
          marca: t,
          valor: typeof v === 'number' ? v : parseFloat(v) || 0
        });
      }
    }
  });

  console.log(`📊 Parser: ${dados.length} registos extraídos`);
  return dados;
}

module.exports = { parseExcel };