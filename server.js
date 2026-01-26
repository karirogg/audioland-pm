require("dotenv").config();

const express = require("express");
const { WebSocketServer } = require("ws");
const http = require("http");
const path = require("path");
const {
  initDatabase,
  getDb,
  getTursoClient,
  isUsingTurso,
  saveDatabase,
} = require("./database");

const app = express();
const server = http.createServer(app);

const isProduction = process.env.NODE_ENV === "production";

// Ably setup for production
let ablyRest = null;
let boothChannel = null;

if (isProduction && process.env.ABLY_API_KEY) {
  const Ably = require("ably");
  ablyRest = new Ably.Rest(process.env.ABLY_API_KEY);
  boothChannel = ablyRest.channels.get("booth");
  console.log("Ably initialized for production");
}

// Booth state (used in both dev and prod)
let currentBoothState = {
  handrit: "",
  nafn: "",
  lesari: "",
  take: 1,
  fontSize: 2,
  autoScroll: false,
  scrollSpeed: 50,
};

// WebSocket setup for development only
let wss = null;
let boothClients = [];
let dashboardClients = [];

if (!isProduction) {
  wss = new WebSocketServer({ server });

  wss.on("connection", (ws, req) => {
    if (req.url === "/booth-ws") {
      boothClients.push(ws);
      console.log("Booth tengdist");
      ws.send(JSON.stringify({ type: "state", ...currentBoothState }));
      ws.on("close", () => {
        boothClients = boothClients.filter((c) => c !== ws);
        console.log("Booth aftengdist");
      });
    } else if (req.url === "/dashboard-ws") {
      dashboardClients.push(ws);
      console.log("Dashboard tengdist");
      ws.on("message", (msg) => {
        try {
          const data = JSON.parse(msg);
          if (data.type === "handrit") {
            currentBoothState = { ...currentBoothState, ...data };
            boothClients.forEach((c) => {
              if (c.readyState === 1) c.send(JSON.stringify(data));
            });
          }
        } catch (err) {}
      });
      ws.on("close", () => {
        dashboardClients = dashboardClients.filter((c) => c !== ws);
      });
    }
  });
}

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

// Broadcast to booth - works in both dev (WebSocket) and prod (Ably)
async function broadcastToBooth(data) {
  if (data.type === "handrit" || data.type === "settings") {
    currentBoothState = { ...currentBoothState, ...data };
  }

  if (isProduction && boothChannel) {
    // Production: publish to Ably (must await for serverless!)
    try {
      await boothChannel.publish("message", data);
      console.log("Ably publish success");
    } catch (err) {
      console.error("Ably publish error:", err);
      throw err;
    }
  } else {
    // Development: use WebSocket
    boothClients.forEach((c) => {
      if (c.readyState === 1) c.send(JSON.stringify(data));
    });
  }
}

// DB helpers - abstraction for both SQLite and Turso
async function dbAll(sql, params = []) {
  if (isUsingTurso()) {
    const client = getTursoClient();
    const result = await client.execute({ sql, args: params });
    return result.rows;
  } else {
    const db = getDb();
    const stmt = db.prepare(sql);
    if (params.length) stmt.bind(params);
    const results = [];
    while (stmt.step()) results.push(stmt.getAsObject());
    stmt.free();
    return results;
  }
}

async function dbGet(sql, params = []) {
  const results = await dbAll(sql, params);
  return results[0] || null;
}

async function dbRun(sql, params = []) {
  if (isUsingTurso()) {
    const client = getTursoClient();
    const result = await client.execute({ sql, args: params });
    return { lastInsertRowid: result.lastInsertRowid };
  } else {
    const db = getDb();
    db.run(sql, params);
    saveDatabase();
    return {
      lastInsertRowid: db.exec("SELECT last_insert_rowid()")[0]?.values[0][0],
    };
  }
}

// API - Verkefni
app.get("/api/verkefni", async (req, res) => {
  try {
    const verkefni = await dbAll(`
      SELECT v.*,
        COALESCE((SELECT SUM(timi_minutur) FROM timaskraning WHERE verkefni_id = v.id AND tegund = 'timi'), 0) as total_minutes
      FROM verkefni v
      ORDER BY v.created_at DESC
    `);
    res.json(verkefni);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/verkefni/:id", async (req, res) => {
  try {
    const verkefni = await dbGet("SELECT * FROM verkefni WHERE id = ?", [
      req.params.id,
    ]);
    if (!verkefni)
      return res.status(404).json({ error: "Verkefni fannst ekki" });
    res.json(verkefni);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/verkefni", async (req, res) => {
  try {
    const b = req.body;
    let google_doc_id = "";
    if (b.google_doc_url) {
      const match = b.google_doc_url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match) google_doc_id = match[1];
    }

    const result = await dbRun(
      `
      INSERT INTO verkefni (nafn, mynd, framleidsla, produser, produser_simi, produser_netfang,
        stofa, tengill_nafn, tengill_simi, tengill_netfang, art_director, art_director_simi,
        copywriter, copywriter_simi, lesari, handrit, google_doc_url, google_doc_id,
        tonlist_titill, tonlist_heimild, tonlist_url, tonlist_kostnadur,
        stada, athugasemdir, payday_tengill, dropbox_slod, mottekid, skilad)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `,
      [
        b.nafn || "",
        b.mynd || "",
        b.framleidsla || "",
        b.produser || "",
        b.produser_simi || "",
        b.produser_netfang || "",
        b.stofa || "",
        b.tengill_nafn || "",
        b.tengill_simi || "",
        b.tengill_netfang || "",
        b.art_director || "",
        b.art_director_simi || "",
        b.copywriter || "",
        b.copywriter_simi || "",
        b.lesari || "",
        b.handrit || "",
        b.google_doc_url || "",
        google_doc_id,
        b.tonlist_titill || "",
        b.tonlist_heimild || "",
        b.tonlist_url || "",
        b.tonlist_kostnadur || 0,
        b.stada || "Í vinnslu",
        b.athugasemdir || "",
        b.payday_tengill || "",
        b.dropbox_slod || "",
        b.mottekid || "",
        b.skilad || "",
      ],
    );
    res.json({ id: result.lastInsertRowid, message: "Verkefni búið til" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mynd upload - base64
app.post(
  "/api/verkefni/:id/mynd",
  express.json({ limit: "10mb" }),
  async (req, res) => {
    try {
      const { mynd } = req.body;
      if (!mynd) return res.status(400).json({ error: "Enga mynd" });

      await dbRun(
        "UPDATE verkefni SET mynd = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [mynd, req.params.id],
      );
      res.json({ message: "Mynd vistuð" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

app.put("/api/verkefni/:id", async (req, res) => {
  try {
    const b = req.body;
    let google_doc_id = "";
    if (b.google_doc_url) {
      const match = b.google_doc_url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match) google_doc_id = match[1];
    }

    await dbRun(
      `
      UPDATE verkefni SET nafn=?, mynd=?, framleidsla=?, produser=?, produser_simi=?, produser_netfang=?,
        stofa=?, tengill_nafn=?, tengill_simi=?, tengill_netfang=?, art_director=?, art_director_simi=?,
        copywriter=?, copywriter_simi=?, lesari=?, handrit=?, google_doc_url=?, google_doc_id=?,
        tonlist_titill=?, tonlist_heimild=?, tonlist_url=?, tonlist_kostnadur=?,
        stada=?, athugasemdir=?, payday_tengill=?, dropbox_slod=?, mottekid=?, skilad=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `,
      [
        b.nafn || "",
        b.mynd || "",
        b.framleidsla || "",
        b.produser || "",
        b.produser_simi || "",
        b.produser_netfang || "",
        b.stofa || "",
        b.tengill_nafn || "",
        b.tengill_simi || "",
        b.tengill_netfang || "",
        b.art_director || "",
        b.art_director_simi || "",
        b.copywriter || "",
        b.copywriter_simi || "",
        b.lesari || "",
        b.handrit || "",
        b.google_doc_url || "",
        google_doc_id,
        b.tonlist_titill || "",
        b.tonlist_heimild || "",
        b.tonlist_url || "",
        b.tonlist_kostnadur || 0,
        b.stada || "Í vinnslu",
        b.athugasemdir || "",
        b.payday_tengill || "",
        b.dropbox_slod || "",
        b.mottekid || "",
        b.skilad || "",
        req.params.id,
      ],
    );
    res.json({ message: "Verkefni uppfært" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/verkefni/:id", async (req, res) => {
  try {
    await dbRun("DELETE FROM verkefni WHERE id = ?", [req.params.id]);
    await dbRun("DELETE FROM timaskraning WHERE verkefni_id = ?", [
      req.params.id,
    ]);
    res.json({ message: "Verkefni eytt" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API - Tímaskráning
app.get("/api/verkefni/:id/timi", async (req, res) => {
  try {
    const timi = await dbAll(
      "SELECT * FROM timaskraning WHERE verkefni_id = ? ORDER BY dagsetning DESC",
      [req.params.id],
    );
    res.json(timi);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/verkefni/:id/timi", async (req, res) => {
  try {
    const { tegund, titill, lysing, timi_minutur, dagsetning } = req.body;
    const result = await dbRun(
      `
      INSERT INTO timaskraning (verkefni_id, tegund, titill, lysing, timi_minutur, dagsetning)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
      [
        req.params.id,
        tegund || "",
        titill || "",
        lysing || "",
        timi_minutur || 0,
        dagsetning || "",
      ],
    );
    res.json({ id: result.lastInsertRowid, message: "Tímaskráning bætt við" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/timi/:id", async (req, res) => {
  try {
    await dbRun("DELETE FROM timaskraning WHERE id = ?", [req.params.id]);
    res.json({ message: "Tímaskráning eytt" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API - Stofur og Framleiðsla
app.get("/api/stofur", async (req, res) => {
  try {
    res.json(await dbAll("SELECT * FROM auglysingar_stofur ORDER BY nafn"));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/framleidsla", async (req, res) => {
  try {
    res.json(await dbAll("SELECT * FROM framleidsla ORDER BY nafn"));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API - Aðkeypt tónlist
app.get("/api/verkefni/:id/adkeypt", async (req, res) => {
  try {
    const adkeypt = await dbAll(
      "SELECT * FROM adkeypt WHERE verkefni_id = ? ORDER BY created_at DESC",
      [req.params.id],
    );
    res.json(adkeypt);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/verkefni/:id/adkeypt", async (req, res) => {
  try {
    const { titill, heimild, url, kostnadur } = req.body;
    const result = await dbRun(
      `
      INSERT INTO adkeypt (verkefni_id, titill, heimild, url, kostnadur)
      VALUES (?, ?, ?, ?, ?)
    `,
      [req.params.id, titill || "", heimild || "", url || "", kostnadur || 0],
    );
    res.json({ id: result.lastInsertRowid, message: "Lagi bætt við" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/adkeypt/:id", async (req, res) => {
  try {
    await dbRun("DELETE FROM adkeypt WHERE id = ?", [req.params.id]);
    res.json({ message: "Lagi eytt" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API - PDF
app.get("/api/verkefni/:id/pdf", async (req, res) => {
  try {
    const v = await dbGet("SELECT * FROM verkefni WHERE id = ?", [
      req.params.id,
    ]);
    if (!v) return res.status(404).send("Verkefni fannst ekki");

    const timi = await dbAll(
      "SELECT * FROM timaskraning WHERE verkefni_id = ? ORDER BY dagsetning",
      [req.params.id],
    );
    const adkeypt = await dbAll(
      "SELECT * FROM adkeypt WHERE verkefni_id = ? ORDER BY created_at",
      [req.params.id],
    );

    const totalMin = timi
      .filter((t) => t.tegund === "timi")
      .reduce((s, t) => s + (t.timi_minutur || 0), 0);
    const totalSimtol = timi.filter((t) => t.tegund === "simtal").length;
    const totalEmail = timi.filter((t) => t.tegund === "email").length;
    const totalFundir = timi.filter((t) => t.tegund === "fundur").length;
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
    <div class="info-item"><div class="info-label">Lesari</div>${v.lesari || "—"}</div>
    <div class="info-item"><div class="info-label">Staða</div>${v.stada}</div>
    <div class="info-item"><div class="info-label">Framleiðsla</div>${v.framleidsla || "—"}</div>
    <div class="info-item"><div class="info-label">Pródúser</div>${v.produser || "—"}</div>
    <div class="info-item"><div class="info-label">Auglýsingastofa</div>${v.stofa || "—"}</div>
    <div class="info-item"><div class="info-label">Tengiliður</div>${v.tengill_nafn || "—"}</div>
    <div class="info-item"><div class="info-label">Móttekið</div>${v.mottekid || "—"}</div>
    <div class="info-item"><div class="info-label">Skilað</div>${v.skilad || "—"}</div>
  </div>

  <h2>Tímaskráningar</h2>
  <table>
    <tr><th>Dags.</th><th>Tegund</th><th>Lýsing</th><th>Tími</th></tr>
    ${timi.map((t) => `<tr><td>${t.dagsetning || "—"}</td><td>${t.tegund}</td><td>${t.titill || "—"}</td><td>${t.timi_minutur ? t.timi_minutur + " mín" : "—"}</td></tr>`).join("")}
  </table>

  <div class="totals">
    <div class="total-item"><div class="total-value">${totalMin}</div><div class="total-label">mínútur</div></div>
    <div class="total-item"><div class="total-value">${totalSimtol}</div><div class="total-label">símtöl</div></div>
    <div class="total-item"><div class="total-value">${totalEmail}</div><div class="total-label">email</div></div>
    <div class="total-item"><div class="total-value">${totalFundir}</div><div class="total-label">fundir</div></div>
  </div>

  ${
    adkeypt.length > 0
      ? `
  <h2>Aðkeypt tónlist</h2>
  <table>
    <tr><th>Titill</th><th>Heimild</th><th style="text-align:right;">Kostnaður</th></tr>
    ${adkeypt.map((a) => `<tr><td>${a.titill || "—"}</td><td>${a.heimild || "—"}</td><td style="text-align:right;">${a.kostnadur ? a.kostnadur.toLocaleString("is-IS") + " kr" : "—"}</td></tr>`).join("")}
  </table>
  <div class="cost-total">Samtals aðkeypt: ${totalAdkeypt.toLocaleString("is-IS")} kr</div>
  `
      : ""
  }

  <div class="footer">Bessi - Audioland • ${new Date().toLocaleDateString("is-IS")}</div>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Google Docs API - fetches public docs via export URL
app.get("/api/google-doc/:docId", async (req, res) => {
  try {
    const url = `https://docs.google.com/document/d/${req.params.docId}/export?format=txt`;
    const response = await fetch(url);

    if (!response.ok) {
      return res
        .status(response.status)
        .json({
          error:
            'Villa við að sækja skjal - athugaðu að það sé opið fyrir "Anyone with the link"',
        });
    }

    const content = await response.text();
    res.json({ content });
  } catch (err) {
    console.error("Google Doc villa:", err.message);
    res.status(500).json({ error: "Villa við að sækja skjal: " + err.message });
  }
});

// Ably token auth for clients (production only)
app.get("/api/ably-token", async (req, res) => {
  if (!isProduction || !ablyRest) {
    return res
      .status(400)
      .json({ error: "Ably not available in development mode" });
  }

  try {
    const tokenRequest = await ablyRest.auth.createTokenRequest({
      capability: { booth: ["subscribe", "history"] },
    });
    res.json(tokenRequest);
  } catch (err) {
    console.error("Ably token error:", err);
    res.status(500).json({ error: "Failed to create token" });
  }
});

// Get current booth state
app.get("/api/booth/state", (req, res) => {
  res.json(currentBoothState);
});

// Config endpoint - tells client whether to use Ably or WebSocket
app.get("/api/config", (req, res) => {
  res.json({
    useAbly: isProduction && !!process.env.ABLY_API_KEY,
    nodeEnv: process.env.NODE_ENV || "development",
  });
});

// Senda í booth
app.post("/api/booth/send", async (req, res) => {
  const { nafn, handrit, lesari, take, googleDocId } = req.body;
  try {
    await broadcastToBooth({
      type: "handrit",
      nafn,
      handrit,
      lesari,
      googleDocId,
      take: take || 1,
    });
    res.json({ message: "Sent í booth" });
  } catch (err) {
    console.error("Booth send error:", err);
    res.status(500).json({ error: "Failed to send to booth" });
  }
});

// Start
const PORT = process.env.PORT || 3001;

initDatabase()
  .then(() => {
    server.listen(PORT, () => {
      console.log("🐕 Bessi keyrir á http://localhost:" + PORT);
      console.log("   Mode:", process.env.NODE_ENV || "development");
      console.log("   Database:", isUsingTurso() ? "Turso" : "SQLite");
    });
  })
  .catch((err) => {
    console.error("Villa við database:", err);
    process.exit(1);
  });
