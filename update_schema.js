const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'gsp_system.db');
const db = new sqlite3.Database(dbPath);

console.log("--- UPDATING DATABASE SCHEMA ---");

db.serialize(() => {
    const columnsToAdd = [
        "ALTER TABLE schools ADD COLUMN address TEXT",
        "ALTER TABLE schools ADD COLUMN contact_person TEXT",
        "ALTER TABLE schools ADD COLUMN email TEXT",
        "ALTER TABLE schools ADD COLUMN status TEXT DEFAULT 'Active'"
    ];

    columnsToAdd.forEach(sql => {
        db.run(sql, (err) => {
            if (err) {
                if (err.message.includes('duplicate column')) {
                    console.log("Column already exists, skipping...");
                } else {
                    console.error("Error updating schema:", err.message);
                }
            } else {
                console.log("Column added successfully.");
            }
        });
    });
});

db.close(() => {
    console.log("Schema update finished. You may close this.");
});