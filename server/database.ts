import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const directory = path.resolve(process.cwd(), "data");
fs.mkdirSync(directory, { recursive: true });
const db = new Database(process.env.PROTOCOL_DB_PATH || path.join(directory, "protocol.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
CREATE TABLE IF NOT EXISTS disputes (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'STATEMENTS_PENDING', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS statements (id TEXT PRIMARY KEY, dispute_id TEXT NOT NULL, party TEXT NOT NULL CHECK(party IN ('A','B')), content TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(dispute_id) REFERENCES disputes(id));
CREATE UNIQUE INDEX IF NOT EXISTS statements_one_per_party ON statements(dispute_id, party);
CREATE TABLE IF NOT EXISTS ai_analyses (id TEXT PRIMARY KEY, dispute_id TEXT NOT NULL, model TEXT NOT NULL, status TEXT NOT NULL, input_hash TEXT, result_json TEXT, error_message TEXT, created_at TEXT NOT NULL, updated_at TEXT, FOREIGN KEY(dispute_id) REFERENCES disputes(id));
CREATE UNIQUE INDEX IF NOT EXISTS analyses_one_per_input ON ai_analyses(dispute_id, input_hash) WHERE input_hash IS NOT NULL;
CREATE TABLE IF NOT EXISTS fact_reviews (id TEXT PRIMARY KEY, dispute_id TEXT NOT NULL, analysis_id TEXT, fact_key TEXT NOT NULL, category TEXT NOT NULL, original_text TEXT NOT NULL, decision TEXT NOT NULL, edited_text TEXT, note TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(dispute_id) REFERENCES disputes(id));
CREATE UNIQUE INDEX IF NOT EXISTS one_fact_review ON fact_reviews(dispute_id, fact_key);
CREATE TABLE IF NOT EXISTS mediator_notes (id TEXT PRIMARY KEY, dispute_id TEXT NOT NULL, note TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(dispute_id) REFERENCES disputes(id));
CREATE TABLE IF NOT EXISTS precedents (id TEXT PRIMARY KEY, dispute_id TEXT NOT NULL, situation TEXT NOT NULL, confirmed_facts TEXT NOT NULL DEFAULT '', resolution TEXT NOT NULL DEFAULT '', reasoning TEXT NOT NULL DEFAULT '', protocol_rule TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'RECORDED', created_at TEXT NOT NULL, FOREIGN KEY(dispute_id) REFERENCES disputes(id));
CREATE TABLE IF NOT EXISTS resolutions (id TEXT PRIMARY KEY, dispute_id TEXT NOT NULL UNIQUE, final_resolution TEXT NOT NULL, agreed_actions TEXT NOT NULL DEFAULT '', responsibilities TEXT NOT NULL DEFAULT '', deadlines TEXT NOT NULL DEFAULT '', unresolved_issues TEXT NOT NULL DEFAULT '', mediator_notes TEXT NOT NULL DEFAULT '', confirmed_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(dispute_id) REFERENCES disputes(id));
CREATE TABLE IF NOT EXISTS audit_log (id TEXT PRIMARY KEY, dispute_id TEXT NOT NULL, action TEXT NOT NULL, details TEXT, created_at TEXT NOT NULL, FOREIGN KEY(dispute_id) REFERENCES disputes(id));
`);
for (const column of ["input_hash TEXT", "error_message TEXT", "updated_at TEXT"]) { try { db.exec(`ALTER TABLE ai_analyses ADD COLUMN ${column}`); } catch { /* existing database */ } }
try { db.exec("ALTER TABLE audit_log ADD COLUMN details TEXT"); } catch { /* existing database */ }
export default db;
