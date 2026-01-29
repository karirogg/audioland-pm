// routes/pdf.js - PDF generation

const express = require('express');
const router = express.Router();
const { dbGet, dbAll } = require('../database/helpers');

router.get('/verkefni/:id/pdf', async (req, res) => {
  try {
    const v = await dbGet('SELECT * FROM verkefni WHERE id = ?', [req.params.id]);
    if (!v) return res.status(404).send('Verkefni fannst ekki');

    const timi = await dbAll(
      'SELECT * FROM timaskraning WHERE verkefni_id = ? ORDER BY dagsetning',
      [req.params.id]
    );
    const adkeypt = await dbAll(
      'SELECT * FROM adkeypt WHERE verkefni_id = ? ORDER BY created_at',
      [req.params.id]
    );

    const totalMin = timi
      .filter((t) => t.tegund === 'timi')
      .reduce((s, t) => s + (t.timi_minutur || 0), 0);
    const totalSimtol = timi.filter((t) => t.tegund === 'simtal').length;
    const totalEmail = timi.filter((t) => t.tegund === 'email').length;
    const totalFundir = timi.filter((t) => t.tegund === 'fundur').length;
    const totalAdkeypt = adkeypt.reduce((s, a) => s + (a.kostnadur || 0), 0);

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Tímaskýrsla - ${v.nafn}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #333; }
    h1 { color: #f5a623; border-bottom: 2px solid #f5a623; padding-bottom: 10px; }
    h2 { color: #555; margin-top: 30px; }
    .info { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 20px 0; }
    .info-item { padding: 8px; background: #f5f5f5; border-radius: 4px; }
    .info-label { font-weight: bold; color: #666; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5a623; color: #000; }
    .totals { display: flex; gap: 30px; padding: 20px; background: #f9f9f9; border-radius: 8px; margin-top: 30px; }
    .total-item { text-align: center; }
    .total-value { font-size: 24px; font-weight: bold; color: #f5a623; }
    .total-label { font-size: 12px; color: #666; }
    .cost-total { text-align: right; font-size: 18px; font-weight: bold; padding: 10px; background: #f5a623; color: #000; border-radius: 4px; margin-top: 10px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #999; text-align: center; }
  </style>
</head>
<body>
  <h1>Tímaskýrsla</h1>
  <h2>${v.nafn}</h2>

  <div class="info">
    <div class="info-item"><div class="info-label">Lesari</div>${v.lesari || '—'}</div>
    <div class="info-item"><div class="info-label">Staða</div>${v.stada}</div>
    <div class="info-item"><div class="info-label">Framleiðsla</div>${v.framleidsla || '—'}</div>
    <div class="info-item"><div class="info-label">Pródúser</div>${v.produser || '—'}</div>
    <div class="info-item"><div class="info-label">Auglýsingastofa</div>${v.stofa || '—'}</div>
    <div class="info-item"><div class="info-label">Tengiliður</div>${v.tengill_nafn || '—'}</div>
    <div class="info-item"><div class="info-label">Móttekið</div>${v.mottekid || '—'}</div>
    <div class="info-item"><div class="info-label">Skilað</div>${v.skilad || '—'}</div>
  </div>

  <h2>Tímaskráningar</h2>
  <table>
    <tr><th>Dags.</th><th>Tegund</th><th>Lýsing</th><th>Tími</th></tr>
    ${timi.map((t) => `<tr><td>${t.dagsetning || '—'}</td><td>${t.tegund}</td><td>${t.titill || '—'}</td><td>${t.timi_minutur ? t.timi_minutur + ' mín' : '—'}</td></tr>`).join('')}
  </table>

  <div class="totals">
    <div class="total-item"><div class="total-value">${totalMin}</div><div class="total-label">mínútur</div></div>
    <div class="total-item"><div class="total-value">${totalSimtol}</div><div class="total-label">símtöl</div></div>
    <div class="total-item"><div class="total-value">${totalEmail}</div><div class="total-label">email</div></div>
    <div class="total-item"><div class="total-value">${totalFundir}</div><div class="total-label">fundir</div></div>
  </div>

  ${adkeypt.length > 0 ? `
  <h2>Aðkeypt tónlist</h2>
  <table>
    <tr><th>Titill</th><th>Heimild</th><th style="text-align:right;">Kostnaður</th></tr>
    ${adkeypt.map((a) => `<tr><td>${a.titill || '—'}</td><td>${a.heimild || '—'}</td><td style="text-align:right;">${a.kostnadur ? a.kostnadur.toLocaleString('is-IS') + ' kr' : '—'}</td></tr>`).join('')}
  </table>
  <div class="cost-total">Samtals aðkeypt: ${totalAdkeypt.toLocaleString('is-IS')} kr</div>
  ` : ''}

  <div class="footer">Bessi - Audioland • ${new Date().toLocaleDateString('is-IS')}</div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
