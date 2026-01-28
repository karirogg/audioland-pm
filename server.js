/**
 * Bessi - Audioland Verkefnastjórnun
 *
 * Express server sem þjónar REST API og WebSocket fyrir
 * verkefnastjórnunarkerfi Audioland hljóðvers.
 *
 * @module server
 * @author Audioland ehf
 * @version 2.0.0
 */

require("dotenv").config();

const express = require("express");
const { WebSocketServer } = require("ws");
const http = require("http");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const { initDatabase, getSupabase } = require("./database");

// ============================================================================
// STILLINGAR OG UPPSETNING
// ============================================================================

const app = express();
const server = http.createServer(app);
const isProduction = process.env.NODE_ENV === "production";
const PORT = process.env.PORT || 3001;

// Supabase stillingar
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Express stillingar
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

if (isProduction) {
  app.set("trust proxy", 1);
}

// ============================================================================
// ABLY UPPSETNING (PRODUCTION WEBSOCKET)
// ============================================================================

let ablyRest = null;
let boothChannel = null;

if (isProduction && process.env.ABLY_API_KEY) {
  const Ably = require("ably");
  ablyRest = new Ably.Rest(process.env.ABLY_API_KEY);
  boothChannel = ablyRest.channels.get("booth");
  console.log("Ably initialized for production");
}

// ============================================================================
// BOOTH STATE OG WEBSOCKET (DEVELOPMENT)
// ============================================================================

/**
 * Núverandi staða booth skjásins
 * @type {Object}
 */
let currentBoothState = {
  handrit: "",
  nafn: "",
  lesari: "",
  take: 1,
  fontSize: 2,
  autoScroll: false,
  scrollSpeed: 50,
};

// WebSocket fyrir development
let wss = null;
let boothClients = [];
let dashboardClients = [];

if (!isProduction) {
  wss = new WebSocketServer({ server });

  wss.on("connection", (ws, req) => {
    if (req.url === "/booth-ws") {
      handleBoothConnection(ws);
    } else if (req.url === "/dashboard-ws") {
      handleDashboardConnection(ws);
    }
  });
}

/**
 * Meðhöndla tengingu frá booth client
 * @param {WebSocket} ws - WebSocket tenging
 */
function handleBoothConnection(ws) {
  boothClients.push(ws);
  console.log("Booth tengdist");

  // Senda núverandi state
  ws.send(JSON.stringify({ type: "state", ...currentBoothState }));

  ws.on("close", () => {
    boothClients = boothClients.filter((c) => c !== ws);
    console.log("Booth aftengdist");
  });
}

/**
 * Meðhöndla tengingu frá dashboard client
 * @param {WebSocket} ws - WebSocket tenging
 */
function handleDashboardConnection(ws) {
  dashboardClients.push(ws);
  console.log("Dashboard tengdist");

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.type === "handrit") {
        currentBoothState = { ...currentBoothState, ...data };
        broadcastToBoothClients(data);
      }
    } catch (err) {
      console.error("WebSocket message error:", err);
    }
  });

  ws.on("close", () => {
    dashboardClients = dashboardClients.filter((c) => c !== ws);
  });
}

/**
 * Senda skilaboð til allra booth clients
 * @param {Object} data - Gögn til að senda
 */
function broadcastToBoothClients(data) {
  boothClients.forEach((c) => {
    if (c.readyState === 1) {
      c.send(JSON.stringify(data));
    }
  });
}

/**
 * Senda gögn til booth (bæði dev og prod)
 * @param {Object} data - Gögn til að senda
 */
async function broadcastToBooth(data) {
  // Uppfæra local state
  if (data.type === "handrit" || data.type === "settings") {
    currentBoothState = { ...currentBoothState, ...data };
  }

  // Senda til clients
  if (isProduction && boothChannel) {
    try {
      await boothChannel.publish("message", data);
      console.log("Ably publish success");
    } catch (err) {
      console.error("Ably publish error:", err);
      throw err;
    }
  } else {
    broadcastToBoothClients(data);
  }
}

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

/**
 * Sækja notanda úr JWT token
 * @param {Request} req - Express request
 * @returns {Promise<Object|null>} Notandaupplýsingar eða null
 */
async function getUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = getSupabase();

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return null;
    }

    // Sækja user profile með is_admin
    const { data: profile } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    return profile || { id: user.id, email: user.email, is_admin: false };
  } catch (err) {
    console.error("Auth error:", err);
    return null;
  }
}

/**
 * Búa til Supabase client með notanda JWT fyrir RLS
 * @param {Request} req - Express request
 * @returns {SupabaseClient} Supabase client
 */
function getSupabaseForUser(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return createClient(supabaseUrl, supabaseAnonKey);
  }

  const token = authHeader.replace("Bearer ", "");
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

/**
 * Middleware sem krefst innskráningar
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Þú þarft að skrá þig inn" });
  }
  next();
}

// Vörn á API routes
const PUBLIC_PATHS = [
  "/config",
  "/booth/state",
  "/ably-token",
  "/stofur",
  "/framleidsla",
];

app.use("/api", (req, res, next) => {
  // Leyfa public endpoints
  if (PUBLIC_PATHS.includes(req.path) ||
      req.path.startsWith("/booth/") ||
      req.path.startsWith("/google-doc/")) {
    return next();
  }
  return requireAuth(req, res, next);
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Draga Google Doc ID úr URL
 * @param {string} url - Google Docs URL
 * @returns {string} Doc ID eða tómur strengur
 */
function extractGoogleDocId(url) {
  if (!url) return "";
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : "";
}

/**
 * Búa til verkefnanúmer: YYMM-NNN
 * @param {SupabaseClient} supabase - Supabase client
 * @returns {Promise<string>} Verkefnanúmer
 */
async function generateVerkefnanumer(supabase) {
  const now = new Date();
  const prefix = now.toISOString().slice(2, 4) + now.toISOString().slice(5, 7);

  const { data: existing } = await supabase
    .from("verkefni")
    .select("verkefnanumer")
    .like("verkefnanumer", `${prefix}-%`)
    .order("verkefnanumer", { ascending: false })
    .limit(1);

  let seq = 1;
  if (existing?.length > 0 && existing[0].verkefnanumer) {
    const lastNum = parseInt(existing[0].verkefnanumer.split("-")[1]) || 0;
    seq = lastNum + 1;
  }

  return `${prefix}-${String(seq).padStart(3, "0")}`;
}

/**
 * Standard error handler fyrir API
 * @param {Response} res - Express response
 * @param {Error} err - Villa
 * @param {number} status - HTTP status (default 500)
 */
function handleApiError(res, err, status = 500) {
  console.error("API Error:", err.message);
  res.status(status).json({ error: err.message });
}

// ============================================================================
// API ROUTES - CONFIG & AUTH
// ============================================================================

/**
 * GET /api/config
 * Skilar client stillingar (Supabase URL og anon key)
 */
app.get("/api/config", (req, res) => {
  res.json({
    useAbly: isProduction && !!process.env.ABLY_API_KEY,
    nodeEnv: process.env.NODE_ENV || "development",
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  });
});

/**
 * GET /api/auth/user
 * Skilar upplýsingum um innskráðan notanda
 */
app.get("/api/auth/user", async (req, res) => {
  const user = await getUser(req);
  if (user) {
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.nafn,
        mynd: user.mynd,
        is_admin: user.is_admin,
      },
    });
  } else {
    res.json({ user: null });
  }
});

// ============================================================================
// API ROUTES - VERKEFNI (PROJECTS)
// ============================================================================

/**
 * GET /api/verkefni
 * Sækja öll verkefni með tímaskráningum
 */
app.get("/api/verkefni", async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req);

    const { data, error } = await supabase
      .from("verkefni")
      .select(`
        *,
        users!verkefni_user_id_fkey(nafn),
        timaskraning(timi_minutur, tegund)
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Reikna samtölur og hreinsa gögn
    const verkefni = data.map((v) => ({
      ...v,
      owner_name: v.users?.nafn,
      total_minutes: v.timaskraning
        ?.filter((t) => t.tegund === "timi")
        .reduce((sum, t) => sum + (t.timi_minutur || 0), 0) || 0,
      users: undefined,
      timaskraning: undefined,
    }));

    res.json(verkefni);
  } catch (err) {
    handleApiError(res, err);
  }
});

/**
 * GET /api/verkefni/:id
 * Sækja eitt verkefni
 */
app.get("/api/verkefni/:id", async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req);

    const { data, error } = await supabase
      .from("verkefni")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: "Verkefni fannst ekki" });
    }

    res.json(data);
  } catch (err) {
    handleApiError(res, err);
  }
});

/**
 * POST /api/verkefni
 * Búa til nýtt verkefni
 */
app.post("/api/verkefni", async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req);
    const user = await getUser(req);
    const b = req.body;

    const verkefnanumer = await generateVerkefnanumer(supabase);
    const google_doc_id = extractGoogleDocId(b.google_doc_url);

    const { data, error } = await supabase
      .from("verkefni")
      .insert({
        user_id: user.id,
        verkefnanumer,
        nafn: b.nafn || "",
        mynd: b.mynd || "",
        framleidsla: b.framleidsla || "",
        produser: b.produser || "",
        produser_simi: b.produser_simi || "",
        produser_netfang: b.produser_netfang || "",
        stofa: b.stofa || "",
        tengill_nafn: b.tengill_nafn || "",
        tengill_simi: b.tengill_simi || "",
        tengill_netfang: b.tengill_netfang || "",
        art_director: b.art_director || "",
        art_director_simi: b.art_director_simi || "",
        copywriter: b.copywriter || "",
        copywriter_simi: b.copywriter_simi || "",
        lesari: b.lesari || "",
        handrit: b.handrit || "",
        google_doc_url: b.google_doc_url || "",
        google_doc_id,
        tonlist_titill: b.tonlist_titill || "",
        tonlist_heimild: b.tonlist_heimild || "",
        tonlist_url: b.tonlist_url || "",
        tonlist_kostnadur: b.tonlist_kostnadur || 0,
        stada: b.stada || "Í vinnslu",
        athugasemdir: b.athugasemdir || "",
        payday_tengill: b.payday_tengill || "",
        dropbox_slod: b.dropbox_slod || "",
        mottekid: b.mottekid || "",
        skilad: b.skilad || "",
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ id: data.id, message: "Verkefni búið til" });
  } catch (err) {
    handleApiError(res, err);
  }
});

/**
 * PUT /api/verkefni/:id
 * Uppfæra verkefni
 */
app.put("/api/verkefni/:id", async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req);
    const b = req.body;
    const google_doc_id = extractGoogleDocId(b.google_doc_url);

    const { error } = await supabase
      .from("verkefni")
      .update({
        nafn: b.nafn || "",
        mynd: b.mynd || "",
        framleidsla: b.framleidsla || "",
        produser: b.produser || "",
        produser_simi: b.produser_simi || "",
        produser_netfang: b.produser_netfang || "",
        stofa: b.stofa || "",
        tengill_nafn: b.tengill_nafn || "",
        tengill_simi: b.tengill_simi || "",
        tengill_netfang: b.tengill_netfang || "",
        art_director: b.art_director || "",
        art_director_simi: b.art_director_simi || "",
        copywriter: b.copywriter || "",
        copywriter_simi: b.copywriter_simi || "",
        lesari: b.lesari || "",
        handrit: b.handrit || "",
        google_doc_url: b.google_doc_url || "",
        google_doc_id,
        tonlist_titill: b.tonlist_titill || "",
        tonlist_heimild: b.tonlist_heimild || "",
        tonlist_url: b.tonlist_url || "",
        tonlist_kostnadur: b.tonlist_kostnadur || 0,
        stada: b.stada || "Í vinnslu",
        athugasemdir: b.athugasemdir || "",
        payday_tengill: b.payday_tengill || "",
        dropbox_slod: b.dropbox_slod || "",
        mottekid: b.mottekid || "",
        skilad: b.skilad || "",
      })
      .eq("id", req.params.id);

    if (error) throw error;
    res.json({ message: "Verkefni uppfært" });
  } catch (err) {
    handleApiError(res, err);
  }
});

/**
 * DELETE /api/verkefni/:id
 * Eyða verkefni og tengdum gögnum
 */
app.delete("/api/verkefni/:id", async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req);
    const id = req.params.id;

    // Eyða tengdum gögnum (ef cascade virkar ekki)
    await supabase.from("timaskraning").delete().eq("verkefni_id", id);
    await supabase.from("adkeypt").delete().eq("verkefni_id", id);

    const { error } = await supabase.from("verkefni").delete().eq("id", id);

    if (error) throw error;
    res.json({ message: "Verkefni eytt" });
  } catch (err) {
    handleApiError(res, err);
  }
});

/**
 * POST /api/verkefni/:id/mynd
 * Uppfæra mynd verkefnis
 */
app.post("/api/verkefni/:id/mynd", async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req);
    const { mynd } = req.body;

    if (!mynd) {
      return res.status(400).json({ error: "Enga mynd" });
    }

    const { error } = await supabase
      .from("verkefni")
      .update({ mynd, updated_at: new Date().toISOString() })
      .eq("id", req.params.id);

    if (error) throw error;
    res.json({ message: "Mynd vistuð" });
  } catch (err) {
    handleApiError(res, err);
  }
});

// ============================================================================
// API ROUTES - TÍMASKRÁNING
// ============================================================================

/**
 * GET /api/verkefni/:id/timi
 * Sækja allar tímaskráningar fyrir verkefni
 */
app.get("/api/verkefni/:id/timi", async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req);

    const { data, error } = await supabase
      .from("timaskraning")
      .select("*")
      .eq("verkefni_id", req.params.id)
      .order("dagsetning", { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    handleApiError(res, err);
  }
});

/**
 * POST /api/verkefni/:id/timi
 * Bæta við tímaskráningu
 */
app.post("/api/verkefni/:id/timi", async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req);
    const { tegund, titill, lysing, timi_minutur, dagsetning } = req.body;

    const { data, error } = await supabase
      .from("timaskraning")
      .insert({
        verkefni_id: req.params.id,
        tegund: tegund || "",
        titill: titill || "",
        lysing: lysing || "",
        timi_minutur: timi_minutur || 0,
        dagsetning: dagsetning || "",
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ id: data.id, message: "Tímaskráning bætt við" });
  } catch (err) {
    handleApiError(res, err);
  }
});

/**
 * DELETE /api/timi/:id
 * Eyða tímaskráningu
 */
app.delete("/api/timi/:id", async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req);

    const { error } = await supabase
      .from("timaskraning")
      .delete()
      .eq("id", req.params.id);

    if (error) throw error;
    res.json({ message: "Tímaskráning eytt" });
  } catch (err) {
    handleApiError(res, err);
  }
});

// ============================================================================
// API ROUTES - AÐKEYPT TÓNLIST
// ============================================================================

/**
 * GET /api/verkefni/:id/adkeypt
 * Sækja aðkeypta tónlist fyrir verkefni
 */
app.get("/api/verkefni/:id/adkeypt", async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req);

    const { data, error } = await supabase
      .from("adkeypt")
      .select("*")
      .eq("verkefni_id", req.params.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    handleApiError(res, err);
  }
});

/**
 * POST /api/verkefni/:id/adkeypt
 * Bæta við aðkeyptri tónlist
 */
app.post("/api/verkefni/:id/adkeypt", async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req);
    const { titill, heimild, url, kostnadur } = req.body;

    const { data, error } = await supabase
      .from("adkeypt")
      .insert({
        verkefni_id: req.params.id,
        titill: titill || "",
        heimild: heimild || "",
        url: url || "",
        kostnadur: kostnadur || 0,
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ id: data.id, message: "Lagi bætt við" });
  } catch (err) {
    handleApiError(res, err);
  }
});

/**
 * DELETE /api/adkeypt/:id
 * Eyða aðkeyptri tónlist
 */
app.delete("/api/adkeypt/:id", async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req);

    const { error } = await supabase
      .from("adkeypt")
      .delete()
      .eq("id", req.params.id);

    if (error) throw error;
    res.json({ message: "Lagi eytt" });
  } catch (err) {
    handleApiError(res, err);
  }
});

// ============================================================================
// API ROUTES - LOOKUP TABLES
// ============================================================================

/**
 * GET /api/stofur
 * Sækja lista af auglýsingastofum
 */
app.get("/api/stofur", async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("auglysingar_stofur")
      .select("*")
      .order("nafn");

    if (error) throw error;
    res.json(data);
  } catch (err) {
    handleApiError(res, err);
  }
});

/**
 * GET /api/framleidsla
 * Sækja lista af framleiðslufyrirtækjum
 */
app.get("/api/framleidsla", async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("framleidsla")
      .select("*")
      .order("nafn");

    if (error) throw error;
    res.json(data);
  } catch (err) {
    handleApiError(res, err);
  }
});

// ============================================================================
// API ROUTES - LEIT
// ============================================================================

/**
 * GET /api/search
 * Leita í handritum
 * Query params: q, lesari, stofa, stada, from, to
 */
app.get("/api/search", async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req);
    const { q, lesari, stofa, stada, from, to } = req.query;

    if (!q || q.trim().length < 2) {
      return res.json([]);
    }

    let query = supabase
      .from("verkefni")
      .select("id, nafn, lesari, stofa, stada, handrit, mottekid, skilad, created_at")
      .ilike("handrit", `%${q.trim()}%`);

    if (lesari) query = query.ilike("lesari", `%${lesari}%`);
    if (stofa) query = query.ilike("stofa", `%${stofa}%`);
    if (stada) query = query.eq("stada", stada);
    if (from) query = query.or(`mottekid.gte.${from},created_at.gte.${from}`);
    if (to) query = query.or(`mottekid.lte.${to},created_at.lte.${to}`);

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    res.json(data);
  } catch (err) {
    handleApiError(res, err);
  }
});

// ============================================================================
// API ROUTES - BOOTH
// ============================================================================

/**
 * GET /api/booth/state
 * Sækja núverandi booth state
 */
app.get("/api/booth/state", (req, res) => {
  res.json(currentBoothState);
});

/**
 * POST /api/booth/send
 * Senda handrit í booth
 */
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

/**
 * GET /api/ably-token
 * Sækja Ably token fyrir client (production only)
 */
app.get("/api/ably-token", async (req, res) => {
  if (!isProduction || !ablyRest) {
    return res.status(400).json({ error: "Ably not available in development mode" });
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

// ============================================================================
// API ROUTES - GOOGLE DOCS
// ============================================================================

/**
 * GET /api/google-doc/:docId
 * Sækja efni úr Google Doc (verður að vera public)
 */
app.get("/api/google-doc/:docId", async (req, res) => {
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
    console.error("Google Doc villa:", err.message);
    res.status(500).json({ error: "Villa við að sækja skjal: " + err.message });
  }
});

// ============================================================================
// API ROUTES - PDF SKÝRSLA
// ============================================================================

/**
 * GET /api/verkefni/:id/pdf
 * Búa til HTML tímaskýrslu (printable)
 */
app.get("/api/verkefni/:id/pdf", async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req);
    const id = req.params.id;

    // Sækja verkefni
    const { data: v, error: vErr } = await supabase
      .from("verkefni")
      .select("*")
      .eq("id", id)
      .single();

    if (vErr || !v) {
      return res.status(404).send("Verkefni fannst ekki");
    }

    // Sækja tengd gögn
    const { data: timi } = await supabase
      .from("timaskraning")
      .select("*")
      .eq("verkefni_id", id)
      .order("dagsetning");

    const { data: adkeypt } = await supabase
      .from("adkeypt")
      .select("*")
      .eq("verkefni_id", id)
      .order("created_at");

    // Reikna samtölur
    const timiList = timi || [];
    const adkeyptList = adkeypt || [];

    const totalMin = timiList
      .filter((t) => t.tegund === "timi")
      .reduce((s, t) => s + (t.timi_minutur || 0), 0);
    const totalSimtol = timiList.filter((t) => t.tegund === "simtal").length;
    const totalEmail = timiList.filter((t) => t.tegund === "email").length;
    const totalFundir = timiList.filter((t) => t.tegund === "fundur").length;
    const totalAdkeypt = adkeyptList.reduce((s, a) => s + (a.kostnadur || 0), 0);

    // Búa til HTML
    const html = generatePdfHtml(v, timiList, adkeyptList, {
      totalMin,
      totalSimtol,
      totalEmail,
      totalFundir,
      totalAdkeypt,
    });

    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (err) {
    handleApiError(res, err);
  }
});

/**
 * Búa til HTML fyrir PDF skýrslu
 */
function generatePdfHtml(v, timi, adkeypt, totals) {
  return `<!DOCTYPE html>
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
    <div class="total-item"><div class="total-value">${totals.totalMin}</div><div class="total-label">mínútur</div></div>
    <div class="total-item"><div class="total-value">${totals.totalSimtol}</div><div class="total-label">símtöl</div></div>
    <div class="total-item"><div class="total-value">${totals.totalEmail}</div><div class="total-label">email</div></div>
    <div class="total-item"><div class="total-value">${totals.totalFundir}</div><div class="total-label">fundir</div></div>
  </div>

  ${adkeypt.length > 0 ? `
  <h2>Aðkeypt tónlist</h2>
  <table>
    <tr><th>Titill</th><th>Heimild</th><th style="text-align:right;">Kostnaður</th></tr>
    ${adkeypt.map((a) => `<tr><td>${a.titill || "—"}</td><td>${a.heimild || "—"}</td><td style="text-align:right;">${a.kostnadur ? a.kostnadur.toLocaleString("is-IS") + " kr" : "—"}</td></tr>`).join("")}
  </table>
  <div class="cost-total">Samtals aðkeypt: ${totals.totalAdkeypt.toLocaleString("is-IS")} kr</div>
  ` : ""}

  <div class="footer">Bessi - Audioland • ${new Date().toLocaleDateString("is-IS")}</div>
</body>
</html>`;
}

// ============================================================================
// SPA FALLBACK
// ============================================================================

/**
 * Fallback route - serve index.html for client-side routing
 */
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ============================================================================
// START SERVER
// ============================================================================

initDatabase()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`🐕 Bessi keyrir á http://localhost:${PORT}`);
      console.log(`   Mode: ${process.env.NODE_ENV || "development"}`);
      console.log(`   Database: Supabase`);
    });
  })
  .catch((err) => {
    console.error("Villa við database:", err);
    process.exit(1);
  });
