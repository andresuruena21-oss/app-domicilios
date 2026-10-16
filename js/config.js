// 1. Pega aquí los datos de tu proyecto de Supabase
const SUPABASE_URL = 'https://vuzzhhkwnsvicwdgasdt.supabase.co';
const SUPABASE_KEY = 'sb_publishable_DxI5mqDoTVZFXf-4dbtlVg_3thP_ad9';

// 2. Conexión a la base de datos (no tocar)
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);