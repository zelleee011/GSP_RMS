
const fs = require('fs');
const XLSX = require('xlsx');
const db = require('./database'); // Import SQL connection

const EXCEL_FILENAME = 'dataset.xlsx'; 

console.log("--- GSP DATA IMPORT TO SQL START ---");

if (!fs.existsSync(EXCEL_FILENAME)) {
    console.error(`Error: Could not find '${EXCEL_FILENAME}'.`);
    process.exit(1);
}

const workbook = XLSX.readFile(EXCEL_FILENAME);
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const excelData = XLSX.utils.sheet_to_json(worksheet);

function excelDateToJS(val) {
    if (!val) return "";
    if (val instanceof Date) return val.toISOString().split('T')[0];
    if (typeof val === 'number' && val > 10000) {
        const date = new Date(Math.round((val - 25569) * 86400 * 1000));
        return date.toISOString().split('T')[0];
    }
    return val.toString();
}

let addedCount = 0;
let errorCount = 0;
let idCounter = Date.now(); 

db.serialize(() => {
    db.run("BEGIN TRANSACTION");
    const stmt = db.prepare("INSERT INTO members (id, troop_id, year, first_name, last_name, age, age_level, dob, reg_status, beneficiary) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

    // We need to fetch troops first to match IDs
    db.all("SELECT id, name, troop_no, year, age_level FROM troops", (err, troops) => {
        if (err) { console.error(err); return; }

        excelData.forEach((row) => {
            const getVal = (names) => {
                const key = Object.keys(row).find(k => names.includes(k.replace(/\s/g, '').toLowerCase()));
                return key ? row[key] : null;
            };

            const rawYear = getVal(['year']);
            const troopInput = getVal(['troopname', 'troop', 'troopno']);
            const lastName = getVal(['lastname', 'surname']);
            const firstName = getVal(['firstname', 'givenname']);
            const excelDob = getVal(['birthday', 'dob', 'birthdate']); 
            const beneficiary = getVal(['beneficiary', 'parent', 'guardian']) || "";
            const ageValue = getVal(['age']);

            if (!rawYear || !lastName || !firstName || !troopInput) return;

            const rowYear = parseInt(rawYear.toString().substring(0, 4));
            const searchStr = troopInput.toString().toLowerCase().trim();

            const troop = troops.find(t => 
                t.year === rowYear && 
                (t.name.toLowerCase().trim() === searchStr || t.troop_no.toLowerCase().trim() === searchStr)
            );

            if (troop) {
                idCounter++;
                stmt.run(idCounter, troop.id, rowYear, firstName, lastName, ageValue || 0, troop.age_level, excelDateToJS(excelDob), 'New', beneficiary);
                addedCount++;
            } else {
                errorCount++;
            }
        });

        stmt.finalize();
        db.run("COMMIT", () => {
            console.log(`\nIMPORT SUCCESSFUL to SQL:`);
            console.log(`- Added: ${addedCount} members`);
            console.log(`- Skipped: ${errorCount}`);
        });
    });
});