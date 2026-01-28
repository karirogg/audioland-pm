/**
 * Database Module - Supabase Connection
 *
 * Þessi eining sér um tengingu við Supabase gagnagrunn.
 * Notar service_role key fyrir server-side operations og
 * anon key með user JWT fyrir RLS (Row Level Security).
 *
 * @module database
 * @author Audioland ehf
 */

const { createClient } = require("@supabase/supabase-js");

// ============================================================================
// STILLINGAR
// ============================================================================

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

/** @type {import('@supabase/supabase-js').SupabaseClient|null} */
let supabase = null;

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Frumstilla tengingu við Supabase
 *
 * Notar service_role key sem gefur fullan aðgang að gagnagrunni.
 * Þessi client er aðeins notaður á server-side fyrir admin operations.
 *
 * @returns {Promise<void>}
 * @throws {Error} Ef SUPABASE_URL eða SUPABASE_SERVICE_KEY vantar
 */
function initDatabase() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment variables"
    );
  }

  supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log("Bessi database connected (Supabase)! 🐕");
  return Promise.resolve();
}

// ============================================================================
// CLIENT ACCESS
// ============================================================================

/**
 * Sækja Supabase admin client (service_role)
 *
 * Þessi client hefur fullan aðgang og fer framhjá RLS policies.
 * Aðeins nota fyrir server-side admin operations.
 *
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
function getSupabase() {
  if (!supabase) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return supabase;
}

/**
 * Búa til Supabase client með notanda JWT fyrir RLS
 *
 * Þessi client virðir Row Level Security policies og
 * sýnir aðeins gögn sem notandi hefur aðgang að.
 *
 * @param {string} accessToken - JWT token frá Supabase Auth
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
function getSupabaseWithAuth(accessToken) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment variables"
    );
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  initDatabase,
  getSupabase,
  getSupabaseWithAuth,
};
