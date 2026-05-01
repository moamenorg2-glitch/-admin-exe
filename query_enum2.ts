import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL!;
const key = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(url, key);

async function run() {
    // try inserting with bogus value to get error message detailing enum values? 
    // Usually Postgres doesn't list enum values in the "invalid input value" error message.
    console.log("We need the types");
}

run();
