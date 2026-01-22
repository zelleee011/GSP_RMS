const fs = require('fs');
const XLSX = require('xlsx');
const db = require('./database');

const EXCEL_FILENAME = 'troops_dataset.xlsx'; 

console.log("--- GSP TROOP IMPORT TO SQL START ---");

if (!fs.existsSync(EXCEL_FILENAME)) {
    console.error(`Error: Could not find '${EXCEL_FILENAME}'.`);
    process.exit(1);
}

const workbook = XLSX.readFile(EXCEL_FILENAME);
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const excelData = XLSX.utils.sheet_to_json(worksheet);

let addedCount = 0;
let skippedCount = 0;
let idCounter = Date.now(); 

db.serialize(() => {
    db.run("BEGIN TRANSACTION");
    const stmt = db.prepare("INSERT INTO troops (id, type, year, school_id, community_id, troop_no, name, age_level, troop_leader, co_leader) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

    // Load contexts
    db.all("SELECT id, name, year FROM schools", (err, schools) => {
        db.all("SELECT id, name, year FROM communities", (err2, communities) => {
            
            excelData.forEach((row) => {
                const getVal = (names) => {
                    const key = Object.keys(row).find(k => {
                        const cleanKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                        return names.includes(cleanKey);
                    });
                    return key ? row[key] : null;
                };

                const rawYear = getVal(['year']);
                const scName = getVal(['schoolcommunityname', 'schoolname', 'communityname']);
                const troopNo = getVal(['troopno']);
                const troopName = getVal(['troopname']);
                const leader = getVal(['leader']);
                const coLeader = getVal(['coleader']);
                const ageLevel = getVal(['agelevel']);
                const troopTypeStr = (getVal(['trooptype']) || '').toLowerCase();

                if (!rawYear || !scName || !troopNo) { skippedCount++; return; }
                
                const rowYear = parseInt(rawYear.toString().substring(0, 4));
                const isSchool = troopTypeStr.includes('school');
                const typeLabel = isSchool ? 'School Based' : 'Community Based';
                let parentId = null;
                const searchName = scName.toString().toLowerCase().trim();

                if (isSchool) {
                    const found = schools.find(s => s.year === rowYear && s.name.toLowerCase().trim() === searchName);
                    if (found) parentId = found.id;
                } else {
                    const found = communities.find(c => c.year === rowYear && c.name.toLowerCase().trim() === searchName);
                    if (found) parentId = found.id;
                }

                if (parentId) {
                    idCounter++;
                    stmt.run(idCounter, typeLabel, rowYear, isSchool ? parentId : null, !isSchool ? parentId : null, troopNo.toString(), troopName || `Troop ${troopNo}`, ageLevel || "Junior", leader || "", coLeader || "");
                    addedCount++;
                } else {
                    skippedCount++;
                }
            });

            stmt.finalize();
            db.run("COMMIT", () => {
                console.log(`\nSUCCESS: Added ${addedCount} troops to SQL.`);
                console.log(`SKIPPED: ${skippedCount}`);
            });
        });
    });
});