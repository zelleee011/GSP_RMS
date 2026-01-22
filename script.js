// ===================================================================================
// --- 1. GLOBAL STATE & CONSTANTS ---
// ===================================================================================

let isLoggedIn = false;
// FIX: Calculate school year start based on month. 
let currentYear = (new Date().getMonth() < 6) ? new Date().getFullYear() - 1 : new Date().getFullYear();
let availableYears = [];

// Chart instances
let overallChartInstance = null;
let breakdownChartInstance = null;
let retentionChartInstance = null;
let predictionChartInstance = null;
let statusChartInstance = null;

// Data arrays - populated from server
let schools = [];
let communities = [];
let troops = [];
let members = [];

// Constants for dropdowns and charts
const ageLevels = ["Twinkler", "Star", "Junior", "Senior", "Cadet"];
const ageLevelFilterOptions = `<option value="All Age Levels">All Age Levels</option><option value="Twinkler">Twinkler</option><option value="Star">Star</option><option value="Junior">Junior</option><option value="Senior">Senior</option><option value="Cadet">Cadet</option><option value="Mixed">Mixed</option>`;
const ageLevelOptions = `<option value="Twinkler">Twinkler</option><option value="Star">Star</option><option value="Junior">Junior</option><option value="Senior">Senior</option><option value="Cadet">Cadet</option>`;


// ===================================================================================
// --- 2. UTILITY FUNCTIONS ---
// ===================================================================================

/**
 * Show automatic notification that fades away
 */
function showNotification(message) {
    const container = document.getElementById('notification-container');
    if(!container) return;
    const toast = document.createElement('div');
    toast.className = 'notification';
    toast.textContent = message;
    container.appendChild(toast);
    
    // Remove element from DOM after animation finishes
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// FIX: Changed from range (2021-2022) to single year (2021)
function formatSchoolYear(year) {
    return year.toString();
}

/**
 * FIX: Converts Excel serial date numbers (e.g., 42749) to YYYY-MM-DD
 */
function excelDateToJS(val) {
    if (!val) return "";
    if (val instanceof Date) return val.toISOString().split('T')[0];
    if (typeof val === 'number' && val > 10000) {
        // Excel base date is Dec 30, 1899
        const date = new Date(Math.round((val - 25569) * 86400 * 1000));
        return date.toISOString().split('T')[0];
    }
    return val.toString();
}

function filterTable(inputId, tableId) {
    const filter = document.getElementById(inputId).value.toUpperCase();
    const table = document.getElementById(tableId);
    const tr = table.getElementsByTagName("tr");
    for (let i = 1; i < tr.length; i++) {
        tr[i].style.display = i === 0 || tr[i].textContent.toUpperCase().includes(filter) ? "" : "none";
    }
}

// FIX: Helper to create an inline form container right ABOVE the row being edited
function getInlineFormContainer(event) {
    // Clear any existing inline forms first
    const existingInline = document.querySelector('.inline-edit-row');
    if (existingInline) existingInline.remove();
    
    // Clear top form container
    document.getElementById('form-container').innerHTML = '';

    const clickedRow = event.target.closest('tr');
    const colCount = clickedRow.cells.length;
    
    const inlineRow = document.createElement('tr');
    inlineRow.className = 'inline-edit-row';
    // Style note: Putting it above often looks better with a slight background distinction
    inlineRow.innerHTML = `<td colspan="${colCount}" style="background-color: #f9f9f9; border-left: 4px solid #3498db;"><div id="inline-form-target" class="inline-form-wrapper"></div></td>`;
    
    // Changed .after to .before to place form on the "UP part"
    clickedRow.before(inlineRow);
    return document.getElementById('inline-form-target');
}

async function printTroopReport(type) {
    const ageLevelFilter = document.getElementById('ageLevelFilter').value;
    const reportWindow = window.open('', '_blank');
    reportWindow.document.write(`<html><head><title>Troop Report</title><link rel="stylesheet" href="style.css"></head><body><div class="print-report-container"><div class="report-header"><h1 class="report-title">GSP Baguio Council</h1><h2 class="report-subtitle">${type} Troop Report - Year ${formatSchoolYear(currentYear)}</h2></div><p class="report-filter-info">Filtered by Age Level: <strong>${ageLevelFilter}</strong></p>`);
    let filteredTroops = troops.filter(t => t.type === type && t.year === currentYear);
    if (ageLevelFilter !== "All Age Levels") {
        filteredTroops = filteredTroops.filter(t => t.age_level === ageLevelFilter);
    }
    if (filteredTroops.length === 0) {
        reportWindow.document.write('<p>No troops found for this filter.</p>');
    } else {
        const baseName = type === 'School Based' ? 'School' : 'Community';
        reportWindow.document.write(`<table class="report-overview-table"><caption>Overview</caption><thead><tr><th>Troop No.</th><th>Name</th><th>Age Level</th><th>${baseName}</th><th>Total Members</th></tr></thead><tbody>`);
        filteredTroops.forEach(troop => {
            const linkName = troop.school_id ? schools.find(s => s.id === troop.school_id)?.name : communities.find(c => c.id === troop.community_id)?.name;
            const memberCount = members.filter(m => m.troop_id === troop.id && m.year === currentYear).length;
            reportWindow.document.write(`<tr><td>${troop.troop_no}</td><td>${troop.name}</td><td>${troop.age_level}</td><td>${linkName || 'N/A'}</td><td>${memberCount}</td></tr>`);
        });
        reportWindow.document.write(`</tbody></table><h3>Detailed Reports</h3>`);
        for (const troop of filteredTroops) {
            const linkName = troop.school_id ? schools.find(s => s.id === troop.school_id)?.name : communities.find(c => c.id === troop.community_id)?.name;
            const troopMembers = members.filter(m => m.troop_id === troop.id && m.year === currentYear);
            reportWindow.document.write(`<div class="report-section"><h4>${troop.name} (#${troop.troop_no})</h4><div class="report-details-group"><div class="report-detail-item"><strong>Type:</strong> <span>${troop.type}</span></div><div class="report-detail-item"><strong>${baseName}:</strong> <span>${linkName || 'N/A'}</span></div><div class="report-detail-item"><strong>Leader:</strong> <span>${troop.troop_leader || 'N/A'}</span></div><div class="report-detail-item"><strong>Co-Leader:</strong> <span>${troop.co_leader || 'N/A'}</span></div></div><h5>Members (${troopMembers.length})</h5>`);
            if (troopMembers.length > 0) {
                reportWindow.document.write(`<table class="report-members-table"><thead><tr><th>ID</th><th>Last Name</th><th>First Name</th><th>Age Level</th><th>Status</th><th>DOB</th><th>Age</th></tr></thead><tbody>`);
                troopMembers.forEach(m => reportWindow.document.write(`<tr><td>${m.id}</td><td>${m.last_name}</td><td>${m.first_name}</td><td>${m.age_level}</td><td>${m.reg_status}</td><td>${m.dob || ''}</td><td>${m.age}</td></tr>`));
                reportWindow.document.write('</tbody></table>');
            } else {
                reportWindow.document.write('<p class="no-members-message">No members found in this troop for the selected year.</p>');
            }
            reportWindow.document.write('</div>');
        }
    }
    reportWindow.document.write(`</div></body></html>`);
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.print();
}


// ===================================================================================
// --- 3. SCHOOL MANAGEMENT (REDESIGNED) ---
// ===================================================================================

async function renderSchoolManagement() {
    const data = schools.filter(s => s.year === currentYear);
    
    document.getElementById('main-content').innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h1 style="margin: 0;">Schools Management</h1>
        </div>

        <div class="modern-controls">
            <div class="modern-search-wrapper">
                <span class="search-icon-overlay">🔍</span>
                <input type="text" id="schoolSearch" class="modern-search" onkeyup="filterTable('schoolSearch', 'schoolTable')" placeholder="Search schools...">
            </div>
            <button class="btn-add-school" onclick="showAddSchoolForm()">
                <span>+</span> Add School
            </button>
        </div>

        <div id="form-container"></div>

        <table id="schoolTable" class="modern-table">
            <thead>
                <tr>
                    <th style="width: 30%;">District</th>
                    <th style="width: 50%;">School Name</th>
                    <th style="width: 20%;"></th>
                </tr>
            </thead>
            <tbody>
                ${data.map(s => {
                    return `
                    <tr onclick="showSchoolDetails(event, ${s.id})">
                        <td>${s.district}</td>
                        <td>
                            <span class="school-name-text">${s.name}</span>
                            <span class="info-subtext">ID: ${s.id.toString().slice(-6)}</span>
                        </td>
                        <td>
                            <div class="modern-actions">
                                <button class="action-icon-btn icon-view" title="View Details" onclick="showSchoolDetails(event, ${s.id})">
                                    <svg class="icon-svg" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                </button>
                                <button class="action-icon-btn icon-edit" title="Edit" onclick="showEditSchoolForm(event, ${s.id})">
                                    <svg class="icon-svg" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                </button>
                                <button class="action-icon-btn icon-delete" title="Delete" onclick="deleteSchool(event, ${s.id})">
                                    <svg class="icon-svg" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                </button>
                            </div>
                        </td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>`;
}

async function showSchoolDetails(event, id) {
    if (event) event.stopPropagation();
    const school = schools.find(s => s.id === id);
    if (!school) return;
    const data = troops.filter(t => t.school_id === id && t.year === currentYear);
    document.getElementById('main-content').innerHTML = `
        <button onclick="showSection('schools')">← Back to Schools</button>
        <h2>${school.name} (${formatSchoolYear(school.year)})</h2>
        <h3>Troops</h3>
        <div id="form-container"></div>
        <table>
            <thead>
                <tr>
                    <th>Troop No.</th>
                    <th>Name</th>
                    <th>Age Level</th>
                </tr>
            </thead>
            <tbody>
                ${data.map(t => `
                    <tr onclick="showTroopDetails(event, ${t.id}, ${id})">
                        <td>${t.troop_no}</td>
                        <td>${t.name}</td>
                        <td>${t.age_level}</td>
                    </tr>`).join('')}
            </tbody>
        </table>`;
}

async function showAddSchoolForm() {
    document.getElementById('form-container').innerHTML = `
        <h3>Add School</h3>
        <div class="form-layout-container">
            <div class="form-group"><label>School Name:</label><input id="schoolName"></div>
            <div class="form-group"><label>District:</label><input id="district"></div>
            <div class="form-actions">
                <button onclick="addSchool()">Save</button>
                <button class="cancel-btn" onclick="cancelForm()">Cancel</button>
            </div>
        </div>`;
}

async function showEditSchoolForm(event, id) {
    event.stopPropagation();
    const school = schools.find(s => s.id === id);
    if (!school) return;
    
    const container = getInlineFormContainer(event);
    container.innerHTML = `
        <h3>Edit School</h3>
        <div class="form-layout-container">
            <div class="form-group"><label>School Name:</label><input id="editSchoolName" value="${school.name}"></div>
            <div class="form-group"><label>District:</label><input id="editDistrict" value="${school.district}"></div>
            <div class="form-actions">
                <button onclick="updateSchool(${id})">Save</button>
                <button class="cancel-btn" onclick="cancelForm()">Cancel</button>
                <button class="form-delete-btn" onclick="deleteSchool(event, ${id})">DELETE</button>
            </div>
        </div>`;
}

async function addSchool() {
    const newSchool = { id: Date.now(), name: document.getElementById('schoolName').value, district: document.getElementById('district').value, year: currentYear };
    if (!newSchool.name || !newSchool.district) { alert("Fields cannot be empty."); return; }
    schools.push(newSchool);
    await saveDataToServer();
    showNotification("School added successfully!");
    await showSection('schools');
}

async function updateSchool(id) {
    const index = schools.findIndex(s => s.id === id);
    if (index === -1) return;
    schools[index] = { ...schools[index], name: document.getElementById('editSchoolName').value, district: document.getElementById('editDistrict').value };
    await saveDataToServer();
    await showSection('schools');
}

async function deleteSchool(event, id) {
    event.stopPropagation();
    if (confirm("DELETE SCHOOL and all its troops and members?")) {
        schools = schools.filter(s => s.id !== id);
        const troopsToDelete = troops.filter(t => t.school_id === id).map(t => t.id);
        troops = troops.filter(t => t.school_id !== id);
        members = members.filter(m => !troopsToDelete.includes(m.troop_id));
        await saveDataToServer();
        await showSection('schools');
    }
}


// ===================================================================================
// --- 4. COMMUNITY MANAGEMENT (REDESIGNED) ---
// ===================================================================================

async function renderCommunityManagement() {
    const data = communities.filter(c => c.year === currentYear);
    
    document.getElementById('main-content').innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h1 style="margin: 0;">Communities Management</h1>
        </div>

        <div class="modern-controls">
            <div class="modern-search-wrapper">
                <span class="search-icon-overlay">🔍</span>
                <input type="text" id="communitySearch" class="modern-search" onkeyup="filterTable('communitySearch', 'communityTable')" placeholder="Search communities...">
            </div>
            <button class="btn-add-school" onclick="showAddCommunityForm()">
                <span>+</span> Add Community
            </button>
        </div>

        <div id="form-container"></div>

        <table id="communityTable" class="modern-table">
            <thead>
                <tr>
                    <th style="width: 30%;">District</th>
                    <th style="width: 50%;">Community Name</th>
                    <th style="width: 20%;"></th>
                </tr>
            </thead>
            <tbody>
                ${data.map(c => `
                    <tr onclick="showCommunityDetails(event, ${c.id})">
                        <td>${c.district}</td>
                        <td>
                            <span class="school-name-text">${c.name}</span>
                            <span class="info-subtext">ID: ${c.id.toString().slice(-6)}</span>
                        </td>
                        <td>
                            <div class="modern-actions">
                                <button class="action-icon-btn icon-view" title="View Details" onclick="showCommunityDetails(event, ${c.id})">
                                    <svg class="icon-svg" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                </button>
                                <button class="action-icon-btn icon-edit" title="Edit" onclick="showEditCommunityForm(event, ${c.id})">
                                    <svg class="icon-svg" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                </button>
                                <button class="action-icon-btn icon-delete" title="Delete" onclick="deleteCommunity(event, ${c.id})">
                                    <svg class="icon-svg" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                </button>
                            </div>
                        </td>
                    </tr>`).join('')}
            </tbody>
        </table>`;
}

async function showCommunityDetails(event, id) {
    if (event) event.stopPropagation();
    const community = communities.find(c => c.id === id);
    if (!community) return;
    const data = troops.filter(t => t.community_id === id && t.year === currentYear);
    document.getElementById('main-content').innerHTML = `
        <button onclick="showSection('communities')">← Back to Communities</button>
        <h2>${community.name} (${formatSchoolYear(community.year)})</h2>
        <h3>Troops</h3>
        <div id="form-container"></div>
        <table>
            <thead>
                <tr>
                    <th>Troop No.</th>
                    <th>Name</th>
                    <th>Age Level</th>
                </tr>
            </thead>
            <tbody>
                ${data.map(t => `
                    <tr onclick="showTroopDetails(event, ${t.id}, ${id})">
                        <td>${t.troop_no}</td>
                        <td>${t.name}</td>
                        <td>${t.age_level}</td>
                    </tr>`).join('')}
            </tbody>
        </table>`;
}

async function showAddCommunityForm() {
    document.getElementById('form-container').innerHTML = `
        <h3>Add Community</h3>
        <div class="form-layout-container">
            <div class="form-group"><label>Community Name:</label><input id="communityName"></div>
            <div class="form-group"><label>District:</label><input id="district"></div>
            <div class="form-actions">
                <button onclick="addCommunity()">Save</button>
                <button class="cancel-btn" onclick="cancelForm()">Cancel</button>
            </div>
        </div>`;
}

async function showEditCommunityForm(event, id) {
    event.stopPropagation();
    const community = communities.find(c => c.id === id);
    if (!community) return;
    
    const container = getInlineFormContainer(event);
    container.innerHTML = `
        <h3>Edit Community</h3>
        <div class="form-layout-container">
            <div class="form-group"><label>Community Name:</label><input id="editCommunityName" value="${community.name}"></div>
            <div class="form-group"><label>District:</label><input id="editDistrict" value="${community.district}"></div>
            <div class="form-actions">
                <button onclick="updateCommunity(${id})">Save</button>
                <button class="cancel-btn" onclick="cancelForm()">Cancel</button>
                <button class="form-delete-btn" onclick="deleteCommunity(event, ${id})">DELETE</button>
            </div>
        </div>`;
}

async function addCommunity() {
    const newCommunity = { id: Date.now(), name: document.getElementById('communityName').value, district: document.getElementById('district').value, year: currentYear };
    if (!newCommunity.name || !newCommunity.district) { alert("Fields cannot be empty."); return; }
    communities.push(newCommunity);
    await saveDataToServer();
    showNotification("Community added successfully!");
    await showSection('communities');
}

async function updateCommunity(id) {
    const index = communities.findIndex(c => c.id === id);
    if (index === -1) return;
    communities[index] = { ...communities[index], name: document.getElementById('editCommunityName').value, district: document.getElementById('editDistrict').value };
    await saveDataToServer();
    await showSection('communities');
}

async function deleteCommunity(event, id) {
    event.stopPropagation();
    if (confirm("DELETE COMMUNITY and all its troops and members?")) {
        communities = communities.filter(c => c.id !== id);
        const troopsToDelete = troops.filter(t => t.community_id === id).map(t => t.id);
        troops = troops.filter(t => t.community_id !== id);
        members = members.filter(m => !troopsToDelete.includes(m.troop_id));
        await saveDataToServer();
        await showSection('communities');
    }
}


// ===================================================================================
// --- 5. TROOP MANAGEMENT ---
// ===================================================================================

async function renderTroopTable(type, ageLevelFilter = "All Age Levels", searchTerm = "") {
    const tableBody = document.querySelector('#troopTable tbody');
    if (!tableBody) return;
    
    let filteredTroops = troops.filter(t => t.type === type && t.year === currentYear);
    
    if (ageLevelFilter !== "All Age Levels") {
        filteredTroops = filteredTroops.filter(t => t.age_level === ageLevelFilter);
    }
    
    // FIX: Enhanced Search Logic for Troops
    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        filteredTroops = filteredTroops.filter(t => {
            const troopName = (t.name || '').toLowerCase();
            const troopNo = (t.troop_no || '').toLowerCase();
            const parentName = type === 'School Based' 
                ? (schools.find(s => s.id === t.school_id)?.name || '').toLowerCase()
                : (communities.find(c => c.id === t.community_id)?.name || '').toLowerCase();
            
            return troopName.includes(lower) || 
                   troopNo.includes(lower) || 
                   parentName.includes(lower);
        });
    }

    tableBody.innerHTML = filteredTroops.map(t => {
        const baseName = type === 'School Based' ? schools.find(s => s.id === t.school_id)?.name : communities.find(c => c.id === t.community_id)?.name;
        const memberCount = members.filter(m => m.troop_id === t.id && m.year === currentYear).length;
        return `
            <tr onclick="showTroopDetails(event, ${t.id}, '${type}')">
                <td>${baseName || 'N/A'}</td>
                <td>${t.name}</td>
                <td>${t.troop_no}</td>
                <td>${t.troop_leader || 'N/A'}</td>
                <td>${t.co_leader || 'N/A'}</td>
                <td>${t.age_level}</td>
                <td>${memberCount}/40</td>
                <td class="actions-cell">
                    <button class="edit-btn" onclick="showEditTroopForm(event, ${t.id}, '${type}')">Edit</button>
                    <button class="delete-btn" onclick="deleteTroop(event, ${t.id}, '${type}')">DELETE</button>
                </td>
            </tr>`;
    }).join('');
}

async function showTroopList(type) {
    const baseName = type === 'School Based' ? 'School' : 'Community';
    const firstColumnHeader = type === 'School Based' ? 'School Name' : 'Community Name';

    document.getElementById('main-content').innerHTML = `
        <h1>${type} Troops (${formatSchoolYear(currentYear)})</h1>
        <div class="troop-list-controls">
            <div class="controls-left">
                <button onclick="showAddTroopForm('${type}')">Add New Troop</button>
                <button class="print-btn" onclick="printTroopReport('${type}')">Print</button>
            </div>
            <div class="controls-right">
                <label for="ageLevelFilter">Filter Age Level:</label>
                <select id="ageLevelFilter" onchange="renderTroopTable('${type}', this.value, document.getElementById('troopBaseSearch').value)">
                    ${ageLevelFilterOptions}
                </select>
                <label for="troopBaseSearch">Search:</label>
                <input type="text" id="troopBaseSearch" placeholder="${baseName}, Name, or No." onkeyup="renderTroopTable('${type}', document.getElementById('ageLevelFilter').value, this.value)">
                <button class="toggle-edit" onclick="toggleEdit('troopTable')">Edit</button>
            </div>
        </div>
        <div id="form-container"></div>
        <table id="troopTable" class="hidden-actions">
            <thead>
                <tr>
                    <th>${firstColumnHeader}</th>
                    <th>Troop Name</th>
                    <th>Troop No.</th>
                    <th>Leader</th>
                    <th>Co-Leader</th>
                    <th>Age Level</th>
                    <th>Number of Girls</th>
                    <th></th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>`;
    await renderTroopTable(type);
}

async function showTroopDetails(event, id, returnPath) {
    if (event) {
        event.stopPropagation();
    }
    const troop = troops.find(t => t.id === id);
    if (!troop) return;

    const membersData = members.filter(m => m.troop_id === id && m.year === currentYear);
    
    // Check if we are in Read-Only mode (navigated from School or Community)
    const isReadOnly = (typeof returnPath === 'number');

    let backButton = '';
    if (returnPath === 'School Based') {
        backButton = `<button onclick="showTroopList('School Based')">← Back to School Troops</button>`;
    } else if (returnPath === 'Community Based') {
        backButton = `<button onclick="showTroopList('Community Based')">← Back to Community Troops</button>`;
    } else if (isReadOnly) {
        if (troop.type === 'School Based') {
            backButton = `<button onclick="showSchoolDetails(event, ${returnPath})">← Back to School</button>`;
        } else {
            backButton = `<button onclick="showCommunityDetails(event, ${returnPath})">← Back to Community</button>`;
        }
    } else {
        if (troop.type === 'School Based') {
            backButton = `<button onclick="showTroopList('School Based')">← Back to School Troops</button>`;
        } else {
             backButton = `<button onclick="showTroopList('Community Based')">← Back to Community Troops</button>`;
        }
    }

    const baseInfo = troop.type === 'School Based' 
        ? `<p><strong>School:</strong> ${schools.find(s => s.id === troop.school_id)?.name || 'N/A'}</p>`
        : `<p><strong>Community:</strong> ${communities.find(c => c.id === troop.community_id)?.name || 'N/A'}</p>`;
    
    document.getElementById('main-content').innerHTML = `
        ${backButton}
        <h2>${troop.name} (#${troop.troop_no})</h2>
        ${baseInfo}
        <p><strong>Age Level:</strong> ${troop.age_level || 'N/A'}</p>
        <p><strong>Leader:</strong> ${troop.troop_leader || 'N/A'}</p>
        <p><strong>Co-Leader:</strong> ${troop.co_leader || 'N/A'}</p>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 30px; margin-bottom: 10px;">
            <h3 style="margin: 0;">Members (${membersData.length})</h3>
            ${!isReadOnly ? `
            <div>
                <button onclick="showAddMemberForm(${id})">Add Member</button>
                <button class="toggle-edit" style="margin-left: 10px;" onclick="toggleEdit('memberTable')">Edit</button>
            </div>` : ''}
        </div>

        <div id="form-container"></div>

        <table id="memberTable" class="${!isReadOnly ? 'hidden-actions' : ''}">
             <thead>
                <tr>
                    <th>Last Name</th>
                    <th>First Name</th>
                    <th>Status</th>
                    <th style="min-width: 100px;">DOB</th>
                    <th>Age</th>
                    <th>Age Level</th>
                    <th>Beneficiary</th>
                    ${!isReadOnly ? `<th></th>` : ''}
                </tr>
            </thead>
            <tbody>
                ${membersData.map(m => `
                    <tr>
                        <td>${m.last_name}</td>
                        <td>${m.first_name}</td>
                        <td>${m.reg_status}</td>
                        <td>${m.dob || 'N/A'}</td>
                        <td>${m.age || 'N/A'}</td>
                        <td>${m.age_level || 'N/A'}</td>
                        <td>${m.beneficiary || 'N/A'}</td>
                        ${!isReadOnly ? `
                        <td class="actions-cell">
                            <button class="view-btn" onclick="showMemberDetails(event, ${m.id}, ${id})">
                                <svg xmlns="http://www.w3.org/2000/svg" height="16" viewBox="0 0 24 24" width="16" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M12 4C7 4 2.73 7.11 1 11.5 2.73 15.89 7 19 12 19s9.27-3.11 11-7.5C21.27 7.11 17 4 12 4zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                            </button>
                            <button class="edit-btn" onclick="showEditMemberForm(event, ${m.id}, ${id})">Edit</button>
                            <button class="delete-btn" onclick="deleteMember(event, ${m.id}, ${id})">DELETE</button>
                        </td>` : ''}
                    </tr>`).join('')}
            </tbody>
        </table>`;
}

function filterContextDropdown(type) {
    const input = document.getElementById('contextSearchInput');
    const filter = input.value.toLowerCase();
    const listContainer = input.parentElement.querySelector('.searchable-dropdown-list');
    const items = (type === 'School Based')
        ? schools.filter(s => s.year === currentYear)
        : communities.filter(c => c.year === currentYear);

    listContainer.innerHTML = '';
    const filteredItems = items.filter(item => item.name.toLowerCase().includes(filter));

    if (filteredItems.length) {
        filteredItems.forEach(item => {
            const div = document.createElement('div');
            div.className = 'dropdown-item';
            div.textContent = item.name;
            div.addEventListener('mousedown', () => selectContextItem(item.id, item.name));
            listContainer.appendChild(div);
        });
    } else {
        listContainer.innerHTML = '<div class="no-results">No results found</div>';
    }
    listContainer.style.display = 'block';
}

function selectContextItem(id, name) {
    const input = document.getElementById('contextSearchInput');
    const hiddenInput = document.getElementById('contextSelect');
    const listContainer = input.parentElement.querySelector('.searchable-dropdown-list');
    
    input.value = name;
    hiddenInput.value = id;
    listContainer.style.display = 'none';
}

async function showAddTroopForm(type, contextId = null) {
    let contextData, label, placeholder, preselectedName = '';

    if (type === 'School Based') {
        contextData = schools.filter(s => s.year === currentYear);
        label = 'School';
        placeholder = 'Search for a school...';
        if (contextId) preselectedName = schools.find(s => s.id === contextId)?.name || '';
    } else {
        contextData = communities.filter(c => c.year === currentYear);
        label = 'Community';
        placeholder = 'Search for a community...';
        if (contextId) preselectedName = communities.find(c => c.id === contextId)?.name || '';
    }

    const optionsHTML = contextData.map(item =>
        `<div class="dropdown-item" onmousedown="selectContextItem(${item.id}, '${item.name.replace(/'/g, "\\'")}')">${item.name}</div>`
    ).join('');

    const selectorHTML = `
        <div class="form-group searchable-dropdown-container">
            <label>${label}:</label>
            <input type="text" id="contextSearchInput" placeholder="${placeholder}"
                   oninput="filterContextDropdown('${type}')"
                   onfocus="filterContextDropdown('${type}')"
                   onblur="setTimeout(() => { this.parentElement.querySelector('.searchable-dropdown-list').style.display = 'none'; }, 200)"
                   value="${preselectedName}"
                   ${contextId ? 'disabled' : ''}
                   autocomplete="off">
            <input type="hidden" id="contextSelect" value="${contextId || ''}">
            <div class="searchable-dropdown-list">${optionsHTML}</div>
        </div>
    `;

    document.getElementById('form-container').innerHTML = `
        <h3>Add ${type} Troop</h3>
        <div class="form-layout-container">
            ${selectorHTML}
            <div class="form-group"><label>Troop No.:</label><input id="troopNo"></div>
            <div class="form-group"><label>Troop Name:</label><input id="troopName"></div>
            <div class="form-group"><label>Age Level:</label><select id="ageLevel">${ageLevelFilterOptions}</select></div>
            <div class="form-group"><label>Leader:</label><input id="troopLeader"></div>
            <div class="form-group"><label>Co-Leader:</label><input id="coLeader"></div>
            <div class="form-actions">
                <button onclick="addTroop('${type}', ${contextId})">Save</button>
                <button class="cancel-btn" onclick="cancelForm()">Cancel</button>
            </div>
        </div>`;
}


async function showEditTroopForm(event, id, returnId) {
    event.stopPropagation();
    const troop = troops.find(t => t.id === id);
    if (!troop) return;
    
    const container = getInlineFormContainer(event);
    container.innerHTML = `
        <h3>Edit Troop</h3>
        <div class="form-layout-container">
            <div class="form-group"><label>Troop No.:</label><input id="editTroopNo" value="${troop.troop_no}"></div>
            <div class="form-group"><label>Edit Troop Name:</label><input id="editTroopName" value="${troop.name}"></div>
            <div class="form-group"><label>Age Level:</label><select id="editAgeLevel">${ageLevelFilterOptions}</select></div>
            <div class="form-group"><label>Leader:</label><input id="editTroopLeader" value="${troop.troop_leader || ''}"></div>
            <div class="form-group"><label>Co-Leader:</label><input id="editCoLeader" value="${troop.co_leader || ''}"></div>
            <div class="form-actions">
                <button onclick="updateTroop(${id}, '${returnId}')">Save</button>
                <button class="cancel-btn" onclick="cancelForm()">Cancel</button>
                <button class="form-delete-btn" onclick="deleteTroop(event, ${id}, '${returnId}')">DELETE</button>
            </div>
        </div>`;
    document.getElementById('editAgeLevel').value = troop.age_level;
}

async function addTroop(type, contextId = null) {
    const selectedId = contextId || parseInt(document.getElementById('contextSelect').value);
    const newTroop = {
        id: Date.now(), type, year: currentYear,
        school_id: type === 'School Based' ? selectedId : null,
        community_id: type === 'Community Based' ? selectedId : null,
        troop_no: document.getElementById('troopNo').value, name: document.getElementById('troopName').value,
        age_level: document.getElementById('ageLevel').value, troop_leader: document.getElementById('troopLeader').value,
        co_leader: document.getElementById('coLeader').value
    };
    if (!newTroop.troop_no || !newTroop.name || !selectedId) { alert("Required fields cannot be empty."); return; }
    troops.push(newTroop);
    await saveDataToServer();
    showNotification(type + " added successfully!");
    if (contextId) {
        if (type === 'School Based') showSchoolDetails(null, contextId);
        else showCommunityDetails(null, contextId);
    } else {
        showTroopList(type);
    }
}

async function updateTroop(id, returnId) {
    const index = troops.findIndex(t => t.id === id);
    if (index === -1) return;
    troops[index] = {
        ...troops[index],
        troop_no: document.getElementById('editTroopNo').value,
        name: document.getElementById('editTroopName').value,
        age_level: document.getElementById('editAgeLevel').value,
        troop_leader: document.getElementById('editTroopLeader').value,
        co_leader: document.getElementById('editCoLeader').value
    };
    await saveDataToServer();
    if (returnId === 'School Based' || returnId === 'Community Based') {
        await showTroopList(returnId);
    } else if (troops[index].type === 'School Based') {
        await showSchoolDetails(null, parseInt(returnId));
    } else {
        await showCommunityDetails(null, parseInt(returnId));
    }
}

async function deleteTroop(event, id, returnId) {
    event.stopPropagation();
    if (confirm("DELETE TROOP and its members?")) {
        const troop = troops.find(t => t.id === id);
        troops = troops.filter(t => t.id !== id);
        members = members.filter(m => m.troop_id !== id);
        await saveDataToServer();
        if (returnId === 'School Based' || returnId === 'Community Based') {
            await showTroopList(returnId);
        } else if (troop?.type === 'School Based') {
            await showSchoolDetails(null, parseInt(returnId));
        } else {
            await showCommunityDetails(null, parseInt(returnId));
        }
    }
}


// ===================================================================================
// --- 6. MEMBER MANAGEMENT ---
// ===================================================================================

async function renderMemberManagement() {
    const mainContent = document.getElementById('main-content');
    const currentMembers = members.filter(m => m.year === currentYear);

    // Calculate counts for each age level
    const levelCounts = ageLevels.reduce((acc, level) => {
        acc[level] = 0;
        return acc;
    }, {});
    currentMembers.forEach(member => {
        if (levelCounts.hasOwnProperty(member.age_level)) {
            levelCounts[member.age_level]++;
        }
    });

    const filterOptions = ageLevels.map(level =>
        `<option value="${level}">${level} (${levelCounts[level]})</option>`
    ).join('');

    mainContent.innerHTML = `
        <h1>Members (${formatSchoolYear(currentYear)})</h1>
        <div class="member-list-controls">
            <input type="text" id="searchBar" onkeyup="filterMembersTable()" placeholder="Search members...">
            <div class="filter-container">
                <label for="ageLevelFilter">Filter by Age Level:</label>
                <select id="ageLevelFilter" onchange="filterMembersTable()">
                    <option value="All Age Levels">All Age Levels (${currentMembers.length})</option>
                    ${filterOptions}
                </select>
            </div>
            <button class="toggle-edit" onclick="toggleEdit('dataTable')">Edit</button>
        </div>
        <div id="form-container"></div>
        <table id="dataTable" class="hidden-actions">
            <thead>
                <tr>
                    <th>Last Name</th>
                    <th>First Name</th>
                    <th>Troop No.</th>
                    <th>DOB</th>
                    <th>Age</th>
                    <th>Age Level</th>
                    <th>Status</th>
                    <th>Beneficiary</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                ${currentMembers.map(member => {
                    const troop = troops.find(t => t.id === member.troop_id);
                    return `
                    <tr data-age-level="${member.age_level || ''}">
                        <td>${member.last_name}</td>
                        <td>${member.first_name}</td>
                        <td>${troop ? troop.troop_no : 'N/A'}</td>
                        <td>${member.dob || 'N/A'}</td>
                        <td>${member.age || 'N/A'}</td>
                        <td>${member.age_level || 'N/A'}</td>
                        <td>${member.reg_status}</td>
                        <td>${member.beneficiary || 'N/A'}</td>
                        <td class="actions-cell">
                            <button class="edit-btn" onclick="showEditMemberForm(event, ${member.id}, 'members')">Edit</button>
                            <button class="delete-btn" onclick="deleteMember(event, ${member.id}, 'members')">DELETE</button>
                        </td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>`;
}

async function filterMembersTable() {
    const ageLevelFilterValue = document.getElementById('ageLevelFilter').value;
    const searchTerm = document.getElementById('searchBar').value.toUpperCase();
    const table = document.getElementById('dataTable');
    const trs = table.querySelectorAll("tbody tr");

    trs.forEach(row => {
        const ageLevel = row.dataset.ageLevel;
        const textContent = row.textContent.toUpperCase();

        const ageLevelMatch = (ageLevelFilterValue === 'All Age Levels' || ageLevel === ageLevelFilterValue);
        const searchTermMatch = textContent.includes(searchTerm);

        if (ageLevelMatch && searchTermMatch) {
            row.style.display = "";
        } else {
            row.style.display = "none";
        }
    });
}


async function showAddMemberForm(troopId) {
    document.getElementById('form-container').innerHTML = `
        <h3>Add Member</h3>
        <div class="form-layout-container">
            <div class="form-group"><label>Last Name:</label><input id="lastName"></div>
            <div class="form-group"><label>First Name:</label><input id="firstName"></div>
            <div class="form-group"><label>DOB:</label><input type="date" id="dob"></div>
            <div class="form-group"><label>Age:</label><input type="number" id="age"></div>
            <div class="form-group"><label>Age Level:</label><select id="ageLevel">${ageLevelOptions}</select></div>
            <div class="form-group"><label>Status:</label><select id="regStatus"><option>New</option><option>Re-Reg</option></select></div>
            <div class="form-group"><label>Beneficiary:</label><input id="beneficiary"></div>
            <div class="form-actions">
                <button onclick="addMember(${troopId})">Save</button>
                <button class="cancel-btn" onclick="cancelForm()">Cancel</button>
            </div>
        </div>`;
}

async function showEditMemberForm(event, id, returnId) {
    event.stopPropagation();
    const member = members.find(m => m.id === id);
    if (!member) return;
    
    const container = getInlineFormContainer(event);
    container.innerHTML = `
        <h3>Edit Member</h3>
        <div class="form-layout-container">
            <div class="form-group"><label>Last Name:</label><input id="editLastName" value="${member.last_name}"></div>
            <div class="form-group"><label>First Name:</label><input id="editFirstName" value="${member.first_name}"></div>
            <div class="form-group"><label>DOB:</label><input type="date" id="editDob" value="${member.dob ? member.dob.split('T')[0] : ''}"></div>
            <div class="form-group"><label>Age:</label><input type="number" id="editAge" value="${member.age}"></div>
            <div class="form-group"><label>Age Level:</label><select id="editAgeLevel">${ageLevelOptions}</select></div>
            <div class="form-group"><label>Status:</label><select id="editRegStatus"><option>New</option><option>Re-Reg</option></select></div>
            <div class="form-group"><label>Beneficiary:</label><input id="editBeneficiary" value="${member.beneficiary}"></div>
            <div class="form-actions">
                <button onclick="updateMember(${id}, '${returnId}')">Save</button>
                <button class="cancel-btn" onclick="cancelForm()">Cancel</button>
            </div>
        </div>`;
    document.getElementById('editRegStatus').value = member.reg_status;
    document.getElementById('editAgeLevel').value = member.age_level;
}

async function addMember(troopId) {
    const newMember = {
        id: Date.now(), troop_id: troopId, year: currentYear,
        last_name: document.getElementById('lastName').value, first_name: document.getElementById('firstName').value,
        dob: document.getElementById('dob').value, age: document.getElementById('age').value,
        age_level: document.getElementById('ageLevel').value, reg_status: document.getElementById('regStatus').value,
        beneficiary: document.getElementById('beneficiary').value
    };
    if (!newMember.last_name || !newMember.first_name) { alert("Name fields are required."); return; }
    members.push(newMember);
    await saveDataToServer();
    showNotification("Member added successfully!");
    await showTroopDetails(null, troopId);
}

async function updateMember(id, returnId) {
    const index = members.findIndex(m => m.id === id);
    if (index === -1) return;
    members[index] = {
        ...members[index],
        last_name: document.getElementById('editLastName').value, first_name: document.getElementById('editFirstName').value,
        dob: document.getElementById('editDob').value, age: document.getElementById('editAge').value,
        age_level: document.getElementById('editAgeLevel').value, reg_status: document.getElementById('editRegStatus').value,
        beneficiary: document.getElementById('editBeneficiary').value
    };
    await saveDataToServer();
    if (returnId === 'members') await showSection('members');
    else await showTroopDetails(null, parseInt(returnId));
}

async function deleteMember(event, id, returnId) {
    event.stopPropagation();
    if (confirm("Delete this member?")) {
        members = members.filter(m => m.id !== id);
        await saveDataToServer();
        if (returnId === 'members') await showSection('members');
        else await showTroopDetails(null, parseInt(returnId));
    }
}

async function showMemberDetails(event, memberId, troopId) {
    event.stopPropagation();
    const member = members.find(m => m.id === memberId);
    if (!member) return;

    const troop = troops.find(t => t.id === troopId);
    let contextInfo = '';
    if (troop) {
        if (troop.type === 'School Based') {
            const school = schools.find(s => s.id === troop.school_id);
            contextInfo = `<p><strong>School:</strong> ${school ? school.name : 'N/A'}</p>`;
        } else {
            const community = communities.find(c => c.id === troop.community_id);
            contextInfo = `<p><strong>Community:</strong> ${community ? community.name : 'N/A'}</p>`;
        }
    }

    document.getElementById('main-content').innerHTML = `
        <button onclick="showTroopDetails(event, ${troopId})">← Back to Troop</button>
        <h2>${member.first_name} ${member.last_name}</h2>
        
        <div class="details-container" style="background: #fff; padding: 20px; border-radius: 8px;">
            <h3>Member Information</h3>
            <p><strong>Troop:</strong> ${troop ? troop.name : 'N/A'}</p>
            ${contextInfo}
            <hr>
            <p><strong>Date of Birth:</strong> ${member.dob || 'N/A'}</p>
            <p><strong>Age:</strong> ${member.age || 'N/A'}</p>
            <p><strong>Age Level:</strong> ${member.age_level || 'N/A'}</p>
            <p><strong>Registration Status:</strong> ${member.reg_status}</p>
            <p><strong>Beneficiary:</strong> ${member.beneficiary || 'N/A'}</p>
        </div>
    `;
}


// ===================================================================================
// --- 7. CORE APP LOGIC & INITIALIZATION ---
// ===================================================================================

// LOGIN & LOGOUT FUNCTIONS
function showLoginScreen() { document.getElementById('app-container').style.display = 'none'; const loginContainer = document.getElementById('login-container'); loginContainer.style.display = 'flex'; loginContainer.innerHTML = `<div class="login-box"><h1>GSP Admin Login</h1><div class="form-group"><input type="text" id="username" placeholder="Username" required></div><div class="form-group"><input type="password" id="password" placeholder="Password" required></div><button onclick="handleLogin()">Login</button><p class="error-message" id="login-error"></p></div>`; }
async function handleLogin() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('login-error');
    errorEl.textContent = '';

    if (username === 'admin' && password === 'admin') {
        isLoggedIn = true;
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        await initializeApp();
    } else {
        errorEl.textContent = 'Invalid username or password.';
    }
}
function handleLogout() { isLoggedIn = false; showLoginScreen(); alert('You have been logged out.'); }

// CORE RENDER & NAVIGATION
async function changeYear(year) { currentYear = year; await showSection('dashboard'); }

async function goToNextYear() {
    const currentIndex = availableYears.indexOf(currentYear);
    if (currentIndex < availableYears.length - 1) {
        changeYear(availableYears[currentIndex + 1]);
    }
}

async function goToPreviousYear() {
    const currentIndex = availableYears.indexOf(currentYear);
    if (currentIndex > 0) {
        changeYear(availableYears[currentIndex - 1]);
    }
}

async function promptAndAddYear() {
    const yearInput = prompt("Please enter the year to add (e.g., 2026):");
    if (!yearInput) return;

    const newYear = parseInt(yearInput, 10);
    if (isNaN(newYear) || newYear < 1900 || newYear > 2100) {
        alert("Please enter a valid year.");
        return;
    }

    const allYearsSet = new Set(schools.map(s => s.year).concat(members.map(m => m.year)).concat(troops.map(t => t.year)));
    const existingYears = Array.from(allYearsSet).sort((a,b)=>a-b);

    if (existingYears.includes(newYear)) {
        alert(`Year ${formatSchoolYear(newYear)} already exists.`);
        return;
    }
    
    // FIX: Ask user if they want to copy data or start fresh
    const previousYear = existingYears.length > 0 ? existingYears[existingYears.length - 1] : null;
    
    if (previousYear) {
        const choice = confirm(`Year ${formatSchoolYear(newYear)} created. \n\nClick OK to COPY schools/troops/members from year ${formatSchoolYear(previousYear)}. \nClick CANCEL to START FRESH (Empty Year).`);
        
        currentYear = newYear;
        if (choice) {
            showCopyDataScreen(newYear, previousYear);
        } else {
            showNotification(`Started fresh for year ${formatSchoolYear(newYear)}.`);
            await showSection('dashboard');
        }
    } else {
        currentYear = newYear;
        alert(`Year ${formatSchoolYear(newYear)} has been created as the first year.`);
        await showSection('dashboard');
    }
}

async function promptAndCopyData() {
    // Collect all unique years in the database
    const allYears = new Set([
        ...schools.map(s => s.year),
        ...members.map(m => m.year),
        ...troops.map(t => t.year),
        ...communities.map(c => c.year)
    ]);
    
    // Sort years descending to find the one immediately before the viewing year
    const existingYearsBeforeCurrent = Array.from(allYears)
        .filter(y => y < currentYear)
        .sort((a, b) => b - a);

    if (existingYearsBeforeCurrent.length === 0) {
        alert("No previous year found to copy data from.");
        return;
    }

    const previousYear = existingYearsBeforeCurrent[0];

    if (confirm(`This will open a screen to copy selected data from year ${formatSchoolYear(previousYear)} into the current year, ${formatSchoolYear(currentYear)}. Existing data in year ${formatSchoolYear(currentYear)} will NOT be overwritten. Do you want to continue?`)) {
        showCopyDataScreen(currentYear, previousYear);
    }
}

function toggleTroopSubmenu(event) { event.preventDefault(); document.getElementById('troop-menu-item').classList.toggle('open'); const submenu = document.getElementById('troop-submenu'); submenu.style.display = submenu.style.display === 'block' ? 'none' : 'block'; }
async function showSection(sectionId) {
    if (!isLoggedIn && sectionId !== 'login') { handleLogout(); return; }
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = '';

    if (overallChartInstance) overallChartInstance.destroy();
    if (breakdownChartInstance) breakdownChartInstance.destroy();
    if (retentionChartInstance) retentionChartInstance.destroy();
    if (predictionChartInstance) predictionChartInstance.destroy(); 
    if (statusChartInstance) statusChartInstance.destroy();

    try {
        switch (sectionId) {
            case 'dashboard': await renderDashboard(); break;
            case 'schools': await renderSchoolManagement(); break;
            case 'communities': await renderCommunityManagement(); break;
            case 'members': await renderMemberManagement(); break;
            case 'settings': await renderSettings(); break;
            default: mainContent.innerHTML = `<p>Section "${sectionId}" not found.</p>`;
        }
    } catch (error) {
        console.error(`Error rendering section ${sectionId}:`, error);
        mainContent.innerHTML = `<p style="color: red;">Error: ${error.message || 'An unexpected error occurred.'}</p>`;
    }
}

// DASHBOARD & CHARTS
async function renderDashboard() {
    const allYearsSet = new Set(schools.map(s => s.year).concat(members.map(m => m.year)).concat(troops.map(t => t.year)));
    availableYears = Array.from(allYearsSet).sort((a, b) => a - b);
    if (!availableYears.includes(currentYear)) availableYears.push(currentYear);
    availableYears.sort((a, b) => a - b);

    const membersByYear = {};
    availableYears.forEach(year => {
        membersByYear[year] = members.filter(m => m.year === year);
    });

    const currentCount = membersByYear[currentYear]?.length || 0;
    const kpi = {
        totalMembers: currentCount,
        totalTroops: troops.filter(t => t.year === currentYear).length
    };
    
    // FIX: Accurate Inactive Status Calculation
    const prevYear = currentYear - 1;
    const prevYearMembersList = members.filter(m => m.year === prevYear);
    const currentMembersList = membersByYear[currentYear] || [];

    const normalizeName = (first, last) => `${(first || '').trim().toLowerCase()}|${(last || '').trim().toLowerCase()}`;
    const activeMemberKeys = new Set(currentMembersList.map(m => normalizeName(m.first_name, m.last_name)));

    const inactiveCount = prevYearMembersList.filter(pm => 
        !activeMemberKeys.has(normalizeName(pm.first_name, pm.last_name))
    ).length;
    
    const statusData = { active: kpi.totalMembers, inactive: inactiveCount };
    
    // FIX: Accurate Retention Logic
    const retentionData = { 
        new: membersByYear[currentYear].filter(m => (m.reg_status || '').trim() === 'New').length, 
        returning: membersByYear[currentYear].filter(m => (m.reg_status || '').trim() === 'Re-Reg').length 
    };
    
    const breakdownData = ageLevels.reduce((acc, level) => { acc[level] = membersByYear[currentYear].filter(m => m.age_level === level).length; return acc; }, {});
    
    // FIX: Updated Growth Rate Calculation and KPI Display
    const prevCount = prevYearMembersList.length;
    let growthRatePercent = 0;
    if (prevCount > 0) {
        growthRatePercent = ((currentCount - prevCount) / prevCount) * 100;
    }

    const growthColor = growthRatePercent >= 0 ? '#00843D' : '#d9534f';
    const growthPercentDisplay = growthRatePercent.toFixed(2); // Fix: 2 Decimal points

    const mainContent = document.getElementById('main-content');
    
    mainContent.innerHTML = `
        <div class="dashboard-header">
            <h1>Dashboard</h1>
            <div class="dashboard-search">
                <div class="search-wrapper">
                    <input type="text" id="globalSearchInput" placeholder="Search in year ${formatSchoolYear(currentYear)}..." onkeyup="if(event.keyCode===13) handleGlobalSearch()" oninput="handleGlobalSearchSuggestions(event)" autocomplete="off">
                    <div id="search-suggestions"></div>
                </div>
                <button onclick="handleGlobalSearch()">Search</button>
                <button onclick="promptAndAddYear()">Add Year</button>
                <button onclick="promptAndCopyData()">Copy Data</button>
            </div>
        </div>
        
        ${generateYearSelectorHTML()}
        
        <div class="kpi-grid">
            <div class="kpi-card"><p>Total Members (${formatSchoolYear(currentYear)})</p><h3>${kpi.totalMembers.toLocaleString()}</h3></div>
            <div class="kpi-card"><p>Total Troops (${formatSchoolYear(currentYear)})</p><h3>${kpi.totalTroops.toLocaleString()}</h3></div>
            <div class="kpi-chart-card">
                <p>Member Status</p>
                <div class="status-chart-container">
                    <div class="status-chart-wrapper"><canvas id="statusChart"></canvas></div>
                    <div id="status-legend" class="status-legend"></div>
                </div>
            </div>
            <div class="kpi-card">
                <p style="margin-bottom: 20px;">Growth Rate From Past Year</p>
                <h3 style="color: ${growthColor}; font-size: 36px; margin: 0;">${growthPercentDisplay}%</h3>
            </div>
        </div>

        <div class="dashboard-grid">
            <div class="chart-container"><h3>Membership Growth Over Time</h3><canvas id="overallChart"></canvas></div>
            <div class="chart-container"><h3>Member Retention (${formatSchoolYear(currentYear)})</h3><canvas id="retentionChart"></canvas></div>
            <div class="chart-container"><h3>Membership by Age Level (${formatSchoolYear(currentYear)})</h3><canvas id="breakdownChart"></canvas></div>
            <div class="chart-container"><h3>Actual vs. Predicted Members</h3><canvas id="predictionChart"></canvas></div>
        </div>
    `;
    
    renderStatusChart(statusData);
    
    // Overall Growth (Line) Chart data (All Available History)
    const overallLabels = availableYears.filter(y => y <= currentYear).map(formatSchoolYear);
    const overallData = overallLabels.map(lbl => {
        const yr = parseInt(lbl);
        return membersByYear[yr]?.length || 0;
    });
    renderOverallChart(overallData, overallLabels);
    
    renderRetentionChart(retentionChartInstance, retentionData);
    renderBreakdownChart(breakdownData);

    // FIXED: Strict 3-Year Comparison Chart Logic (Past, Present, Future)
    const pastYear = currentYear - 1;
    const futureYear = currentYear + 1;
    const labels = [pastYear, currentYear, futureYear].map(formatSchoolYear);

    // Helper: Safe get count
    const getCount = (yr) => membersByYear[yr]?.length || 0;

    // Helper: Formula Implementation P = Present * (1 + (Present - Past)/Past)
    // To predict Year T, we need Growth from (T-2 to T-1), applied to T-1
    const calculatePred = (targetYr) => {
        const baseYr = targetYr - 1; // "Present" in formula context (year prior to prediction)
        const prevYr = targetYr - 2; // "Past" in formula context
        
        // Safety: If years don't exist in data, return null to show nothing
        // Checks specific to `membersByYear` object keys existence
        if (!membersByYear[baseYr] || !membersByYear[prevYr]) return null;

        const presentVal = getCount(baseYr);
        const pastVal = getCount(prevYr);

        if (pastVal === 0) return null; // Avoid division by zero spike

        const growth = (presentVal - pastVal) / pastVal;
        const predicted = presentVal * (1 + growth);
        return Math.round(predicted);
    };

    // Data for Chart
    // 1. Past Year (current - 1): Comparison (Actual vs Prediction made in past)
    const pastActual = getCount(pastYear);
    const pastPred = calculatePred(pastYear);

    // 2. Current Year: Comparison (Actual vs Prediction made in past)
    const currentActualCount = getCount(currentYear);
    const currentPred = calculatePred(currentYear);

    // 3. Future Year (current + 1): Pure Prediction (No Actual)
    const futurePred = calculatePred(futureYear);

    const predictionChartData = {
        actual: [pastActual, currentActualCount, null],
        predicted: [pastPred, currentPred, futurePred],
        labels: labels
    };

    renderPredictionChart(predictionChartData.actual, predictionChartData.predicted, predictionChartData.labels);
}

function generateYearSelectorHTML() {
    const currentIndex = availableYears.indexOf(currentYear);
    const prevDisabled = currentIndex <= 0 ? 'disabled' : '';
    const nextDisabled = currentIndex >= availableYears.length - 1 ? 'disabled' : '';

    return `<div class="year-selector">
        <button onclick="goToPreviousYear()" title="Go to previous year" ${prevDisabled}>&lsaquo;</button>
        <h2 title="Current viewing year">Viewing Year: ${formatSchoolYear(currentYear)}</h2>
        <button onclick="goToNextYear()" title="Go to next year" ${nextDisabled}>&rsaquo;</button>
    </div>`;
}

function renderStatusChart(data) {
    const ctx = document.getElementById('statusChart').getContext('2d');
    if (statusChartInstance) statusChartInstance.destroy();
    statusChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Active', 'Inactive'],
            datasets: [{
                data: [data.active, data.inactive],
                backgroundColor: ['#00843D', '#c9cbcf'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: { 
                legend: { display: false }, 
                tooltip: { enabled: false } 
            },
            layout: { padding: 10 }
        }
    });

    const legendContainer = document.getElementById('status-legend');
    legendContainer.innerHTML = statusChartInstance.data.labels.map((label, i) => {
        const color = statusChartInstance.data.datasets[0].backgroundColor[i];
        const value = statusChartInstance.data.datasets[0].data[i];
        return `<div class="legend-item">
                    <span class="legend-color-box" style="background-color:${color}"></span>
                    <span class="legend-label">${label}</span>
                    <span class="legend-value">${value.toLocaleString()}</span>
                </div>`;
    }).join('');
}

function renderOverallChart(data, labels) { 
    const ctx = document.getElementById('overallChart').getContext('2d'); 
    if (overallChartInstance) overallChartInstance.destroy(); 
    overallChartInstance = new Chart(ctx, { 
        type: 'line', 
        data: { 
            labels, 
            datasets: [{ label: 'Total Members', data, borderColor: '#00843D', backgroundColor: 'rgba(0, 132, 61, 0.2)', fill: true, tension: 0.3 }] 
        }, 
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            layout: { padding: { left: 15, right: 15, bottom: 25, top: 10 } },
            scales: { 
                y: { beginAtZero: true, grace: '10%' } 
            } 
        } 
    }); 
}

function renderBreakdownChart(data) {
    const ctx = document.getElementById('breakdownChart').getContext('2d');
    if (breakdownChartInstance) breakdownChartInstance.destroy();
    const chartLabels = Object.keys(data);
    const ageLevelColors = { "Twinkler": "#ff607aff", "Star": "#ffea00ff", "Junior": "#ff9d00ff", "Senior": "#f95300ff", "Cadet": "#4e0768ff" };
    breakdownChartInstance = new Chart(ctx, {
        type: 'pie',
        data: { labels: chartLabels, datasets: [{ data: Object.values(data), backgroundColor: chartLabels.map(l => ageLevelColors[l] || '#CCC') }] },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            layout: { padding: { bottom: 20, top: 10 } },
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

function renderRetentionChart(instance, data) { 
    const ctx = document.getElementById('retentionChart').getContext('2d'); 
    if (retentionChartInstance) retentionChartInstance.destroy(); 
    retentionChartInstance = new Chart(ctx, { 
        type: 'bar', 
        data: { labels: ['New Members', 'Returning Members'], datasets: [{ data: [data.new, data.returning], backgroundColor: ['#FFC72C', '#00843D'] }] }, 
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            layout: { padding: { bottom: 20, top: 10, left: 10, right: 10 } },
            plugins: { legend: { display: false } }, 
            scales: { y: { beginAtZero: true, grace: '10%' } } 
        } 
    }); 
}

function renderPredictionChart(actualData, predictedData, labels) {
    const ctx = document.getElementById('predictionChart').getContext('2d');
    if (predictionChartInstance) predictionChartInstance.destroy();
    predictionChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'Actual Members', data: actualData, borderColor: '#00843D', backgroundColor: '#00843D', fill: false, tension: 0.1, borderWidth: 3 },
                { label: 'Predicted Members', data: predictedData, borderColor: '#FFC72C', backgroundColor: '#FFC72C', borderDash: [5, 5], fill: false, tension: 0.1 }
            ]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            layout: { padding: { left: 20, right: 20, bottom: 30, top: 10 } },
            scales: { 
                y: { beginAtZero: true, grace: '10%', title: { display: true, text: 'Number of Members' } } 
            } 
        }
    });
}

async function renderSettings() {
    document.getElementById('main-content').innerHTML = `
        <h1>Settings & Data Management</h1>
        `;
}

// FIX: Improved error handling and wait logic for saving data
async function saveDataToServer() {
    try {
        // CHANGED: Use relative path instead of hardcoded localhost
        const response = await fetch('/api/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ schools, communities, troops, members })
        });
        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}`);
        }
        const result = await response.json();
        console.log("Data successfully persisted:", result.message);
        return true;
    } catch (error) { 
        console.error('CRITICAL SAVE ERROR:', error); 
        alert("CRITICAL ERROR: Data could not be saved to the server. Please check if the server is running.");
        return false;
    }
}

function cancelForm() { 
    document.getElementById('form-container').innerHTML = ''; 
    const existingInline = document.querySelector('.inline-edit-row');
    if (existingInline) existingInline.remove();
}

function toggleEdit(tableId) { 
    const table = document.getElementById(tableId); 
    table.classList.toggle('hidden-actions'); 
    const btns = document.querySelectorAll('.toggle-edit');
    btns.forEach(btn => btn.textContent = table.classList.contains('hidden-actions') ? 'Edit' : 'Done');
}

function escapeHtml(unsafe) { return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function selectSuggestion(text) { document.getElementById('globalSearchInput').value = text; document.getElementById('search-suggestions').style.display = 'none'; handleGlobalSearch(); }

async function handleGlobalSearchSuggestions(event) {
    const input = event.target.value.toLowerCase().trim();
    const container = document.getElementById('search-suggestions');
    if (input.length < 2) { container.style.display = 'none'; return; }
    const suggestions = new Set();
    schools.filter(s => s.year === currentYear && s.name.toLowerCase().includes(input)).forEach(s => suggestions.add(s.name));
    communities.filter(c => c.year === currentYear && c.name.toLowerCase().includes(input)).forEach(c => suggestions.add(c.name));
    troops.filter(t => t.year === currentYear && (t.name.toLowerCase().includes(input) || t.troop_no.toLowerCase().includes(input))).forEach(t => {
        suggestions.add(t.name);
        if (t.troop_no.toLowerCase().includes(input)) suggestions.add(t.troop_no);
    });
    members.filter(m => m.year === currentYear).forEach(m => {
        const fn = `${m.first_name} ${m.last_name}`.toLowerCase();
        if (m.first_name.toLowerCase().includes(input) || m.last_name.toLowerCase().includes(input) || fn.includes(input)) suggestions.add(`${m.first_name} ${m.last_name}`);
    });
    const arr = Array.from(suggestions).slice(0, 10);
    if (arr.length > 0) {
        container.innerHTML = arr.map(s => `<div class="suggestion-item" onclick="selectSuggestion('${s.replace(/'/g, "\\'")}')">${s}</div>`).join('');
        container.style.display = 'block';
    } else container.style.display = 'none';
}

async function handleGlobalSearch() {
    const input = document.getElementById('globalSearchInput').value.toLowerCase().trim();
    if (!input) return;
    const res = {
        schools: schools.filter(s => s.year === currentYear && s.name.toLowerCase().includes(input)),
        communities: communities.filter(c => c.year === currentYear && c.name.toLowerCase().includes(input)),
        troops: troops.filter(t => t.year === currentYear && (t.name.toLowerCase().includes(input) || t.troop_no.toLowerCase().includes(input))),
        members: members.filter(m => m.year === currentYear && (`${m.first_name} ${m.last_name}`.toLowerCase().includes(input)))
    };
    renderSearchResults(res, input);
}

async function renderSearchResults(res, term) {
    const content = document.getElementById('main-content');
    let html = `<button onclick="showSection('dashboard')">← Back</button><h1>Results for "${escapeHtml(term)}"</h1>`;
    if (res.schools.length) { html += `<h3>Schools</h3><table>${res.schools.map(s => `<tr onclick="showSchoolDetails(event, ${s.id})"><td>${s.name}</td></tr>`).join('')}</table>`; }
    if (res.communities.length) { html += `<h3>Communities</h3><table>${res.communities.map(c => `<tr onclick="showCommunityDetails(event, ${c.id})"><td>${c.name}</td></tr>`).join('')}</table>`; }
    if (res.troops.length) { html += `<h3>Troops</h3><table>${res.troops.map(t => `<tr onclick="showTroopDetails(event, ${t.id})"><td>${t.name} (${t.troop_no})</td></tr>`).join('')}</table>`; }
    if (res.members.length) { html += `<h3>Members</h3><table>${res.members.map(m => `<tr onclick="showMemberDetails(event, ${m.id}, ${m.troop_id})"><td>${m.first_name} ${m.last_name}</td></tr>`).join('')}</table>`; }
    content.innerHTML = html;
}

function showCopyDataScreen(newYear, previousYear) {
    const content = document.getElementById('main-content');
    const build = (items, tp, mem, type) => items.map(bi => {
        const relT = tp.filter(t => t[`${type}_id`] === bi.id);
        const tList = relT.map(t => {
            const relM = mem.filter(m => m.troop_id === t.id);
            const mList = relM.map(m => `<li class="no-children"><label><input type="checkbox" data-type="member" value="${m.id}" data-parent-troop="${t.id}">${m.first_name} ${m.last_name}</label></li>`).join('');
            return `<li class="${!relM.length ? 'no-children' : ''}"><label><input type="checkbox" data-type="troop" value="${t.id}" data-parent-${type}="${bi.id}"><span class="copy-item-label">${t.name}</span></label>${relM.length ? `<ul class="nested-list">${mList}</ul>` : ''}</li>`;
        }).join('');
        return `<li class="${!relT.length ? 'no-children' : ''}"><label><input type="checkbox" data-type="${type}" value="${bi.id}"><span class="copy-item-label">${bi.name}</span></label>${relT.length ? `<ul class="nested-list">${tList}</ul>` : ''}</li>`;
    }).join('');

    const tpP = troops.filter(t => t.year === previousYear);
    const mP = members.filter(m => m.year === previousYear);
    content.innerHTML = `
    <div class="copy-data-container">
        <div class="copy-data-header">
            <h1>Copy to Year ${formatSchoolYear(newYear)}</h1>
            <input type="text" id="copySearchInput" placeholder="Search schools, troops, or members..." onkeyup="filterCopyData()">
        </div>
        <div class="copy-data-grid">
            <div class="copy-data-section"><h3>Schools</h3><ul class="copy-data-list">${build(schools.filter(s => s.year === previousYear), tpP, mP, 'school')}</ul></div>
            <div class="copy-data-section"><h3>Communities</h3><ul class="copy-data-list">${build(communities.filter(c => c.year === previousYear), tpP, mP, 'community')}</ul></div>
        </div>
        <button onclick="processCopyData(${newYear})">Copy</button>
    </div>`;
    document.querySelectorAll('.copy-item-label').forEach(l => l.onclick = toggleCopyListItem);
    document.querySelectorAll('input[type="checkbox"]').forEach(c => c.onchange = handleCheckboxChange);
}

function toggleCopyListItem(e) { const next = e.target.closest('label').nextElementSibling; if (next) { e.target.classList.toggle('expanded'); next.style.display = next.style.display === 'block' ? 'none' : 'block'; } }
function handleCheckboxChange(e) { const li = e.target.closest('li'); if (!e.target.checked) li.querySelectorAll('input').forEach(c => c.checked = false); else { let p = li.parentElement.closest('li'); while (p) { p.querySelector('input').checked = true; p = p.parentElement.closest('li'); } } }

// FIX: Ensure copied members are set to 'Re-Reg' and have aged
async function processCopyData(newYear) {
    const idMap = {}; let idC = Date.now();
    document.querySelectorAll('input[data-type="school"]:checked').forEach(b => { const os = schools.find(s => s.id == b.value); const ns = { ...os, id: ++idC, year: newYear }; schools.push(ns); idMap[os.id] = ns.id; });
    document.querySelectorAll('input[data-type="community"]:checked').forEach(b => { const oc = communities.find(c => c.id == b.value); const nc = { ...oc, id: ++idC, year: newYear }; communities.push(nc); idMap[oc.id] = nc.id; });
    document.querySelectorAll('input[data-type="troop"]:checked').forEach(b => { const ot = troops.find(t => t.id == b.value); const nt = { ...ot, id: ++idC, year: newYear, school_id: idMap[ot.school_id] || null, community_id: idMap[ot.community_id] || null }; if (nt.school_id || nt.community_id) { troops.push(nt); idMap[ot.id] = nt.id; } });
    
    document.querySelectorAll('input[data-type="member"]:checked').forEach(b => { 
        const om = members.find(m => m.id == b.value); 
        const nm = { 
            ...om, 
            id: ++idC, 
            year: newYear, 
            troop_id: idMap[om.troop_id], 
            reg_status: 'Re-Reg', // Explicitly set to Re-Reg
            age: (om.age || 0) + 1 // Increment age
        }; 
        if (nm.troop_id) members.push(nm); 
    });
    
    await saveDataToServer(); 
    alert("Data Copied Successfully!"); 
    showSection('dashboard');
}

async function initializeApp() {
    if (!isLoggedIn) return;
    try {
        // CHANGED: Use relative path instead of hardcoded localhost
        const response = await fetch('/api/data');
        const data = await response.json();
        schools = data.schools; communities = data.communities; troops = data.troops; members = data.members;
        
        const allYears = [...new Set([...schools, ...communities, ...troops, ...members].map(item => item.year))];
        if (allYears.length > 0) {
            const maxYearInData = Math.max(...allYears);
            const currentYearHasData = schools.some(s => s.year === currentYear) || members.some(m => m.year === currentYear) || troops.some(t => t.year === currentYear);
            if (!currentYearHasData) currentYear = maxYearInData;
        }
        await showSection('dashboard');
    } catch (e) { alert("Server error"); handleLogout(); }
}

document.addEventListener('DOMContentLoaded', () => showLoginScreen());

async function handleExcelImport() {
    const file = document.getElementById('excelUpload').files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const sheetData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        
        const getV = (r, n) => { 
            const k = Object.keys(r).find(x => n.includes(x.replace(/\s/g, '').toLowerCase())); 
            return k ? r[k] : null; 
        };
        
        let added = 0, idC = Date.now();

        sheetData.forEach(row => {
            const rawYr = getV(row, ['year']);
            const tnInput = getV(row, ['troopname', 'troop', 'troopno', 'troopnumber']);
            const ln = getV(row, ['lastname', 'surname']);
            const fn = getV(row, ['firstname', 'givenname']);
            const dobRaw = getV(row, ['birthday', 'dob', 'birthdate']);
            const beneficiary = getV(row, ['beneficiary', 'parent', 'guardian']); 

            if (!rawYr || !tnInput || !ln || !fn) return;

            const yr = parseInt(rawYr.toString().substring(0, 4));
            
            // FIND TROOP IN ENTIRE LIST BY NAME OR NUMBER + YEAR (NO TYPE REQUIRED)
            const searchStr = tnInput.toString().toLowerCase().trim();
            const t = troops.find(tr => 
                tr.year === yr && 
                (tr.name.toLowerCase().trim() === searchStr || tr.troop_no.toLowerCase().trim() === searchStr)
            );

            if (t) {
                members.push({ 
                    id: ++idC, 
                    troop_id: t.id, 
                    year: yr, 
                    first_name: fn, 
                    last_name: ln, 
                    age: getV(row, ['age']), 
                    age_level: t.age_level, 
                    dob: excelDateToJS(dobRaw), 
                    reg_status: 'New', 
                    beneficiary: beneficiary || "" 
                });
                added++;
            }
        });
        if (added) { 
            await saveDataToServer(); 
            showNotification(`Bulk import successful: ${added} members added.`);
            showSection('members'); 
        } else {
            alert("No matching troops found. Ensure 'Year' and 'Troop Name' or 'Troop No' match existing records.");
        }
    };
    reader.readAsArrayBuffer(file);
}

function filterCopyData() {
    const term = document.getElementById('copySearchInput').value.toLowerCase();
    const allLis = document.querySelectorAll('.copy-data-section li');
    allLis.forEach(li => {
        const label = li.querySelector('label');
        const text = label ? label.textContent.toLowerCase() : "";
        if (term !== "" && text.includes(term)) li.setAttribute('data-match', 'true');
        else li.removeAttribute('data-match');
    });
    allLis.forEach(li => {
        if (term === "") { li.style.display = ""; return; }
        const isMatch = li.hasAttribute('data-match');
        const hasMatchInChildren = li.querySelector('li[data-match="true"]');
        if (isMatch || hasMatchInChildren) {
            li.style.display = "";
            if (hasMatchInChildren) {
                const nested = li.querySelector('.nested-list');
                if (nested) { nested.style.display = 'block'; li.querySelector('.copy-item-label')?.classList.add('expanded'); }
            }
        } else li.style.display = "none";
    });
}