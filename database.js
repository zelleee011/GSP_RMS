const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to SQLite database (creates file if not exists)
const dbPath = path.resolve(__dirname, 'gsp_system.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
    }
});

// Initialize Tables
db.serialize(() => {
    // Schools Table
    db.run(`CREATE TABLE IF NOT EXISTS schools (
        id INTEGER PRIMARY KEY,
        name TEXT,
        district TEXT,
        year INTEGER
    )`);

    // Communities Table
    db.run(`CREATE TABLE IF NOT EXISTS communities (
        id INTEGER PRIMARY KEY,
        name TEXT,
        district TEXT,
        year INTEGER
    )`);

    // Troops Table
    db.run(`CREATE TABLE IF NOT EXISTS troops (
        id INTEGER PRIMARY KEY,
        type TEXT,
        year INTEGER,
        school_id INTEGER,
        community_id INTEGER,
        troop_no TEXT,
        name TEXT,
        age_level TEXT,
        troop_leader TEXT,
        co_leader TEXT
    )`);

    // Members Table
    db.run(`CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY,
        troop_id INTEGER,
        year INTEGER,
        first_name TEXT,
        last_name TEXT,
        age INTEGER,
        age_level TEXT,
        dob TEXT,
        reg_status TEXT,
        beneficiary TEXT
    )`);
});

module.exports = db;