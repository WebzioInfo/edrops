"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
require("dotenv/config");
async function main() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString)
        throw new Error('No DATABASE_URL');
    let cleanUrl = connectionString;
    try {
        const parsed = new URL(connectionString);
        parsed.searchParams.delete('sslmode');
        cleanUrl = parsed.toString();
    }
    catch { }
    const client = new pg_1.Client({ connectionString: cleanUrl, ssl: { rejectUnauthorized: false } });
    await client.connect();
    try {
        const sql = fs.readFileSync(path.join(__dirname, 'v3_indexes_migration.sql'), 'utf-8');
        await client.query(sql);
        console.log('Migration executed successfully via pg Client');
    }
    catch (err) {
        console.error('Error executing migration:', err);
    }
    finally {
        await client.end();
    }
}
main();
//# sourceMappingURL=run-migration.js.map