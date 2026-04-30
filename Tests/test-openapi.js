import 'dotenv/config';

async function fetchSchema() {
  const url = process.env.VITE_SUPABASE_URL + '/rest/v1/profiles?apikey=' + process.env.VITE_SUPABASE_ANON_KEY;
  const res = await fetch(url, { method: 'OPTIONS' });
  console.log(Array.from(res.headers.entries()));
}
fetchSchema();
