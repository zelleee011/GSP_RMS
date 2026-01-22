const fs = require('fs');
const db = require('./database');

function loadJSON(filename) {
    try {
        if (fs.existsSync(filename)) {
            return JSON.parse(fs.readFileSync(filename, 'utf8'));
        }
    } catch (e) {
        console.error(`Error reading ${filename}:`, e);
    }
    return [];
}

const schools = loadJSON('schools.json');
const communities = loadJSON('communities.json');
const troops = loadJSON('troops.json');
const members = loadJSON('members.json');

console.log("--- MIGRATING DATA TO SQL ---");

db.serialize(() => {
    // Migrate Schools
    const stmtSchool = db.prepare("INSERT OR IGNORE INTO schools (id, name, district, year) VALUES (?, ?, ?, ?)");
    schools.forEach(s => stmtSchool.run(s.id, s.name, s.district, s.year));
    stmtSchool.finalize();
    console.log(`Migrated ${schools.length} schools.`);

    // Migrate Communities
    const stmtComm = db.prepare("INSERT OR IGNORE INTO communities (id, name, district, year) VALUES (?, ?, ?, ?)");
    communities.forEach(c => stmtComm.run(c.id, c.name, c.district, c.year));
    stmtComm.finalize();
    console.log(`Migrated ${communities.length} communities.`);

    // Migrate Troops
    const stmtTroop = db.prepare("INSERT OR IGNORE INTO troops (id, type, year, school_id, community_id, troop_no, name, age_level, troop_leader, co_leader) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    troops.forEach(t => stmtTroop.run(t.id, t.type, t.year, t.school_id, t.community_id, t.troop_no, t.name, t.age_level, t.troop_leader, t.co_leader));
    stmtTroop.finalize();
    console.log(`Migrated ${troops.length} troops.`);

    // Migrate Members
    // Note: Inserting members can be slow if there are millions, so we wrap in transaction
    db.run("BEGIN TRANSACTION");
    const stmtMember = db.prepare("INSERT OR IGNORE INTO members (id, troop_id, year, first_name, last_name, age, age_level, dob, reg_status, beneficiary) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    members.forEach(m => stmtMember.run(m.id, m.troop_id, m.year, m.first_name, m.last_name, m.age, m.age_level, m.dob, m.reg_status, m.beneficiary));
    stmtMember.finalize();
    db.run("COMMIT");
    console.log(`Migrated ${members.length} members.`);
});

db.close(() => {
    console.log("Migration Completed. You can now use the SQL system.");
});