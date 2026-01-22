const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database'); // Import the SQL connection

const app = express();
// Use dynamic port environment variable if available, otherwise 3000
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '')));

// --- API: Get All Data ---
app.get('/api/data', (req, res) => {
    const response = { schools: [], communities: [], troops: [], members: [] };

    db.serialize(() => {
        db.all("SELECT * FROM schools", (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            response.schools = rows;

            db.all("SELECT * FROM communities", (err, rows) => {
                if (err) return res.status(500).json({ error: err.message });
                response.communities = rows;

                db.all("SELECT * FROM troops", (err, rows) => {
                    if (err) return res.status(500).json({ error: err.message });
                    response.troops = rows;

                    db.all("SELECT * FROM members", (err, rows) => {
                        if (err) return res.status(500).json({ error: err.message });
                        response.members = rows;
                        
                        res.json(response);
                    });
                });
            });
        });
    });
});

// --- API: Save/Update Data ---
app.post('/api/data', (req, res) => {
    const { schools, communities, troops, members } = req.body;

    if (!schools || !communities || !troops || !members) {
        return res.status(400).json({ message: 'Incomplete data.' });
    }

    const runTransaction = () => {
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");

            // UPDATED: Schools now insert/update address, contact, email, status
            const upsertSchool = db.prepare(`INSERT INTO schools (id, name, district, year, address, contact_person, email, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?) 
                ON CONFLICT(id) DO UPDATE SET name=excluded.name, district=excluded.district, year=excluded.year, address=excluded.address, contact_person=excluded.contact_person, email=excluded.email, status=excluded.status`);
            
            const upsertComm = db.prepare(`INSERT INTO communities (id, name, district, year) VALUES (?, ?, ?, ?) 
                ON CONFLICT(id) DO UPDATE SET name=excluded.name, district=excluded.district, year=excluded.year`);

            const upsertTroop = db.prepare(`INSERT INTO troops (id, type, year, school_id, community_id, troop_no, name, age_level, troop_leader, co_leader) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
                ON CONFLICT(id) DO UPDATE SET troop_no=excluded.troop_no, name=excluded.name, age_level=excluded.age_level, troop_leader=excluded.troop_leader, co_leader=excluded.co_leader`);

            const upsertMember = db.prepare(`INSERT INTO members (id, troop_id, year, first_name, last_name, age, age_level, dob, reg_status, beneficiary) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
                ON CONFLICT(id) DO UPDATE SET first_name=excluded.first_name, last_name=excluded.last_name, age=excluded.age, dob=excluded.dob, reg_status=excluded.reg_status, beneficiary=excluded.beneficiary`);

            // Execute Updates
            schools.forEach(s => upsertSchool.run(s.id, s.name, s.district, s.year, s.address || '', s.contact_person || '', s.email || '', s.status || 'Active'));
            communities.forEach(c => upsertComm.run(c.id, c.name, c.district, c.year));
            troops.forEach(t => upsertTroop.run(t.id, t.type, t.year, t.school_id, t.community_id, t.troop_no, t.name, t.age_level, t.troop_leader, t.co_leader));
            members.forEach(m => upsertMember.run(m.id, m.troop_id, m.year, m.first_name, m.last_name, m.age, m.age_level, m.dob, m.reg_status, m.beneficiary));

            // Deletions logic
            const schoolIds = schools.map(s => s.id).join(',');
            if(schoolIds) db.run(`DELETE FROM schools WHERE id NOT IN (${schoolIds}) AND year = ?`, [schools[0]?.year]);

            const commIds = communities.map(c => c.id).join(',');
            if(commIds) db.run(`DELETE FROM communities WHERE id NOT IN (${commIds}) AND year = ?`, [communities[0]?.year]);

            const troopIds = troops.map(t => t.id).join(',');
            if(troopIds) db.run(`DELETE FROM troops WHERE id NOT IN (${troopIds})`);

            const memberIds = members.map(m => m.id).join(',');
            if(memberIds) db.run(`DELETE FROM members WHERE id NOT IN (${memberIds})`);

            upsertSchool.finalize();
            upsertComm.finalize();
            upsertTroop.finalize();
            upsertMember.finalize();

            db.run("COMMIT", (err) => {
                if (err) {
                    console.error("Transaction Error:", err);
                    res.status(500).json({ message: "Database Error" });
                } else {
                    res.json({ message: "Data synchronized to SQL Database." });
                }
            });
        });
    };

    runTransaction();
});

// Listen on all network interfaces
app.listen(PORT, '0.0.0.0', () => console.log(`Server running at: http://localhost:${PORT}`));