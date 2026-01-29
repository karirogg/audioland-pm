// routes/google-docs.js - Google Docs proxy

const express = require('express');
const router = express.Router();

router.get('/google-doc/:docId', async (req, res) => {
  try {
    const url = `https://docs.google.com/document/d/${req.params.docId}/export?format=txt`;
    const response = await fetch(url);

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Villa við að sækja skjal - athugaðu að það sé opið fyrir "Anyone with the link"',
      });
    }

    const content = await response.text();
    res.json({ content });
  } catch (err) {
    console.error('Google Doc villa:', err.message);
    res.status(500).json({ error: 'Villa við að sækja skjal: ' + err.message });
  }
});

module.exports = router;
