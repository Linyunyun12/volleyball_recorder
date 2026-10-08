const presetSixPlayers = [
    { num: "1", name: "球員1", pos: [] },
    { num: "2", name: "球員2", pos: [] },
    { num: "3", name: "球員3", pos: [] },
    { num: "4", name: "球員4", pos: [] },
    { num: "5", name: "球員5", pos: [] },
    { num: "6", name: "球員6", pos: [] }
];

// ==================== 常數 ====================
const STORAGE_KEY = 'volleyball_teams_data';
const DEFAULT_TEAM_NAME = "我的球隊";
const MATCHES_KEY = 'volleyball_matches_data';   // 已儲存的賽事紀錄

// ==================== 資料結構工廠 ====================
// 每位球員在單局內的數據欄位（全部歸零）
function createPlayerStats() {
    return {
        serveAttempts: 0, serveAce: 0, serveError: 0,
        attackScore: 0, attackError: 0,
        dropScore: 0, dropError: 0,
        blockScore: 0, blockError: 0,
        defenseScore: 0, defenseError: 0,
        otherError: 0,
        setAttempts: 0,
        foulCarry: 0, foulDoubleHit: 0, foulNet: 0, foulCrossing: 0
    };
}

// 單局的初始狀態
function createSetState(lineup = ["", "", "", "", "", ""], hasServe = true) {
    return {
        ourScore: 0,
        opponentScore: 0,
        lineup: lineup,
        hasServe: hasServe,
        historyLog: [],
        playerStats: {},
        substitutedPlayers: new Set(),
        isFinished: false,
        startLineup: [...lineup],     // 本局開場站位（還原 / 重設本局用）
        startHasServe: hasServe,      // 本局開場發球權
        serveSet: false               // 本局發球權是否已由使用者確認
    };
}

// ==================== 全域狀態 ====================
// 球隊資料
let teamsData = { [DEFAULT_TEAM_NAME]: JSON.parse(JSON.stringify(presetSixPlayers)) };
let activeTeamName = DEFAULT_TEAM_NAME;

// 比賽資訊與局數
let matchInfo = { date: "", tournament: "", opponent: "" };
let currentSet = 1;
let matchSets = { 1: createSetState(), 2: createSetState(), 3: createSetState() };
let matchSetWinners = {};
let matchStartLineup = ["", "", "", "", "", ""];   // 賽前設定的先發站位 [P1..P6]（局間預設）
let currentMatchId = null;      // 目前這場賽事的儲存 ID
let viewingHistory = false;     // 是否正在檢視「賽事管理」的歷史紀錄
let viewBackup = null;          // 檢視歷史前，暫存目前比賽的全域狀態

// 球員與場上操作
let registeredPlayers = [];
let attendanceStatus = {};
let activePlayerIndex = 0;
let isSubstituteMode = false;
let subPosIndex = null;

// 報表
let currentSummaryType = 'total';

// 記錄項目（label 不含 icon；impact: our=我方得分, opponent=對方得分, none=僅計次數）
const categoryDetails = {
    "發球": [
        { label: "發球+1", type: "attempt", impact: "none", reason: "發球次數", statKey: "serveAttempts" },
        { label: "發球 Ace", type: "score", impact: "our", reason: "發球得分", statKey: "serveAce" },
        { label: "發球失誤", type: "error", impact: "opponent", reason: "發球失誤", statKey: "serveError" }
    ],
    "攻擊": [
        { label: "攻擊得分", type: "score", impact: "our", reason: "攻擊得分", statKey: "attackScore" },
        { label: "攻擊失分", type: "error", impact: "opponent", reason: "攻擊失分", statKey: "attackError" }
    ],
    "吊球": [
        { label: "吊球得分", type: "score", impact: "our", reason: "吊球得分", statKey: "dropScore" },
        { label: "吊球失誤", type: "error", impact: "opponent", reason: "吊球失誤", statKey: "dropError" }
    ],
    "攔網": [
        { label: "攔網得分", type: "score", impact: "our", reason: "攔網得分", statKey: "blockScore" },
        { label: "攔網失分", type: "error", impact: "opponent", reason: "攔網失分", statKey: "blockError" }
    ],
    "防守": [
        { label: "防守得分", type: "score", impact: "our", reason: "防守得分", statKey: "defenseScore" },
        { label: "防守失誤", type: "error", impact: "opponent", reason: "防守失誤", statKey: "defenseError" }
    ],
    "其他失誤": [
        { label: "其他失誤", type: "error", impact: "opponent", reason: "其他失誤", statKey: "otherError" }
    ],
    "犯規": [
        { label: "持球犯規", type: "error", impact: "opponent", reason: "持球犯規", statKey: "foulCarry" },
        { label: "二次犯規", type: "error", impact: "opponent", reason: "二次犯規", statKey: "foulDoubleHit" },
        { label: "觸網犯規", type: "error", impact: "opponent", reason: "觸網犯規", statKey: "foulNet" },
        { label: "越界犯規", type: "error", impact: "opponent", reason: "越界犯規", statKey: "foulCrossing" }
    ]
};

window.onload = function() {
    loadAllData();
    updateAllTeamSelects();
    renderTeamTable();
    renderPregameCheckboxes();
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('match-date').value = today;
    syncFullscreenButton();
};

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-tabs .tab-btn').forEach(el => {
        el.classList.toggle('active', el.dataset.tab === tabId);
    });
    document.getElementById(tabId).classList.add('active');
    if (tabId === 'history-tab') renderMatchHistory();
    window.scrollTo(0, 0);
}

function saveAllData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(teamsData));
}

function loadAllData() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        teamsData = JSON.parse(saved);
        const keys = Object.keys(teamsData);
        if (keys.length > 0) activeTeamName = keys[0];
    } else {
        teamsData = { [DEFAULT_TEAM_NAME]: JSON.parse(JSON.stringify(presetSixPlayers)) };
        saveAllData();
    }
}

function updateAllTeamSelects() {
    const matchSel = document.getElementById('active-team-select');
    const manageSel = document.getElementById('manage-team-select');
    matchSel.innerHTML = '';
    manageSel.innerHTML = '';

    Object.keys(teamsData).forEach(tName => {
        let opt1 = document.createElement('option');
        opt1.value = tName;
        opt1.textContent = tName;
        if (tName === activeTeamName) opt1.selected = true;
        matchSel.appendChild(opt1);

        let opt2 = document.createElement('option');
        opt2.value = tName;
        opt2.textContent = tName;
        if (tName === activeTeamName) opt2.selected = true;
        manageSel.appendChild(opt2);
    });
}

function addNewTeam() {
    const nameInput = document.getElementById('new-team-name');
    const tName = nameInput.value.trim();
    if (!tName) { alert('請輸入球隊名稱！'); return; }
    if (teamsData[tName]) { alert('此球隊名稱已存在！'); return; }

    teamsData[tName] = [];
    activeTeamName = tName;
    saveAllData();
    updateAllTeamSelects();
    renderTeamTable();
    renderPregameCheckboxes();
    nameInput.value = '';
}

function deleteCurrentTeam() {
    const keys = Object.keys(teamsData);
    if (keys.length <= 1) { alert('至少需要保留一支球隊！'); return; }
    if (confirm(`確定要刪除球隊 「${activeTeamName}」 嗎？`)) {
        delete teamsData[activeTeamName];
        activeTeamName = Object.keys(teamsData)[0];
        saveAllData();
        updateAllTeamSelects();
        renderTeamTable();
        renderPregameCheckboxes();
    }
}

function onTeamChanged() {
    const matchSel = document.getElementById('active-team-select');
    const manageSel = document.getElementById('manage-team-select');

    if (event && event.target.id === 'active-team-select') {
        activeTeamName = matchSel.value;
        manageSel.value = activeTeamName;
    } else if (event && event.target.id === 'manage-team-select') {
        activeTeamName = manageSel.value;
        matchSel.value = activeTeamName;
    } else {
        matchSel.value = activeTeamName;
        manageSel.value = activeTeamName;
    }

    renderTeamTable();
    renderPregameCheckboxes();
}

function sortByNum(a, b) {
    return parseInt(a.num || 0) - parseInt(b.num || 0);
}

function renderTeamTable() {
    activeTeamName = document.getElementById('manage-team-select').value;
    const tbody = document.getElementById('team-table-body');
    tbody.innerHTML = '';

    const players = [...(teamsData[activeTeamName] || [])].sort(sortByNum);
    document.getElementById('team-player-count').textContent = players.length;

    players.forEach((p) => {
        const realIdx = teamsData[activeTeamName].indexOf(p);
        let tr = document.createElement('tr');
        let posStr = (p.pos && p.pos.length > 0) ? p.pos.join(', ') : '未填';
        tr.innerHTML = `
            <td><b>${p.num}</b></td>
            <td>${p.name}</td>
            <td>${posStr}</td>
            <td>
                <button class="btn-warning" style="padding:4px 8px; font-size:0.8rem; margin-right:5px;" onclick="editPlayer(${realIdx})">修改</button>
                <button class="btn-danger" style="padding:4px 8px; font-size:0.8rem;" onclick="removePlayer(${realIdx})">刪除</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function loadDefaultPresetToCurrentTeam() {
    if (confirm(`確定要將「球員 1 ~ 6」的預設名單載入到目前球隊 [${activeTeamName}] 嗎？`)) {
        teamsData[activeTeamName] = JSON.parse(JSON.stringify(presetSixPlayers));
        saveAllData();
        renderTeamTable();
        renderPregameCheckboxes();
    }
}

function savePlayerToTeam() {
    const num = document.getElementById('p-num').value.trim();
    const name = document.getElementById('p-name').value.trim();
    const editIndex = parseInt(document.getElementById('edit-index').value);

    if (!num || !name) { alert('請填寫背號與姓名！'); return; }

    const checkboxes = document.querySelectorAll('input[name="p-pos"]:checked');
    let selectedPos = Array.from(checkboxes).map(cb => cb.value);

    if (!teamsData[activeTeamName]) teamsData[activeTeamName] = [];

    if (editIndex === -1) {
        teamsData[activeTeamName].push({ num, name, pos: selectedPos });
    } else {
        teamsData[activeTeamName][editIndex] = { num, name, pos: selectedPos };
        cancelEdit();
    }

    saveAllData();
    renderTeamTable();
    renderPregameCheckboxes();

    document.getElementById('p-num').value = '';
    document.getElementById('p-name').value = '';
    checkboxes.forEach(cb => {
        cb.checked = false;
        cb.closest('.position-tag').classList.remove('checked');
    });
}

function updateTagStyle(checkbox) {
    const parentLabel = checkbox.closest('.position-tag');
    if (checkbox.checked) parentLabel.classList.add('checked');
    else parentLabel.classList.remove('checked');
}

function editPlayer(idx) {
    const player = teamsData[activeTeamName][idx];
    document.getElementById('p-num').value = player.num;
    document.getElementById('p-name').value = player.name;
    document.getElementById('edit-index').value = idx;

    document.querySelectorAll('input[name="p-pos"]').forEach(cb => {
        let isMatch = player.pos.includes(cb.value);
        cb.checked = isMatch;
        updateTagStyle(cb);
    });

    document.getElementById('form-title').textContent = `✏️ 修改球員資訊 (${player.num} ${player.name})`;
    document.getElementById('save-player-btn').textContent = "儲存修改";
    document.getElementById('cancel-edit-btn').style.display = "block";
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEdit() {
    document.getElementById('edit-index').value = "-1";
    document.getElementById('p-num').value = '';
    document.getElementById('p-name').value = '';
    document.querySelectorAll('input[name="p-pos"]').forEach(cb => {
        cb.checked = false;
        cb.closest('.position-tag').classList.remove('checked');
    });

    document.getElementById('form-title').textContent = "新增球員到此球隊";
    document.getElementById('save-player-btn').textContent = "確認新增球員";
    document.getElementById('cancel-edit-btn').style.display = "none";
}

function removePlayer(idx) {
    if (confirm('確定要刪除這位球員嗎？')) {
        teamsData[activeTeamName].splice(idx, 1);
        saveAllData();
        renderTeamTable();
        renderPregameCheckboxes();
    }
}

function renderPregameCheckboxes() {
    const container = document.getElementById('roster-cards-container');
    container.innerHTML = '';

    const players = teamsData[activeTeamName] || [];
    const statusPriority = { "可出賽": 1, "晚到": 2, "傷病": 3, "請假": 4 };

    const sortedPlayersNode = [...players].map(p => {
        let originalIdx = teamsData[activeTeamName].indexOf(p);
        let pKey = `${p.num} ${p.name}`;
        let status = attendanceStatus[pKey] || "可出賽";
        return { p, originalIdx, priority: statusPriority[status] || 1, num: parseInt(p.num || 0) };
    }).sort((a, b) => (a.priority !== b.priority) ? a.priority - b.priority : a.num - b.num);

    sortedPlayersNode.forEach((item, sortedIdx) => {
        let p = item.p;
        let idx = item.originalIdx;
        let pKey = `${p.num} ${p.name}`;
        let status = attendanceStatus[pKey] || "可出賽";

        let isDisabled = (status === "請假");
        let isChecked = sortedIdx < 12 && !isDisabled;

        let card = document.createElement('div');
        card.className = `roster-select-card ${isChecked ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`;
        card.id = `roster-card-${idx}`;

        let statusClass = "status-green";
        let statusText = "🟢 可出賽";
        if (status === "晚到") { statusClass = "status-yellow"; statusText = "🟡 晚到"; }
        else if (status === "請假") { statusClass = "status-red"; statusText = "🔴 請假"; }
        else if (status === "傷病") { statusClass = "status-injury"; statusText = "🏥 傷病"; }

        let posStr = (p.pos && p.pos.length > 0) ? `(${p.pos.join('/')})` : '';

        card.innerHTML = `
            <input type="checkbox" id="chk-${idx}" value="${p.num} ${p.name}" ${isChecked ? 'checked' : ''} ${isDisabled ? 'disabled' : ''} onchange="handleRosterCardChange(${idx})">
            <div class="player-badge-pill" ${isDisabled ? 'style="background:#94a3b8;"' : ''}>${p.num}</div>
            <div class="roster-card-info" style="width:100%;">
                <div class="roster-card-name" ${isDisabled ? 'style="color:#94a3b8; text-decoration:line-through;"' : ''}>${p.name}</div>
                <div style="display:flex; align-items:center; gap:6px; margin-top:2px;">
                    <span class="status-badge ${statusClass}">${statusText}</span>
                    <span class="roster-card-pos">${posStr}</span>
                </div>
            </div>
        `;

        card.onclick = function(e) {
            if (isDisabled) return;
            if (e.target.tagName !== 'INPUT') {
                const chk = document.getElementById(`chk-${idx}`);
                chk.checked = !chk.checked;
                handleRosterCardChange(idx);
            }
        };
        container.appendChild(card);
    });
    updateSelectedCount();
}

function handleRosterCardChange(idx) {
    const chk = document.getElementById(`chk-${idx}`);
    const card = document.getElementById(`roster-card-${idx}`);
    const checkedBoxes = document.querySelectorAll('#roster-cards-container input[type="checkbox"]:checked');
    if (checkedBoxes.length > 12) {
        alert('正式比賽檢錄登錄最多只能選擇 12 位球員！');
        chk.checked = false;
        return;
    }
    if (chk.checked) card.classList.add('selected');
    else card.classList.remove('selected');
    updateSelectedCount();
}

function toggleRosterSummary() {
    const dropdown = document.getElementById('roster-summary-dropdown');
    dropdown.style.display = (dropdown.style.display === 'none' || dropdown.style.display === '') ? 'block' : 'none';
}

function updateSelectedCount() {
    const checkedBoxes = document.querySelectorAll('#roster-cards-container input[type="checkbox"]:checked');
    const count = checkedBoxes.length;
    document.getElementById('selected-count').textContent = count;

    registeredPlayers = Array.from(checkedBoxes).map(cb => cb.value);
    document.getElementById('roster-summary-btn-text').textContent = `已選 ${count} 人 ▾`;

    const listContainer = document.getElementById('roster-summary-list');
    if (count === 0) {
        listContainer.innerHTML = '<span style="color: #64748b; text-align: center;">尚未選取任何球員</span>';
    } else {
        listContainer.innerHTML = '';
        registeredPlayers.forEach((pStr) => {
            let parts = pStr.split(' ');
            let pNum = parts[0];
            let pName = parts.slice(1).join(' ');
            let pKey = `${pNum} ${pName}`;
            let status = attendanceStatus[pKey] || "可出賽";
            let statusBadgeTag = "";
            if (status === "傷病") statusBadgeTag = `<span style="background:#ede9fe; color:#5b21b6; font-size:0.75rem; padding:1px 5px; border-radius:4px; margin-left:6px; font-weight:bold;">🏥 傷病</span>`;
            else if (status === "晚到") statusBadgeTag = `<span style="background:#fef3c7; color:#92400e; font-size:0.75rem; padding:1px 5px; border-radius:4px; margin-left:6px; font-weight:bold;">🟡 晚到</span>`;

            let row = document.createElement('div');
            row.style.cssText = "display: flex; align-items: center; padding: 6px 10px; background: #f8fafc; border-radius: 6px; border-left: 3px solid #3b82f6;";
            row.innerHTML = `<span class="player-badge-pill">${pNum}</span> <span style="font-weight:600;">${pName}</span> ${statusBadgeTag}`;
            listContainer.appendChild(row);
        });
    }

    updateLineupSelects(registeredPlayers);
}

function updateLineupSelects(activePlayers) {
    const posIds = ["sel-p4", "sel-p3", "sel-p2", "sel-p5", "sel-p6", "sel-p1"];
    posIds.forEach((id) => {
        const select = document.getElementById(id);
        if (select) {
            let currentVal = select.value;
            let optionsHTML = '<option value="">-- 請選擇球員 --</option>';
            activePlayers.forEach(p => {
                let selectedAttr = (p === currentVal) ? 'selected' : '';
                optionsHTML += `<option value="${p}" ${selectedAttr}>${p}</option>`;
            });
            select.innerHTML = optionsHTML;
        }
    });
}

function validateLineupSelection() {}

// ==================== 站位輪轉（賽前 / 局間共用，僅順時針） ====================
// 順序 [P1..P6]；順時針一格 = P2→P1、P3→P2、…、P1→P6（與比賽中換發球輪轉相同）
function rotateSelectGroup(prefix) {
    const ids = [1, 2, 3, 4, 5, 6].map(n => `${prefix}${n}`);
    const vals = ids.map(id => document.getElementById(id).value);
    const rotated = [...vals.slice(1), vals[0]];
    ids.forEach((id, i) => { document.getElementById(id).value = rotated[i]; });
}

function rotatePregameLineup() {
    rotateSelectGroup('sel-p');
}

function rotateNextLineup() {
    rotateSelectGroup('next-sel-p');
}

function resetNextLineupToStart() {
    [1, 2, 3, 4, 5, 6].forEach((n, i) => {
        document.getElementById(`next-sel-p${n}`).value = matchStartLineup[i] || '';
    });
}

// ==================== 全螢幕 ====================
// 優先使用瀏覽器原生全螢幕；不支援（例如 iPhone Safari）時退回「偽全螢幕」（收緊版面）。
function isRealFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

function toggleFullscreen() {
    const el = document.documentElement;

    if (isRealFullscreen()) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) { try { const p = exit.call(document); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
        return;
    }
    if (document.body.classList.contains('pseudo-fs')) {
        document.body.classList.remove('pseudo-fs');
        syncFullscreenButton();
        return;
    }

    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    const fallback = () => { document.body.classList.add('pseudo-fs'); syncFullscreenButton(); };
    if (!req) { fallback(); return; }
    try {
        const p = req.call(el, { navigationUI: 'hide' });
        if (p && p.catch) p.catch(fallback);
    } catch (e) { fallback(); }
}

function syncFullscreenButton() {
    const real = isRealFullscreen();
    // 原生全螢幕成功後，清掉殘留的偽全螢幕旗標
    if (real) document.body.classList.remove('pseudo-fs');
    const on = real || document.body.classList.contains('pseudo-fs');
    document.body.classList.toggle('is-fs', on);
    const btn = document.getElementById('fullscreen-btn');
    if (btn) {
        btn.innerHTML = on ? '<span class="fs-icon">✕</span><span class="fs-text"> 退出全螢幕</span>'
            : '<span class="fs-icon">⛶</span><span class="fs-text"> 全螢幕</span>';
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
}
document.addEventListener('fullscreenchange', syncFullscreenButton);
document.addEventListener('webkitfullscreenchange', syncFullscreenButton);
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('pseudo-fs')) {
        document.body.classList.remove('pseudo-fs');
        syncFullscreenButton();
    }
});

function openAttendanceModal() {
    const container = document.getElementById('attendance-list-container');
    container.innerHTML = '';

    const players = [...(teamsData[activeTeamName] || [])].sort(sortByNum);
    if (players.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#64748b;">目前球隊沒有球員，請先至球隊名單新增！</p>';
        document.getElementById('attendance-modal').style.display = 'flex';
        return;
    }

    players.forEach(p => {
        let pKey = `${p.num} ${p.name}`;
        if (!attendanceStatus[pKey]) attendanceStatus[pKey] = "可出賽";

        let item = document.createElement('div');
        item.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:white; padding:8px 12px; border-radius:6px; border:1px solid #e2e8f0; margin-bottom:8px;";
        item.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px;">
                <span class="player-badge-pill">${p.num}</span>
                <span style="font-weight:bold; color:#1e293b;">${p.name}</span>
            </div>
            <select id="att-${p.num}-${p.name}" style="width:130px; padding:6px; font-size:0.9rem;" onchange="attendanceStatus['${pKey}'] = this.value">
                <option value="可出賽" ${attendanceStatus[pKey] === '可出賽' ? 'selected' : ''}>🟢 可出賽</option>
                <option value="晚到" ${attendanceStatus[pKey] === '晚到' ? 'selected' : ''}>🟡 晚到</option>
                <option value="傷病" ${attendanceStatus[pKey] === '傷病' ? 'selected' : ''}>🏥 傷病</option>
                <option value="請假" ${attendanceStatus[pKey] === '請假' ? 'selected' : ''}>🔴 請假</option>
            </select>
        `;
        container.appendChild(item);
    });

    document.getElementById('attendance-modal').style.display = 'flex';
}

function closeAttendanceModal() {
    document.getElementById('attendance-modal').style.display = 'none';
}

function confirmAttendance() {
    closeAttendanceModal();
    renderPregameCheckboxes();
}

function openEditMatchInfoModal() {
    document.getElementById('edit-modal-tournament').value = matchInfo.tournament || '';
    document.getElementById('edit-modal-opponent').value = matchInfo.opponent || '';
    document.getElementById('edit-match-modal').style.display = 'flex';
}

function closeEditMatchInfoModal() {
    document.getElementById('edit-match-modal').style.display = 'none';
}

function confirmEditMatchInfo() {
    const newTournament = document.getElementById('edit-modal-tournament').value.trim();
    const newOpponent = document.getElementById('edit-modal-opponent').value.trim();

    if (newTournament) matchInfo.tournament = newTournament;
    if (newOpponent) matchInfo.opponent = newOpponent;

    document.getElementById('current-match-title').textContent = `[${matchInfo.tournament}] ${activeTeamName} v.s ${matchInfo.opponent}`;
    document.getElementById('scoreboard-opp-name').textContent = `${matchInfo.opponent} 得分`;

    closeEditMatchInfoModal();
}

// 暫停記錄函式 (比分格式：我方:對方)
function openTimeoutModal() {
    const currentData = matchSets[currentSet];
    if (currentData.isFinished) {
        alert('此局已結束，無法記錄暫停！');
        return;
    }

    document.getElementById('timeout-score-desc').textContent = `當前比分：${currentData.ourScore} : ${currentData.opponentScore} (我方 : 對手)`;
    document.getElementById('timeout-modal').style.display = 'flex';
}

function closeTimeoutModal() {
    document.getElementById('timeout-modal').style.display = 'none';
}

function confirmTimeout(requester) {
    const currentData = matchSets[currentSet];

    let logText = `[${currentData.ourScore}:${currentData.opponentScore}] 【暫停記錄】由 【${requester}】 提出暫停 (比分 ${currentData.ourScore}:${currentData.opponentScore})`;

    currentData.historyLog.push({
        team: 'info',
        text: logText,
        ourScore: currentData.ourScore,
        opponentScore: currentData.opponentScore,
        lineup: [...currentData.lineup],
        hasServe: currentData.hasServe
    });

    closeTimeoutModal();
    renderLogs();
    alert(`✅ 已成功記錄：${requester}提出暫停（比分 ${currentData.ourScore}:${currentData.opponentScore}）`);
}

function startMatch() {
    const checkedBoxes = document.querySelectorAll('#roster-cards-container input[type="checkbox"]:checked');
    if (checkedBoxes.length < 6) { alert('先發陣容需要至少勾選 6 位登錄球員！'); return; }

    const p1 = document.getElementById('sel-p1').value;
    const p2 = document.getElementById('sel-p2').value;
    const p3 = document.getElementById('sel-p3').value;
    const p4 = document.getElementById('sel-p4').value;
    const p5 = document.getElementById('sel-p5').value;
    const p6 = document.getElementById('sel-p6').value;

    if ([p1, p2, p3, p4, p5, p6].some(p => !p || p === '-')) {
        alert('先發 6 人的場上位置（P1 ~ P6）尚未指派完整，請確認每格都已選擇球員！');
        return;
    }

    matchInfo.date = document.getElementById('match-date').value || "未填日期";
    matchInfo.tournament = document.getElementById('match-tournament').value.trim() || "友誼賽";
    matchInfo.opponent = document.getElementById('opponent-team-name').value.trim() || "對手";

    matchSetWinners = {};
    for (let s = 2; s <= 3; s++) {
        const lockBtn = document.getElementById(`set-btn-${s}`);
        lockBtn.disabled = true;
        lockBtn.style.opacity = '0.5';
        lockBtn.style.cursor = 'not-allowed';
    }

    currentSet = 1;
    currentMatchId = 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    matchStartLineup = [p1, p2, p3, p4, p5, p6];
    const firstServeOur = document.getElementById('initial-serve').value === 'our';
    for (let s = 1; s <= 3; s++) {
        let initialLineup = [p1, p2, p3, p4, p5, p6];
        // 第 1 局：賽前選擇；第 2 局：預設與第 1 局相反（換邊先發）；第 3 局：進入前必須重新決定（見局間視窗）
        const serveForSet = (s === 2) ? !firstServeOur : firstServeOur;
        matchSets[s] = createSetState(initialLineup, serveForSet);
        matchSets[s].serveSet = (s === 1);
        initialLineup.forEach(p => matchSets[s].substitutedPlayers.add(p));

        registeredPlayers.forEach(pName => {
            matchSets[s].playerStats[pName] = createPlayerStats();
        });
    }

    document.getElementById('current-match-title').textContent = `[${matchInfo.tournament}] ${activeTeamName} v.s ${matchInfo.opponent}`;
    document.getElementById('scoreboard-our-name').textContent = `${activeTeamName} 得分`;
    document.getElementById('scoreboard-opp-name').textContent = `${matchInfo.opponent} 得分`;

    document.getElementById('pregame-section').style.display = 'none';
    document.getElementById('in-game-section').style.display = 'block';

    switchSet(1);
}

function backToPregame() {
    if (confirm('回到檢錄頁面將會重置目前的比賽計分，確定嗎？')) {
        document.getElementById('in-game-section').style.display = 'none';
        document.getElementById('pregame-section').style.display = 'block';
    }
}

function switchSet(setNum) {
    if (setNum > 1 && !matchSetWinners[setNum - 1]) {
        alert('請先完成上一局的比賽與結算，才能解鎖並切換至此局！');
        return;
    }

    currentSet = setNum;
    for (let s = 1; s <= 3; s++) {
        const btn = document.getElementById(`set-btn-${s}`);
        if (s === setNum) btn.classList.add('active');
        else btn.classList.remove('active');
    }
    document.getElementById('current-set-label').textContent = `第 ${setNum} 局 ${setNum === 3 ? '(決賽局 15分)' : '(25分)'}`;
    updateUI();
}

function toggleSubstituteMode() {
    const currentData = matchSets[currentSet];
    if (currentData.isFinished) {
        alert('此局已結束，無法進行換人操作！');
        return;
    }

    isSubstituteMode = !isSubstituteMode;
    const btn = document.getElementById('sub-mode-btn');
    if (isSubstituteMode) {
        btn.textContent = "目前：點擊球員換人";
        btn.style.background = "#d4495a";
        btn.style.color = "white";
    } else {
        btn.textContent = "目前：點擊球員計分";
        btn.style.background = "#d97706";
        btn.style.color = "white";
    }
}

function handleCourtCardClick(posIdx) {
    const currentData = matchSets[currentSet];
    if (currentData.isFinished) return;

    if (isSubstituteMode) openSubstituteModal(posIdx);
    else setActivePlayer(posIdx);
}

function setActivePlayer(index) {
    activePlayerIndex = index;
    const currentData = matchSets[currentSet];
    for (let i = 0; i < 6; i++) {
        let node = document.getElementById(`node-p${i+1}`);
        if (i === index && !currentData.isFinished) {
            node.style.border = "3px solid #3b82f6";
            node.style.boxShadow = "0 0 10px rgba(59, 130, 246, 0.5)";
        } else {
            node.style.border = "none";
            node.style.boxShadow = "";
        }
    }
    document.getElementById('selected-active-player').innerHTML = `${playerBadgeHTML(currentData.lineup[index])} <span style="font-size:.85em;">(P${index+1})</span>`;
}

function openSubstituteModal(posIdx) {
    subPosIndex = posIdx;
    const currentData = matchSets[currentSet];
    const modal = document.getElementById('sub-modal');
    const desc = document.getElementById('sub-modal-desc');
    const select = document.getElementById('sub-target-select');

    desc.textContent = `將 P${posIdx+1} 目前的球員 (${currentData.lineup[posIdx]}) 換下場：`;
    select.innerHTML = '';

    let availableBench = registeredPlayers.filter(p => !currentData.lineup.includes(p));
    if (availableBench.length === 0) {
        select.innerHTML = '<option value="-">無其他可替換的登錄球員</option>';
    } else {
        availableBench.forEach(p => {
            let parts = p.split(' ');
            let pKey = `${parts[0]} ${parts.slice(1).join(' ')}`;
            let status = attendanceStatus[pKey] || "可出賽";
            let statusLabel = (status === "傷病") ? " [🏥 傷病]" : (status === "請假" ? " [🔴 請假]" : (status === "晚到" ? " [🟡 晚到]" : ""));

            let opt = document.createElement('option');
            opt.value = p;
            opt.textContent = `${p}${statusLabel}`;
            select.appendChild(opt);
        });
    }
    modal.style.display = 'flex';
}

function closeSubstituteModal() {
    document.getElementById('sub-modal').style.display = 'none';
}

function confirmSubstitute() {
    const select = document.getElementById('sub-target-select');
    const incomingPlayer = select.value;
    if (incomingPlayer === '-' || !incomingPlayer) { alert('請選擇有效的替換球員！'); return; }

    const currentData = matchSets[currentSet];
    const outgoingPlayer = currentData.lineup[subPosIndex];
    currentData.lineup[subPosIndex] = incomingPlayer;
    currentData.substitutedPlayers.add(incomingPlayer);

    currentData.historyLog.push({ team: 'info', ourScore: currentData.ourScore, opponentScore: currentData.opponentScore, text: `🔄 【第${currentSet}局換人】P${subPosIndex+1}: ${outgoingPlayer} 🔀 ${incomingPlayer}`, lineup: [...currentData.lineup], hasServe: currentData.hasServe });
    closeSubstituteModal();
    toggleSubstituteMode();
    updateUI();
    setActivePlayer(subPosIndex);
}

function openDetailModal(category) {
    const currentData = matchSets[currentSet];
    if (currentData.isFinished) {
        alert('此局已結束，無法記錄數據！');
        return;
    }

    const currentPlayer = currentData.lineup[activePlayerIndex];
    if (!currentPlayer || currentPlayer === '-') { alert('請先在上方點擊選擇一位場上球員！'); return; }

    const modal = document.getElementById('detail-modal');
    document.getElementById('modal-category-title').textContent = `📊 紀錄項目：${category}`;
    document.getElementById('modal-player-desc').textContent = `目前指定球員：${currentPlayer}`;

    const container = document.getElementById('modal-buttons-container');
    container.innerHTML = '';

    const details = categoryDetails[category] || [];
    details.forEach(item => {
        let btn = document.createElement('button');
        btn.textContent = item.label;
        btn.className = item.impact === 'our' ? 'btn-success' : (item.impact === 'opponent' ? 'btn-danger' : 'btn-secondary');
        btn.style.padding = '14px';
        btn.style.fontSize = '1.05rem';
        btn.onclick = () => {
            recordDetailedEvent(item.impact, category, item.reason, item.statKey);
            closeDetailModal();
        };
        container.appendChild(btn);
    });
    modal.style.display = 'flex';
}

function closeDetailModal() {
    document.getElementById('detail-modal').style.display = 'none';
}

function recordDetailedEvent(impactTeam, category, reason, statKey) {
    const currentData = matchSets[currentSet];
    if (currentData.isFinished) return;
    const hadServe = currentData.hasServe;

    const currentPlayer = currentData.lineup[activePlayerIndex];
    let rotatedThisPoint = false;

    const statsApplied = [];
    if (currentData.playerStats[currentPlayer] && statKey) {
        statsApplied.push(statKey);
        // 發球得分 / 發球失誤 同時計入發球次數
        if (statKey === 'serveAce' || statKey === 'serveError') statsApplied.push('serveAttempts');
        statsApplied.forEach(k => { currentData.playerStats[currentPlayer][k]++; });
    }

    if (impactTeam === 'our') {
        currentData.ourScore++;
        if (!currentData.hasServe) {
            rotateLineup();
            currentData.hasServe = true;
            rotatedThisPoint = true;
        }
    } else if (impactTeam === 'opponent') {
        currentData.opponentScore++;
        currentData.hasServe = false;
    }

    let logText = `[${currentData.ourScore}:${currentData.opponentScore}] ${impactTeam === 'our' ? '🟢 我方得分' : (impactTeam === 'opponent' ? '🔴 對手得分' : '⚪ 記錄次數')} - [${currentPlayer}] ${category}：${reason}`;
    if (rotatedThisPoint) logText += " ➔ 【順時針輪轉】";

    currentData.historyLog.push({ statsApplied: statsApplied.map(k => ({ player: currentPlayer, key: k })), team: impactTeam, reason: `${category}-${reason}`, ourScore: currentData.ourScore, opponentScore: currentData.opponentScore, lineup: [...currentData.lineup], hasServe: currentData.hasServe, text: logText });
    updateUI();
    afterPointFeedback(impactTeam, rotatedThisPoint, hadServe);
    checkSetWinCondition();
}

function scorePoint(team, reason) {
    const currentData = matchSets[currentSet];
    if (currentData.isFinished) return;
    const hadServe = currentData.hasServe;

    let rotatedThisPoint = false;
    if (team === 'our') {
        currentData.ourScore++;
        if (!currentData.hasServe) {
            rotateLineup();
            currentData.hasServe = true;
            rotatedThisPoint = true;
        }
    } else {
        currentData.opponentScore++;
        currentData.hasServe = false;
    }

    let logText = `[${currentData.ourScore}:${currentData.opponentScore}] 🟢 我方得分 - ${reason} (對方失誤送分)`;
    if (rotatedThisPoint) logText += " ➔ 【順時針輪轉】";

    currentData.historyLog.push({ team, reason, ourScore: currentData.ourScore, opponentScore: currentData.opponentScore, lineup: [...currentData.lineup], hasServe: currentData.hasServe, text: logText });
    updateUI();
    afterPointFeedback(team, rotatedThisPoint, hadServe);
    checkSetWinCondition();
}

let setEndSetNum = 1;   // 目前「局結束 / 確認下一局站位」視窗對應的局數

function isMatchOverAfterSet(setNum) {
    return setNum >= 3 || (setNum === 2 && matchSetWinners[1] === matchSetWinners[2]);
}

function checkSetWinCondition() {
    const currentData = matchSets[currentSet];
    let targetScore = currentSet === 3 ? 15 : 25;
    let our = currentData.ourScore;
    let opp = currentData.opponentScore;

    if ((our >= targetScore || opp >= targetScore) && Math.abs(our - opp) >= 2) {
        currentData.isFinished = true;
        matchSetWinners[currentSet] = our > opp ? 'our' : 'opponent';
        updateUI();   // 先刷新：鎖定計分面板 + 顯示「確認下一局」提示列，之後關掉彈窗也找得到入口
        saveCurrentMatch(true);   // 每局結束自動存檔到「賽事管理」
        showSetEndModal(currentSet);
    }
}

// 顯示「局結束＋確認下一局站位」視窗（局結束當下、或看完報表後都可重新開啟）
function showSetEndModal(setNum) {
    setEndSetNum = setNum;
    const data = matchSets[setNum];
    const our = data.ourScore;
    const opp = data.opponentScore;
    const winnerName = our > opp ? activeTeamName : matchInfo.opponent;

    document.getElementById('set-end-title').textContent = `🎉 第 ${setNum} 局結束！`;
    document.getElementById('set-end-score').textContent = `${activeTeamName} ${our} : ${opp} ${matchInfo.opponent}`;

    const saveBtn = document.getElementById('save-match-btn');
    if (isMatchOverAfterSet(setNum)) {
        document.getElementById('set-match-status').textContent = `本局由 【${winnerName}】 獲勝！ 🏆 全場比賽已由 【${winnerName}】 取得勝利！`;
        document.getElementById('next-set-btn').style.display = 'none';
        document.getElementById('next-set-lineup-preview').style.display = 'none';
        if (saveBtn) saveBtn.style.display = 'block';
    } else {
        if (saveBtn) saveBtn.style.display = 'none';
        setupNextServeSelector(setNum + 1);
        document.getElementById('set-match-status').textContent = `本局由 【${winnerName}】 獲勝！準備進入下一局。`;
        document.getElementById('next-set-btn').style.display = 'block';
        document.getElementById('next-set-lineup-preview').style.display = 'block';
        populateNextSetLineupSelects();
    }

    const closeBtn = document.getElementById('set-end-close-btn');
    if (closeBtn) closeBtn.textContent = isMatchOverAfterSet(setNum) ? '關閉' : '先關閉，稍後再確認';

    document.getElementById('set-end-modal').style.display = 'flex';
}

// 下一局發球權選擇器：第 2 局預設與第 1 局相反；第 3 局沒有預設，必須重新選擇
function setupNextServeSelector(nextNum) {
    const sel = document.getElementById('next-set-serve');
    const label = document.getElementById('next-serve-label');
    const hint = document.getElementById('next-serve-hint');
    if (!sel) return;
    label.textContent = `第 ${nextNum} 局誰先發球？`;

    const nd = matchSets[nextNum];
    let value = '';
    if (nd.serveSet) {
        value = nd.hasServe ? 'our' : 'opponent';
    } else if (nextNum === 2) {
        value = matchSets[1].startHasServe ? 'opponent' : 'our';
    }
    sel.value = value;
    hint.textContent = nextNum === 3
        ? '第 3 局（決勝局）需重新猜拳決定發球權，請依實際結果選擇。'
        : '依規則預設為第 1 局先接發球的一方先發球，可依實際狀況修改。';
    sel.classList.toggle('need-choice', !value);
}

// 回傳「已結束、但下一局尚未解鎖」的局數；沒有則回傳 null
function getPendingNextSet() {
    for (let s = 1; s <= 2; s++) {
        if (matchSetWinners[s] && !isMatchOverAfterSet(s)) {
            const nextBtn = document.getElementById(`set-btn-${s + 1}`);
            if (nextBtn && nextBtn.disabled) return s;
        }
    }
    return null;
}

// 局間提示列：看完報表、關掉彈窗後，仍有明顯的入口可確認下一局站位
function updateNextSetBanner() {
    const el = document.getElementById('next-set-banner');
    if (!el) return;

    const pending = getPendingNextSet();
    let overSet = null;
    for (let s = 1; s <= 3; s++) {
        if (matchSetWinners[s] && isMatchOverAfterSet(s)) overSet = s;
    }

    if (pending) {
        const d = matchSets[pending];
        el.className = 'next-set-banner no-print';
        el.innerHTML = `
            <div class="nsb-text">第 ${pending} 局已結束（${d.ourScore} : ${d.opponentScore}），尚未進入第 ${pending + 1} 局</div>
            <div class="nsb-actions">
                <button class="btn-success" onclick="showSetEndModal(${pending})">➡ 確認第 ${pending + 1} 局站位並開始</button>
                <button class="btn-primary" onclick="openSummaryModal(${pending})">📊 查看本局報表</button>
            </div>`;
        el.style.display = 'flex';
    } else if (overSet) {
        const d = matchSets[overSet];
        el.className = 'next-set-banner is-final no-print';
        el.innerHTML = `
            <div class="nsb-text">🏆 全場比賽已結束（第 ${overSet} 局 ${d.ourScore} : ${d.opponentScore}）</div>
            <div class="nsb-actions">
                <button class="btn-success" onclick="openSummaryModal('total')">📋 查看全場報表</button>
                <button class="btn-primary" onclick="saveAndOpenHistory()">📁 儲存並前往賽事管理</button>
            </div>`;
        el.style.display = 'flex';
    } else {
        el.style.display = 'none';
        el.innerHTML = '';
    }
}

function populateNextSetLineupSelects() {
    const posIds = ["next-sel-p4", "next-sel-p3", "next-sel-p2", "next-sel-p5", "next-sel-p6", "next-sel-p1"];
    // 預設 = 賽前設定的先發站位
    const posToIdx = { "next-sel-p1": 0, "next-sel-p2": 1, "next-sel-p3": 2, "next-sel-p4": 3, "next-sel-p5": 4, "next-sel-p6": 5 };

    posIds.forEach((id) => {
        const select = document.getElementById(id);
        if (select) {
            const defaultPlayer = matchStartLineup[posToIdx[id]];
            let optionsHTML = '<option value="">-- 請選擇球員 --</option>';
            registeredPlayers.forEach(p => {
                let selectedAttr = (p === defaultPlayer) ? 'selected' : '';
                optionsHTML += `<option value="${p}" ${selectedAttr}>${p}</option>`;
            });
            select.innerHTML = optionsHTML;
        }
    });
}

function validateNextLineupSelection() {
    const posIds = ["next-sel-p4", "next-sel-p3", "next-sel-p2", "next-sel-p5", "next-sel-p6", "next-sel-p1"];
    let selectedValues = [];
    posIds.forEach(id => {
        let val = document.getElementById(id).value;
        if (val) {
            if (selectedValues.includes(val)) {
                document.getElementById(id).value = "";
            } else {
                selectedValues.push(val);
            }
        }
    });
}

function proceedToNextSet() {
    const p1 = document.getElementById('next-sel-p1').value;
    const p2 = document.getElementById('next-sel-p2').value;
    const p3 = document.getElementById('next-sel-p3').value;
    const p4 = document.getElementById('next-sel-p4').value;
    const p5 = document.getElementById('next-sel-p5').value;
    const p6 = document.getElementById('next-sel-p6').value;

    if ([p1, p2, p3, p4, p5, p6].some(p => !p || p === '-')) {
        alert('下一局的先發 6 人站位尚未指派完整，請確認每格都已選擇球員！');
        return;
    }

    let nextSetNum = setEndSetNum + 1;
    const serveChoice = document.getElementById('next-set-serve').value;
    if (!serveChoice) {
        alert(`請先選擇第 ${nextSetNum} 局的發球權（誰先發球）！`);
        document.getElementById('next-set-serve').focus();
        return;
    }

    closeSetEndModal();
    if (nextSetNum <= 3) {
        const nextBtn = document.getElementById(`set-btn-${nextSetNum}`);
        nextBtn.disabled = false;
        nextBtn.style.opacity = '1';
        nextBtn.style.cursor = 'pointer';

        let newLineup = [p1, p2, p3, p4, p5, p6];
        matchSets[nextSetNum].lineup = newLineup;
        matchSets[nextSetNum].startLineup = [...newLineup];
        matchSets[nextSetNum].substitutedPlayers = new Set(newLineup);
        matchSets[nextSetNum].hasServe = (serveChoice === 'our');
        matchSets[nextSetNum].startHasServe = (serveChoice === 'our');
        matchSets[nextSetNum].serveSet = true;

        switchSet(nextSetNum);
    }
}

function closeSetEndModal() {
    document.getElementById('set-end-modal').style.display = 'none';
}

function manualRotateWithWarning() {
    const currentData = matchSets[currentSet];
    if (currentData.isFinished) { alert('此局已結束，無法手動輪轉！'); return; }

    if (confirm('⚠️ 警告：確定要手動執行一次順時針輪轉嗎？')) {
        rotateLineup();
        currentData.historyLog.push({ team: 'info', ourScore: currentData.ourScore, opponentScore: currentData.opponentScore, text: `【手動輪轉】當前發球員變更為: ${currentData.lineup[0]}`, lineup: [...currentData.lineup], hasServe: currentData.hasServe });
        updateUI();
    }
}

function resetCurrentSetWithWarning() {
    const currentData = matchSets[currentSet];
    if (currentData.isFinished) { alert('此局已結束，為唯讀狀態，無法重設！'); return; }
    if (confirm(`⚠️ 警告：確定要完全重設第 ${currentSet} 局的得分與所有技術紀錄嗎？此動作無法復原！`)) {
        currentData.ourScore = 0;
        currentData.opponentScore = 0;
        currentData.historyLog = [];
        currentData.isFinished = false;
        // 連同球員技術數據、站位、發球權一起還原到本局開場狀態
        currentData.lineup = [...currentData.startLineup];
        currentData.hasServe = currentData.startHasServe;
        currentData.substitutedPlayers = new Set(currentData.startLineup);
        currentData.playerStats = {};
        registeredPlayers.forEach(pName => { currentData.playerStats[pName] = createPlayerStats(); });
        updateUI();
    }
}

function rotateLineup() {
    const currentData = matchSets[currentSet];
    const first = currentData.lineup.shift();
    currentData.lineup.push(first);
    setActivePlayer(0);
}

function undoLast() {
    const currentData = matchSets[currentSet];
    if (currentData.isFinished) { alert('此局已結束，無法恢復上一筆！'); return; }

    if (currentData.historyLog.length === 0) {
        alert('目前沒有可以恢復的上一筆紀錄！');
        return;
    }
    const removed = currentData.historyLog.pop();
    if (removed && removed.statsApplied) {
        removed.statsApplied.forEach(s => {
            if (currentData.playerStats[s.player]) currentData.playerStats[s.player][s.key]--;
        });
    }
    if (currentData.historyLog.length > 0) {
        const prev = currentData.historyLog[currentData.historyLog.length - 1];
        currentData.ourScore = prev.ourScore;
        currentData.opponentScore = prev.opponentScore;
        currentData.lineup = [...prev.lineup];
        currentData.hasServe = prev.hasServe;
    } else {
        currentData.ourScore = 0;
        currentData.opponentScore = 0;
        currentData.lineup = [...currentData.startLineup];
        currentData.hasServe = currentData.startHasServe;
    }
    updateUI();
}

function updateUI() {
    const currentData = matchSets[currentSet];
    document.getElementById('our-score').textContent = currentData.ourScore;
    document.getElementById('opponent-score').textContent = currentData.opponentScore;

    for (let i = 0; i < 6; i++) {
        document.getElementById(`disp-p${i+1}`).innerHTML = playerBadgeHTML(currentData.lineup[i]);
        document.getElementById(`node-p${i+1}`).classList.remove('is-server');
    }
    document.getElementById('node-p1').classList.add('is-server');

    const badge = document.getElementById('serve-status-badge');
    if (currentData.hasServe) {
        badge.textContent = `發球權：我方 (${currentData.lineup[0]})`;
        badge.style.background = '#12896a';
        badge.style.color = '#fff';
    } else {
        badge.textContent = `發球權：對手`;
        badge.style.background = '#d4495a';
        badge.style.color = '#fff';
    }

    const controlsPanel = document.getElementById('active-scoring-controls');
    const rotateBtn = document.getElementById('manual-rotate-btn');
    const resetBtn = document.getElementById('reset-set-btn');

    // 該局結束後 → 唯讀：計分面板、暫停、換人、輪轉、重設全部鎖定（第 1、2、3 局一致）
    const locked = currentData.isFinished;
    [controlsPanel, rotateBtn, resetBtn,
        document.getElementById('timeout-btn'),
        document.getElementById('sub-mode-btn')].forEach(el => {
        if (!el) return;
        el.style.opacity = locked ? '0.5' : '1';
        el.style.pointerEvents = locked ? 'none' : 'auto';
    });
    document.getElementById('current-set-label').textContent =
        `第 ${currentSet} 局 ${currentSet === 3 ? '(決賽局 15分)' : '(25分)'}` + (locked ? ' 已結束・唯讀' : '');

    setActivePlayer(activePlayerIndex);
    renderLogs();
    updateNextSetBanner();
}

function renderLogs() {
    const currentData = matchSets[currentSet];
    const box = document.getElementById('log-container');
    box.innerHTML = '';
    currentData.historyLog.slice().reverse().forEach(item => {
        let div = document.createElement('div');
        div.className = 'log-item';
        div.textContent = item.text;
        if (item.team === 'our') div.style.color = '#12896a';
        else if (item.team === 'opponent') div.style.color = '#d4495a';
        else div.style.color = '#475569';
        box.appendChild(div);
    });
}

function openSummaryModal(type = 'total') {
    if (type === 'set') type = currentSet;   // 「單局數據報表」→ 目前這一局
    currentSummaryType = type;
    updateSummaryModalTabs();
    generateReportHTML();
    const backBtn = document.getElementById('summary-back-btn');
    if (backBtn) backBtn.textContent = viewingHistory ? '關閉' : '返回比賽';
    document.getElementById('summary-modal').style.display = 'flex';
}

function switchSummaryMode(type) {
    currentSummaryType = 'total';
    updateSummaryModalTabs();
    generateReportHTML();
}

function switchSummarySet(setNum) {
    currentSummaryType = setNum;
    updateSummaryModalTabs();
    generateReportHTML();
}

function updateSummaryModalTabs() {
    for (let s = 1; s <= 3; s++) {
        const btn = document.getElementById(`modal-tab-set${s}`);
        if (currentSummaryType === s) btn.classList.add('active');
        else btn.classList.remove('active');
    }
    const btnTotal = document.getElementById(`modal-tab-total`);
    const title = document.getElementById('summary-modal-title');

    if (currentSummaryType === 'total') {
        btnTotal.classList.add('active');
        title.textContent = `📋 全場賽後球員數據總合報表`;
    } else {
        btnTotal.classList.remove('active');
        title.textContent = `📊 第 ${currentSummaryType} 局球員數據報表`;
    }
}

function getSortedReportPlayers(targetSetNum = null) {
    let activeLineup = [];
    let substituted = new Set();

    if (typeof targetSetNum === 'number') {
        activeLineup = matchSets[targetSetNum].lineup || [];
        substituted = matchSets[targetSetNum].substitutedPlayers || new Set();
    } else {
        for (let s = 1; s <= 3; s++) {
            (matchSets[s].lineup || []).forEach(p => activeLineup.push(p));
            if (matchSets[s].substitutedPlayers) {
                matchSets[s].substitutedPlayers.forEach(p => substituted.add(p));
            }
        }
    }

    let startingSix = [...new Set(activeLineup)].filter(Boolean);
    let benchSubs = [...substituted].filter(p => !startingSix.includes(p));
    let unplayed = registeredPlayers.filter(p => !startingSix.includes(p) && !benchSubs.includes(p));

    const sortByNameNum = (a, b) => parseInt((a.split(' ')[0] || 0)) - parseInt((b.split(' ')[0] || 0));
    startingSix.sort(sortByNameNum);
    benchSubs.sort(sortByNameNum);
    unplayed.sort(sortByNameNum);

    return [...startingSix, ...benchSubs, ...unplayed];
}

// 報表生成：加入「其他失誤」欄位呈現
function generateReportHTML(opts = {}) {
    const area = document.getElementById('summary-content-area');
    if (!opts.returnOnly) area.innerHTML = '';

    let statsToRender = {};
    let setOurScore = 0;
    let setOppScore = 0;
    let opponentErrors = { serve: 0, attack: 0, foul: 0, other: 0 };
    let reportPlayers = [];

    if (typeof currentSummaryType === 'number') {
        statsToRender = matchSets[currentSummaryType].playerStats || {};
        setOurScore = matchSets[currentSummaryType].ourScore;
        setOppScore = matchSets[currentSummaryType].opponentScore;
        reportPlayers = getSortedReportPlayers(currentSummaryType);

        matchSets[currentSummaryType].historyLog.forEach(item => {
            if (item.team === 'our') {
                if (item.reason === '對方發球失誤') opponentErrors.serve++;
                else if (item.reason === '對方攻擊失誤') opponentErrors.attack++;
                else if (item.reason === '對方犯規送分') opponentErrors.foul++;
                else if (item.reason === '對方其他失誤') opponentErrors.other++;
            }
        });
    } else {
        registeredPlayers.forEach(pName => {
            statsToRender[pName] = {
                serveAttempts: 0, serveAce: 0, serveError: 0,
                attackScore: 0, attackError: 0,
                dropScore: 0, dropError: 0,
                blockScore: 0, blockError: 0,
                defenseScore: 0, defenseError: 0,
                otherError: 0,
                foulCarry: 0, foulDoubleHit: 0, foulNet: 0, foulCrossing: 0
            };
        });

        for (let s = 1; s <= 3; s++) {
            let pStats = matchSets[s].playerStats;
            for (let pName in pStats) {
                if (!statsToRender[pName]) continue;
                for (let key in pStats[pName]) {
                    statsToRender[pName][key] += pStats[pName][key];
                }
            }
            matchSets[s].historyLog.forEach(item => {
                if (item.team === 'our') {
                    if (item.reason === '對方發球失誤') opponentErrors.serve++;
                    else if (item.reason === '對方攻擊失誤') opponentErrors.attack++;
                    else if (item.reason === '對方犯規送分') opponentErrors.foul++;
                    else if (item.reason === '對方其他失誤') opponentErrors.other++;
                }
            });
        }

        for (let s = 1; s <= 3; s++) {
            setOurScore += matchSets[s].ourScore;
            setOppScore += matchSets[s].opponentScore;
        }
        reportPlayers = getSortedReportPlayers();
    }

    // 我方球員的得分 / 失誤：只加總「我方球員自己的」紀錄
    // （對方得分、對方失誤送分都不算進我方球員的失誤或得分）
    let teamPlayerGain = 0;
    let teamPlayerError = 0;
    reportPlayers.forEach(pName => {
        const st = statsToRender[pName];
        if (!st) return;
        teamPlayerGain += st.serveAce + st.attackScore + st.dropScore + st.blockScore + st.defenseScore;
        teamPlayerError += st.serveError + st.attackError + st.dropError + st.blockError + st.defenseError + st.otherError
            + st.foulCarry + st.foulDoubleHit + st.foulNet + st.foulCrossing;
    });

    let setLabelStr = (typeof currentSummaryType === 'number') ? `第 ${currentSummaryType} 局` : `全場總計`;
    let nextSetQuickBtn = "";
    if (!viewingHistory && typeof currentSummaryType === 'number' && currentSummaryType < 3
        && matchSetWinners[currentSummaryType] && !isMatchOverAfterSet(currentSummaryType)) {
        const nextNum = currentSummaryType + 1;
        const nextUnlocked = !document.getElementById(`set-btn-${nextNum}`).disabled;
        nextSetQuickBtn = nextUnlocked
            ? `<button class="btn-success" style="padding:6px 12px; font-size:0.85rem;" onclick="closeSummaryModal(); switchSet(${nextNum});">➡️ 切換到第 ${nextNum} 局</button>`
            : `<button class="btn-success" style="padding:6px 12px; font-size:0.85rem;" onclick="closeSummaryModal(); showSetEndModal(${currentSummaryType});">➡️ 確認站位，進入第 ${nextNum} 局</button>`;
    }

    if (!viewingHistory && currentSummaryType === 'total') {
        const pending = getPendingNextSet();
        if (pending) {
            nextSetQuickBtn = `<button class="btn-success" style="padding:6px 12px; font-size:0.85rem;" onclick="closeSummaryModal(); showSetEndModal(${pending});">➡️ 確認站位，進入第 ${pending + 1} 局</button>`;
        }
    }

    let html = `
        <div style="background:#f1f5f9; padding:10px 15px; border-radius:8px; margin-bottom:15px; font-weight:bold; font-size:0.95rem; border:1px solid #cbd5e1; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div>📅 日期：${matchInfo.date || '未填'} | 🏆 比賽：${matchInfo.tournament || '友誼賽'} | ${activeTeamName} v.s ${matchInfo.opponent || '對手'} | 📌 ${setLabelStr} | 📊 比分：${setOurScore} : ${setOppScore}</div>
            <div>${nextSetQuickBtn}</div>
        </div>
        <div style="overflow-x:auto;">
            <table class="paper-matrix-table">
                <thead>
                    <tr>
                        <th rowspan="2" style="width: 45px;">號碼</th>
                        <th rowspan="2" style="width: 95px;">球員姓名</th>
                        <th colspan="3">發球</th>
                        <th colspan="2">攻擊</th>
                        <th colspan="2">吊球</th>
                        <th colspan="2">攔網</th>
                        <th colspan="2">防守</th>
                        <th rowspan="2" style="width: 35px;">其他<br>失誤</th>
                        <th colspan="4">犯規</th>
                        <th rowspan="2" style="width: 40px;">總<br>得分</th>
                        <th rowspan="2" style="width: 40px;">總<br>失分</th>
                    </tr>
                    <tr>
                        <th style="width: 30px;">次</th><th style="width: 30px;">得</th><th style="width: 30px;">失</th>
                        <th style="width: 30px;">得</th><th style="width: 30px;">失</th>
                        <th style="width: 30px;">得</th><th style="width: 30px;">失</th>
                        <th style="width: 30px;">得</th><th style="width: 30px;">失</th>
                        <th style="width: 30px;">得</th><th style="width: 30px;">失</th>
                        <th style="width: 35px;">持球</th><th style="width: 35px;">二次</th><th style="width: 35px;">觸網</th><th style="width: 35px;">越界</th>
                    </tr>
                </thead>
                <tbody>
    `;

    reportPlayers.forEach(pName => {
        let st = statsToRender[pName] || {
            serveAttempts: 0, serveAce: 0, serveError: 0,
            attackScore: 0, attackError: 0,
            dropScore: 0, dropError: 0,
            blockScore: 0, blockError: 0,
            defenseScore: 0, defenseError: 0,
            otherError: 0,
            foulCarry: 0, foulDoubleHit: 0, foulNet: 0, foulCrossing: 0
        };
        // 總得分 = 發球Ace + 攻擊/吊球/攔網/防守得分；總失分 = 各項失誤 + 其他失誤 + 犯規
        const totalGain = st.serveAce + st.attackScore + st.dropScore + st.blockScore + st.defenseScore;
        const totalLoss = st.serveError + st.attackError + st.dropError + st.blockError + st.defenseError + st.otherError
            + st.foulCarry + st.foulDoubleHit + st.foulNet + st.foulCrossing;
        let parts = pName.split(' ');
        let num = parts[0] || '';
        let name = parts.slice(1).join(' ') || pName;

        html += `
            <tr>
                <td><b>${num}</b></td>
                <td style="text-align:left; padding-left:6px;">${name}</td>
                <td>${st.serveAttempts}</td><td>${st.serveAce}</td><td>${st.serveError}</td>
                <td>${st.attackScore}</td><td>${st.attackError}</td>
                <td>${st.dropScore}</td><td>${st.dropError}</td>
                <td>${st.blockScore}</td><td>${st.blockError}</td>
                <td>${st.defenseScore}</td><td>${st.defenseError}</td>
                <td>${st.otherError}</td>
                <td>${st.foulCarry}</td><td>${st.foulDoubleHit}</td><td>${st.foulNet}</td><td>${st.foulCrossing}</td>
                <td style="font-weight:bold; color:#12896a;">${totalGain}</td><td style="font-weight:bold; color:#d4495a;">${totalLoss}</td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>
    `;

    html += `
        <div style="display:grid; grid-template-columns: 1fr 1.5fr; gap:15px; margin-top:15px;">
            <table class="paper-matrix-table" style="table-layout: auto;">
                <thead>
                    <tr><th colspan="2">${activeTeamName}（球員統計合計）</th></tr>
                    <tr><th>得分</th><th>失誤</th></tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="font-size:1.1rem; font-weight:bold; color:#12896a;">${teamPlayerGain}</td>
                        <td style="font-size:1.1rem; font-weight:bold; color:#d4495a;">${teamPlayerError}</td>
                    </tr>
                </tbody>
            </table>

            <table class="paper-matrix-table" style="table-layout: auto;">
                <thead>
                    <tr><th colspan="4">對方失誤</th></tr>
                    <tr><th>發球失誤</th><th>攻擊失誤</th><th>犯規</th><th>其他失誤</th></tr>
                </thead>
                <tbody>
                    <tr>
                        <td><b>${opponentErrors.serve}</b></td>
                        <td><b>${opponentErrors.attack}</b></td>
                        <td><b>${opponentErrors.foul}</b></td>
                        <td><b>${opponentErrors.other}</b></td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;

    // 流水帳：單局報表顯示該局，全場報表顯示所有已開打的局
    const logSets = (typeof currentSummaryType === 'number')
        ? [currentSummaryType]
        : [1, 2, 3].filter(s => matchSets[s].historyLog.length > 0 || matchSets[s].ourScore + matchSets[s].opponentScore > 0);
    if (!opts.noAnalysis) html += buildAnalysisHTML(currentSummaryType);
    if (!opts.noLog) html += buildMatchLogHTML(logSets);

    if (opts.returnOnly) return html;
    area.innerHTML = html;
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

// 整場賽事流水帳（依時間順序；隨報表一起列印 / 匯出圖片）
function buildMatchLogHTML(setNums) {
    let html = `<div style="margin-top:18px;">
        <div style="font-weight:700; font-size:1rem; padding-bottom:6px; margin-bottom:10px; border-bottom:2px solid #e5ddc8;">賽事流水帳${setNums.length > 1 ? '（全場）' : ''}</div>`;
    if (setNums.length === 0) {
        return html + `<div style="color:#7a8899; font-size:.9rem;">尚無比賽紀錄</div></div>`;
    }
    setNums.forEach(s => {
        const d = matchSets[s];
        html += `<div style="margin-bottom:14px;">
            <div style="font-weight:700; background:#efe8d4; padding:6px 10px; border-radius:6px; font-size:.92rem;">第 ${s} 局　${d.ourScore} : ${d.opponentScore}${d.isFinished ? '（已結束）' : ''}</div>`;
        if (d.historyLog.length === 0) {
            html += `<div style="padding:6px 10px; color:#7a8899; font-size:.85rem;">（本局尚無紀錄）</div>`;
        }
        d.historyLog.forEach((item, i) => {
            const color = item.team === 'our' ? '#12896a' : (item.team === 'opponent' ? '#d4495a' : '#4a5a6c');
            html += `<div style="padding:4px 10px; font-size:.84rem; border-bottom:1px dotted #d9d0b8; color:${color};"><span style="color:#7a8899; display:inline-block; min-width:2.2em;">${i + 1}.</span>${escapeHtml(item.text || item.reason || '')}</div>`;
        });
        html += `</div>`;
    });
    return html + `</div>`;
}

function closeSummaryModal() {
    document.getElementById('summary-modal').style.display = 'none';
    endHistoryView();
}

function getExportFileName() {
    const label = (typeof currentSummaryType === 'number') ? `第${currentSummaryType}局` : '全場';
    return `${matchInfo.date || '比賽'}_${activeTeamName}_vs_${matchInfo.opponent || '對手'}_賽事紀錄表`.replace(/[\\/:*?"<>|\s]+/g, '_');
}

// ===== 完整賽事紀錄表（與畫面上選哪一局無關）：總計 + 各局統計 + 整場流水帳 =====
function buildFullSheetHTML() {
    const savedType = currentSummaryType;
    const played = [1, 2, 3].filter(s => matchSets[s].historyLog.length > 0 || matchSets[s].ourScore + matchSets[s].opponentScore > 0);
    const setLine = played.map(s => `第${s}局 ${matchSets[s].ourScore}:${matchSets[s].opponentScore}`).join('　｜　');
    const secTitle = (t) => `<div style="font-weight:700; font-size:1.05em; padding:5px 12px; background:#2f6db5; color:#fff; border-radius:6px; margin-bottom:8px;">${t}</div>`;

    let html = `<div style="margin-bottom:14px;">
        <div style="font-size:1.5em; font-weight:700;">${escapeHtml(activeTeamName)} v.s ${escapeHtml(matchInfo.opponent || '對手')}　賽事紀錄表</div>
        <div style="color:#4a5a6c; font-size:.92em; margin-top:4px;">${escapeHtml(matchInfo.date || '')}　${escapeHtml(matchInfo.tournament || '友誼賽')}　${setLine}</div>
    </div>`;
    try {
        currentSummaryType = 'total';
        html += `<div style="break-inside:avoid; margin-bottom:16px;">${secTitle('全場總計')}${generateReportHTML({ returnOnly: true, noLog: true, noAnalysis: true })}</div>`;
        played.forEach(s => {
            currentSummaryType = s;
            html += `<div style="break-inside:avoid; margin-bottom:16px;">${secTitle(`第 ${s} 局`)}${generateReportHTML({ returnOnly: true, noLog: true, noAnalysis: true })}</div>`;
        });
    } finally {
        currentSummaryType = savedType;
    }
    html += buildAnalysisHTML('total');
    html += buildMatchLogHTML(played);
    return html;
}

function getFullSheetElementHTML() {
    const box = document.createElement('div');
    box.innerHTML = buildFullSheetHTML();
    box.querySelectorAll('button').forEach(b => b.remove());
    return box.innerHTML;
}

// ===== PDF：列印「完整紀錄表」（style.css 的 @media print 只輸出 #print-sheet）=====
function exportReportAsPDF() {
    let sheet = document.getElementById('print-sheet');
    if (!sheet) {
        sheet = document.createElement('div');
        sheet.id = 'print-sheet';
        document.body.appendChild(sheet);
    }
    sheet.innerHTML = getFullSheetElementHTML();

    const oldTitle = document.title;
    document.title = getExportFileName();
    window.addEventListener('afterprint', () => { document.title = oldTitle; sheet.innerHTML = ''; }, { once: true });
    window.print();
}

// ===== 圖片：畫成 PNG → 開啟可縮放的預覽視窗 → 下載（不需外部套件，離線可用）=====
const REPORT_EXPORT_CSS = `
.paper-matrix-table { width:100%; table-layout:fixed; border-collapse:collapse; margin-bottom:15px; font-size:13px; }
.paper-matrix-table th, .paper-matrix-table td { border:1px solid #cfd9e3; padding:7px 2px; text-align:center; overflow:hidden; white-space:nowrap; }
.paper-matrix-table th { background:#efe8d4; font-weight:700; color:#1c2b3a; }
.paper-matrix-table tbody tr:nth-child(even) { background:#fbf8f0; }
.paper-matrix-table tbody tr:nth-child(odd) { background:#ffffff; }
`;
const PREVIEW_BASE_W = 1400;
let previewUrl = null;

function exportReportAsImage() {
    const W = PREVIEW_BASE_W, SCALE = 2;
    const wrap = document.createElement('div');
    wrap.style.cssText = `position:fixed; left:-99999px; top:0; width:${W}px; box-sizing:border-box; padding:28px; background:#fff; color:#1c2b3a; line-height:1.5; font-size:14px; font-family:-apple-system,BlinkMacSystemFont,"PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif;`;
    wrap.innerHTML = `<style>${REPORT_EXPORT_CSS}</style>` + getFullSheetElementHTML();
    document.body.appendChild(wrap);
    const H = wrap.scrollHeight;
    wrap.style.position = 'static';
    wrap.style.left = '';
    wrap.style.top = '';
    const xhtml = new XMLSerializer().serializeToString(wrap);   // 轉成合法 XHTML（<br> 等需自閉合）
    document.body.removeChild(wrap);

    const fail = () => alert('此瀏覽器無法直接產生圖片，請改用「匯出 / 儲存為 PDF」，或使用螢幕截圖。');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><foreignObject x="0" y="0" width="${W}" height="${H}">${xhtml}</foreignObject></svg>`;
    const img = new Image();
    img.onload = () => {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = W * SCALE;
            canvas.height = H * SCALE;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.scale(SCALE, SCALE);
            ctx.drawImage(img, 0, 0);
            canvas.toBlob(blob => {
                if (!blob) { fail(); return; }
                openImagePreview(blob);
            }, 'image/png');
        } catch (e) { fail(); }
    };
    img.onerror = fail;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function openImagePreview(blob) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(blob);
    const img = document.getElementById('preview-img');
    img.src = previewUrl;
    document.getElementById('image-preview-modal').style.display = 'flex';
}

function downloadPreviewImage() {
    if (!previewUrl) return;
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = getExportFileName() + '.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
}

function closeImagePreview() {
    document.getElementById('image-preview-modal').style.display = 'none';
    if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
    document.getElementById('preview-img').removeAttribute('src');
}

function exportTeamsData() {
    if (!activeTeamName || !teamsData[activeTeamName]) {
        alert('目前沒有選定有效的球隊可供匯出！');
        return;
    }

    const singleTeamData = { [activeTeamName]: teamsData[activeTeamName] };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(singleTeamData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);

    const dateObj = new Date();
    const dateStr = `${dateObj.getFullYear()}${String(dateObj.getMonth()+1).padStart(2,'0')}${String(dateObj.getDate()).padStart(2,'0')}`;
    downloadAnchor.setAttribute("download", `volleyball_team_${activeTeamName}_${dateStr}.json`);

    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

function importTeamsData(event) {
    const fileReader = new FileReader();
    if (event.target.files && event.target.files[0]) {
        fileReader.readAsText(event.target.files[0], "UTF-8");
        fileReader.onload = function (e) {
            try {
                const importedData = JSON.parse(e.target.result);
                if (typeof importedData === 'object' && importedData !== null) {
                    teamsData = importedData;
                    saveAllData();
                    const keys = Object.keys(teamsData);
                    if (keys.length > 0) activeTeamName = keys[0];
                    updateAllTeamSelects();
                    renderTeamTable();
                    renderPregameCheckboxes();
                    alert('🎉 成功匯入球隊資料！');
                } else {
                    alert('檔案格式錯誤，無法識別！');
                }
            } catch (error) {
                alert('解析 JSON 檔案失敗，請確認檔案格式是否正確。');
            }
            event.target.value = '';
        };
    }
}

// ===== 得失分按鈕：直接列在版面上（犯規除外，仍用彈窗） =====
function recordInline(category, idx) {
    const d = matchSets[currentSet];
    if (d.isFinished) { alert('此局已結束，無法記錄數據！'); return; }
    const p = d.lineup[activePlayerIndex];
    if (!p || p === '-') { alert('請先在上方點擊選擇一位場上球員！'); return; }
    const item = categoryDetails[category][idx];
    recordDetailedEvent(item.impact, category, item.reason, item.statKey);
}

function renderScoringGroups() {
    const box = document.getElementById('scoring-groups');
    if (!box) return;
    box.innerHTML = '';

    const makeRow = (title) => {
        const row = document.createElement('div');
        row.className = 'score-group';
        row.innerHTML = `<div class="score-group-title">${title}</div>`;
        const btns = document.createElement('div');
        btns.className = 'score-group-btns';
        row.appendChild(btns);
        box.appendChild(row);
        return btns;
    };
    const makeBtn = (text, cls, fn) => {
        const b = document.createElement('button');
        b.textContent = text;
        b.className = 'score-btn ' + cls;
        b.onclick = fn;
        return b;
    };
    const cls = (item) => item.impact === 'our' ? 'is-gain' : item.impact === 'opponent' ? 'is-loss' : 'is-neutral';

    Object.keys(categoryDetails).filter(c => c !== "犯規" && c !== "其他失誤").forEach(cat => {
        const btns = makeRow(cat);
        categoryDetails[cat].forEach((item, i) => {
            // 列標題已是類別名稱，按鈕只留差異字樣（攻擊得分 → 得分）
            let text = item.label.replace(cat, '').trim();
            if (!text || text.startsWith('+')) text = item.label;
            btns.appendChild(makeBtn(text, cls(item), () => recordInline(cat, i)));
        });
    });

    // 其他失誤 與 犯規 並列
    const last = makeRow('失誤');
    categoryDetails["其他失誤"].forEach((item, i) => last.appendChild(makeBtn(item.label, cls(item), () => recordInline("其他失誤", i))));
    last.appendChild(makeBtn('犯規', 'is-foul', () => openDetailModal('犯規')));
}
renderScoringGroups();

// ==================== 背號膠囊 ====================
function playerBadgeHTML(str) {
    if (!str || str === '-') return '-';
    const i = str.indexOf(' ');
    const num = i < 0 ? '' : str.slice(0, i);
    const name = i < 0 ? str : str.slice(i + 1);
    return `<span class="player-badge-pill">${escapeHtml(num)}</span><span class="player-name-text">${escapeHtml(name)}</span>`;
}

// ==================== 操作回饋：畫面閃爍 + 提示浮窗 ====================
function flashFeedback(kind) {
    let el = document.getElementById('flash-overlay');
    if (!el) {
        el = document.createElement('div');
        el.id = 'flash-overlay';
        document.body.appendChild(el);
    }
    el.className = '';
    void el.offsetWidth;   // 重新觸發動畫
    el.className = 'flash-' + kind;
    if (navigator.vibrate) navigator.vibrate(kind === 'loss' ? 60 : 30);
}

let toastTimer = null;
function showToast(msg) {
    let el = document.getElementById('toast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'toast';
        document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

function afterPointFeedback(impact, rotated, hadServe) {
    flashFeedback(impact === 'our' ? 'gain' : (impact === 'opponent' ? 'loss' : 'neutral'));
    const d = matchSets[currentSet];
    if (rotated) {
        const p = d.lineup[0] || '';
        showToast(`已自動順時針輪轉，目前 P1 發球員：${p}`);
    } else if (impact === 'opponent' && hadServe) {
        showToast('發球權轉換：對手發球');
    }
}

// ==================== 戰術分析（內嵌 SVG，隨報表一起匯出）====================
const CH = { green: '#12896a', red: '#d4495a', blue: '#2f6db5', amber: '#d98a2b', purple: '#7a5aa6', teal: '#2b8a9c', gray: '#8794a3' };

function sumStatsForType(type) {
    const sets = (typeof type === 'number') ? [type] : [1, 2, 3];
    const stats = {};
    sets.forEach(s => {
        const ps = matchSets[s].playerStats || {};
        Object.keys(ps).forEach(p => {
            if (!stats[p]) stats[p] = createPlayerStats();
            Object.keys(ps[p]).forEach(k => { stats[p][k] = (stats[p][k] || 0) + ps[p][k]; });
        });
    });
    return { sets, stats };
}
const statGain = st => st.serveAce + st.attackScore + st.dropScore + st.blockScore + st.defenseScore;
const statLoss = st => st.serveError + st.attackError + st.dropError + st.blockError + st.defenseError + st.otherError
    + st.foulCarry + st.foulDoubleHit + st.foulNet + st.foulCrossing;

const chartCard = (title, body, note = '') =>
    `<div style="border:1px solid #e5ddc8; border-radius:10px; padding:12px; background:#fff; break-inside:avoid;">
        <div style="font-weight:700; font-size:.92rem; margin-bottom:8px; color:#1c2b3a;">${title}</div>${body}
        ${note ? `<div style="font-size:.78rem; color:#7a8899; margin-top:6px; line-height:1.5;">${note}</div>` : ''}</div>`;
const emptyChart = (t = '尚無足夠資料') => `<div style="color:#7a8899; font-size:.85rem; padding:20px 0; text-align:center;">${t}</div>`;

// 淨勝分（得分 − 失分）
function chartNetBars(stats) {
    const rows = Object.keys(stats).map(p => { const g = statGain(stats[p]), l = statLoss(stats[p]); return { p, g, l, net: g - l }; })
        .filter(r => r.g + r.l > 0).sort((a, b) => b.net - a.net);
    if (!rows.length) return emptyChart();
    const W = 520, rowH = 28, labelW = 96, valW = 118, H = rows.length * rowH + 8;
    const half = (W - labelW - valW) / 2, mid = labelW + half;
    const max = Math.max(1, ...rows.map(r => Math.abs(r.net)));
    let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;"><line x1="${mid}" y1="0" x2="${mid}" y2="${H}" stroke="#cfd9e3"/>`;
    rows.forEach((r, i) => {
        const y = 4 + i * rowH, w = Math.abs(r.net) / max * (half - 4), col = r.net >= 0 ? CH.green : CH.red;
        s += `<text x="${labelW - 8}" y="${y + 17}" font-size="12" text-anchor="end" fill="#1c2b3a">${escapeHtml(r.p)}</text>`;
        s += `<rect x="${r.net >= 0 ? mid : mid - w}" y="${y + 3}" width="${Math.max(w, 1)}" height="${rowH - 10}" rx="3" fill="${col}"/>`;
        s += `<text x="${W - valW + 8}" y="${y + 17}" font-size="12" fill="#1c2b3a"><tspan font-weight="700" fill="${col}">${r.net > 0 ? '+' : ''}${r.net}</tspan> (得${r.g} / 失${r.l})</text>`;
    });
    return s + '</svg>';
}

// 圓環圖（得分來源 / 失分來源）
function chartDonut(items) {
    const data = items.filter(d => d.value > 0), total = data.reduce((a, d) => a + d.value, 0);
    if (!total) return emptyChart();
    const R = 44, C = 2 * Math.PI * R;
    let off = 0, s = `<svg viewBox="0 0 330 ${Math.max(130, data.length * 20 + 16)}" width="100%" style="display:block;"><g transform="rotate(-90 65 65)">`;
    data.forEach(d => {
        const len = d.value / total * C;
        s += `<circle cx="65" cy="65" r="${R}" fill="none" stroke="${d.color}" stroke-width="26" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}"/>`;
        off += len;
    });
    s += `</g><text x="65" y="62" text-anchor="middle" font-size="11" fill="#7a8899">合計</text><text x="65" y="81" text-anchor="middle" font-size="18" font-weight="700" fill="#1c2b3a">${total}</text>`;
    data.forEach((d, i) => {
        const y = 16 + i * 20;
        s += `<rect x="140" y="${y - 9}" width="11" height="11" rx="2" fill="${d.color}"/><text x="158" y="${y}" font-size="12" fill="#1c2b3a">${d.label}  ${d.value}（${Math.round(d.value / total * 100)}%）</text>`;
    });
    return s + '</svg>';
}

// 比分走勢（我方 − 對手），標出暫停
function chartMomentum(s) {
    const diffs = [0], seq = [], marks = [];
    matchSets[s].historyLog.forEach(it => {
        if (it.team === 'our' || it.team === 'opponent') { diffs.push(it.ourScore - it.opponentScore); seq.push(it.team); }
        else if (it.text && it.text.includes('暫停記錄')) marks.push({ i: seq.length, mine: it.text.includes('由 【我方】'), score: `${it.ourScore}:${it.opponentScore}` });
    });
    if (diffs.length < 2) return { svg: emptyChart('本局尚無得失分紀錄'), note: '' };
    const W = 520, H = 190, L = 34, R = 10, T = 18, B = 22, n = diffs.length - 1;
    const m = Math.max(3, ...diffs.map(Math.abs));
    const X = i => L + i / n * (W - L - R), Y = v => T + (m - v) / (2 * m) * (H - T - B);
    let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;">`;
    [m, 0, -m].forEach(v => { svg += `<line x1="${L}" y1="${Y(v)}" x2="${W - R}" y2="${Y(v)}" stroke="${v === 0 ? '#94a3b8' : '#e3e8ee'}" ${v === 0 ? 'stroke-dasharray="4 3"' : ''}/><text x="${L - 5}" y="${Y(v) + 4}" font-size="10" text-anchor="end" fill="#7a8899">${v > 0 ? '+' : ''}${v}</text>`; });
    marks.forEach((mk, k) => {
        const x = X(mk.i), col = mk.mine ? CH.purple : CH.gray;
        svg += `<line x1="${x}" y1="${T - 4}" x2="${x}" y2="${H - B}" stroke="${col}" stroke-dasharray="3 3"/><text x="${x}" y="${T - 7}" font-size="10" text-anchor="middle" fill="${col}" font-weight="700">T${k + 1}</text>`;
    });
    svg += `<polyline points="${diffs.map((v, i) => `${X(i)},${Y(v)}`).join(' ')}" fill="none" stroke="${CH.blue}" stroke-width="2.2" stroke-linejoin="round"/>`;
    svg += `<text x="${W - R}" y="${H - 6}" font-size="10" text-anchor="end" fill="#7a8899">得失分順序（共 ${n} 球）</text></svg>`;
    let bestOur = 0, bestOpp = 0, run = 0, last = '';
    seq.forEach(t => { run = (t === last) ? run + 1 : 1; last = t; if (t === 'our') bestOur = Math.max(bestOur, run); else bestOpp = Math.max(bestOpp, run); });
    const tn = marks.map((mk, k) => {
        const next = seq.slice(mk.i, mk.i + 3), a = next.filter(t => t === 'our').length;
        return `T${k + 1}（${mk.mine ? '我方' : '對手'}，${mk.score}）後 ${next.length} 球：我方 ${a} : ${next.length - a} 對手`;
    }).join('；');
    return { svg, note: `最長連得 ${bestOur} 分｜最長連失 ${bestOpp} 分${tn ? '<br>' + tn : ''}` };
}

// 輪轉失分熱點：以「該球回合開始時的 P1 發球員」代表輪次
function rotationHeatHTML(sets) {
    const map = {};
    sets.forEach(s => matchSets[s].historyLog.forEach(it => {
        if ((it.team !== 'our' && it.team !== 'opponent') || !it.lineup) return;
        let pre = it.lineup.slice();
        if (it.text && it.text.includes('順時針輪轉')) pre = [pre[5], ...pre.slice(0, 5)];   // 還原輪轉前站位
        const k = pre[0];
        if (!k) return;
        if (!map[k]) map[k] = { w: 0, l: 0 };
        if (it.team === 'our') map[k].w++; else map[k].l++;
    }));
    const rows = Object.keys(map).map(k => ({ k, w: map[k].w, l: map[k].l, rate: map[k].l / (map[k].w + map[k].l) }))
        .sort((a, b) => b.rate - a.rate || b.l - a.l);
    if (!rows.length) return emptyChart();
    let html = `<table class="paper-matrix-table" style="table-layout:auto;"><thead><tr><th>P1 發球員</th><th>得分</th><th>失分</th><th style="width:42%;">失分率</th></tr></thead><tbody>`;
    rows.forEach(r => {
        const pct = Math.round(r.rate * 100);
        html += `<tr><td style="text-align:left; padding-left:8px;">${escapeHtml(r.k)}</td><td style="color:${CH.green}; font-weight:700;">${r.w}</td><td style="color:${CH.red}; font-weight:700;">${r.l}</td>
            <td style="text-align:left;"><div style="display:flex; align-items:center; gap:6px; padding:0 6px;"><div style="height:12px; border-radius:3px; width:${pct}%; min-width:2px; background:rgba(212,73,90,${(0.25 + 0.75 * r.rate).toFixed(2)});"></div><span style="font-size:.8rem;">${pct}%</span></div></td></tr>`;
    });
    return html + '</tbody></table>';
}

// 球員五維雷達圖：發球 / 攻擊 / 防守 / 攔網 / 穩定度
function radarHTML(stats) {
    const list = Object.keys(stats).filter(p => statGain(stats[p]) + statLoss(stats[p]) > 0);
    if (!list.length) return emptyChart();
    const dims = st => [st.serveAce - st.serveError, st.attackScore + st.dropScore - st.attackError - st.dropError, st.defenseScore - st.defenseError, st.blockScore - st.blockError];
    const maxAbs = Math.max(1, ...list.flatMap(p => dims(stats[p]).map(Math.abs)));
    const labels = ['發球', '攻擊', '防守', '攔網', '穩定度'];
    const cx = 90, cy = 88, R = 56, ang = i => -Math.PI / 2 + i * 2 * Math.PI / 5;
    const pt = (i, f) => [(cx + R * f * Math.cos(ang(i))).toFixed(1), (cy + R * f * Math.sin(ang(i))).toFixed(1)];
    const cards = list.map(p => {
        const st = stats[p], g = statGain(st), l = statLoss(st);
        const vals = dims(st).map(n => (50 + 50 * n / maxAbs) / 100);
        vals.push(1 - l / (g + l));
        let s = `<svg viewBox="0 0 180 180" width="100%" style="display:block; max-width:190px; margin:0 auto;">`;
        [0.25, 0.5, 0.75, 1].forEach(f => { s += `<polygon points="${[0, 1, 2, 3, 4].map(i => pt(i, f).join(',')).join(' ')}" fill="none" stroke="#dde3ea"/>`; });
        [0, 1, 2, 3, 4].forEach(i => {
            const [x, y] = pt(i, 1), [lx, ly] = pt(i, 1.24);
            s += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#dde3ea"/><text x="${lx}" y="${+ly + 4}" font-size="11" text-anchor="middle" fill="#4a5a6c">${labels[i]}</text>`;
        });
        s += `<polygon points="${vals.map((v, i) => pt(i, v).join(',')).join(' ')}" fill="rgba(47,109,181,.28)" stroke="${CH.blue}" stroke-width="2"/></svg>`;
        return `<div style="text-align:center; break-inside:avoid;">${s}<div style="font-weight:700; font-size:.85rem;">${escapeHtml(p)}</div></div>`;
    });
    return `<div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(170px,1fr)); gap:10px;">${cards.join('')}</div>`;
}

function buildAnalysisHTML(type) {
    const { sets, stats } = sumStatsForType(type);
    const played = sets.filter(s => matchSets[s].historyLog.length > 0);
    if (!played.length) return '';
    let oppErr = 0;
    sets.forEach(s => matchSets[s].historyLog.forEach(it => {
        if (it.team === 'our' && typeof it.reason === 'string' && it.reason.startsWith('對方')) oppErr++;
    }));
    const sum = k => Object.values(stats).reduce((a, st) => a + st[k], 0);
    const gainItems = [
        { label: '發球 Ace', value: sum('serveAce'), color: CH.blue }, { label: '攻擊得分', value: sum('attackScore'), color: CH.teal },
        { label: '吊球得分', value: sum('dropScore'), color: CH.amber }, { label: '攔網得分', value: sum('blockScore'), color: CH.purple },
        { label: '防守得分', value: sum('defenseScore'), color: CH.green }, { label: '對方失誤送分', value: oppErr, color: CH.gray }
    ];
    const lossItems = [
        { label: '發球失誤', value: sum('serveError'), color: CH.blue }, { label: '攻擊失分', value: sum('attackError'), color: CH.teal },
        { label: '吊球失誤', value: sum('dropError'), color: CH.amber }, { label: '攔網失分', value: sum('blockError'), color: CH.purple },
        { label: '防守失誤', value: sum('defenseError'), color: CH.green }, { label: '其他失誤', value: sum('otherError'), color: CH.gray },
        { label: '犯規', value: sum('foulCarry') + sum('foulDoubleHit') + sum('foulNet') + sum('foulCrossing'), color: CH.red }
    ];
    const grid = 'display:grid; grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); gap:12px; margin-bottom:12px;';
    let html = `<div style="margin-top:18px;"><div style="font-weight:700; font-size:1rem; padding-bottom:6px; margin-bottom:10px; border-bottom:2px solid #e5ddc8;">戰術分析</div>`;
    html += `<div style="${grid}">
        ${chartCard('球員淨勝分（得分 − 失分）', chartNetBars(stats), '得分＝Ace、攻擊、吊球、攔網、防守得分；失分＝各項失誤與犯規。不含「對方失誤送分」。')}
        ${chartCard('得分來源', chartDonut(gainItems))}
        ${chartCard('失分來源', chartDonut(lossItems), '看是自己失誤送分較多，還是某項技術崩盤。')}
        ${chartCard('輪轉失分熱點', rotationHeatHTML(played), '以每一球開始時的 P1 發球員代表輪次；失分率越高顏色越深，排序由高到低。')}
    </div>`;
    html += `<div style="${grid}">` + played.map(s => {
        const m = chartMomentum(s);
        return chartCard(`第 ${s} 局比分走勢（我方 − 對手）`, m.svg, m.note);
    }).join('') + `</div>`;
    html += chartCard('球員能力雷達圖', radarHTML(stats), '發球／攻擊／防守／攔網為各項淨貢獻，以全隊最大值為基準（50 為持平）；穩定度＝1 − 失分占比。僅供賽後檢討參考。');
    return html + `</div>`;
}

// ==================== 賽事管理：儲存 / 檢視 / 刪除 / 備份 ====================
function getMatches() {
    try {
        const raw = localStorage.getItem(MATCHES_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
}

function setMatches(list) {
    try {
        localStorage.setItem(MATCHES_KEY, JSON.stringify(list));
        return true;
    } catch (e) {
        alert('儲存失敗：瀏覽器儲存空間可能已滿，請先到「賽事管理」匯出備份並刪除舊賽事。');
        return false;
    }
}

function serializeSetState(d) {
    return Object.assign({}, d, { substitutedPlayers: [...(d.substitutedPlayers || [])] });
}

function deserializeSetState(d) {
    const base = createSetState(d.lineup || ["", "", "", "", "", ""], d.hasServe !== false);
    return Object.assign(base, d, { substitutedPlayers: new Set(d.substitutedPlayers || []) });
}

function setHasData(d) {
    return d.historyLog.length > 0 || d.ourScore + d.opponentScore > 0;
}

function buildMatchRecord() {
    const sets = {};
    for (let s = 1; s <= 3; s++) sets[s] = serializeSetState(matchSets[s]);
    const winners = Object.assign({}, matchSetWinners);
    const ourSets = Object.values(winners).filter(w => w === 'our').length;
    const oppSets = Object.values(winners).filter(w => w === 'opponent').length;
    const finished = [1, 2, 3].some(s => winners[s] && isMatchOverAfterSet(s));
    return {
        id: currentMatchId,
        savedAt: Date.now(),
        date: matchInfo.date || '',
        tournament: matchInfo.tournament || '友誼賽',
        team: activeTeamName,
        opponent: matchInfo.opponent || '對手',
        roster: [...registeredPlayers],
        startLineup: [...matchStartLineup],
        winners, sets, ourSets, oppSets, finished
    };
}

// 儲存（以 id 覆蓋更新）；silent=true 時為自動存檔
function saveCurrentMatch(silent) {
    if (!currentMatchId) return false;
    if (![1, 2, 3].some(s => setHasData(matchSets[s]))) {
        if (!silent) showToast('目前還沒有任何得分紀錄可儲存');
        return false;
    }
    const rec = buildMatchRecord();
    const list = getMatches();
    const i = list.findIndex(m => m.id === rec.id);
    if (i >= 0) list[i] = rec; else list.push(rec);
    if (!setMatches(list)) return false;
    showToast(silent ? (rec.finished ? '全場賽事已自動儲存到「賽事管理」' : '本局已自動儲存') : '賽事已儲存，可到「賽事管理」查看');
    if (document.getElementById('history-tab').classList.contains('active')) renderMatchHistory();
    return true;
}

function saveAndOpenHistory() {
    saveCurrentMatch(true);
    closeSetEndModal();
    switchTab('history-tab');
}

function matchResultLabel(m) {
    if (m.finished) {
        const win = m.ourSets > m.oppSets;
        return { text: win ? '勝' : '敗', cls: win ? 'is-win' : 'is-loss' };
    }
    return { text: '未完成', cls: 'is-live' };
}

function renderMatchHistory() {
    const box = document.getElementById('history-list');
    if (!box) return;

    const all = getMatches().sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.savedAt - a.savedAt);

    // 球隊篩選選單
    const teamSel = document.getElementById('history-team-filter');
    const prevTeam = teamSel.value;
    const teams = [...new Set(all.map(m => m.team))];
    teamSel.innerHTML = '<option value="">全部球隊</option>' + teams.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
    teamSel.value = teams.includes(prevTeam) ? prevTeam : '';

    const kw = document.getElementById('history-search').value.trim().toLowerCase();
    const teamFilter = teamSel.value;
    const list = all.filter(m =>
        (!teamFilter || m.team === teamFilter) &&
        (!kw || `${m.opponent} ${m.tournament} ${m.team} ${m.date}`.toLowerCase().includes(kw)));

    const done = all.filter(m => m.finished);
    const wins = done.filter(m => m.ourSets > m.oppSets).length;
    document.getElementById('history-stats').textContent =
        `共 ${all.length} 場　｜　已完成 ${done.length} 場（${wins} 勝 ${done.length - wins} 敗）`;

    if (all.length === 0) {
        box.innerHTML = '<div class="history-empty">還沒有任何賽事紀錄。<br>比賽每局結束時會自動儲存，也可以在比賽中按「💾 儲存賽事」。</div>';
        return;
    }
    if (list.length === 0) {
        box.innerHTML = '<div class="history-empty">找不到符合條件的賽事。</div>';
        return;
    }

    box.innerHTML = list.map(m => {
        const r = matchResultLabel(m);
        const setScores = [1, 2, 3].filter(s => m.sets[s] && setHasData(m.sets[s]))
            .map(s => `<span class="hm-set">第${s}局 ${m.sets[s].ourScore}:${m.sets[s].opponentScore}</span>`).join('');
        return `<div class="history-card">
            <div class="hm-main">
                <div class="hm-top">
                    <span class="hm-date">📅 ${escapeHtml(m.date || '未填日期')}</span>
                    <span class="hm-tour">🏆 ${escapeHtml(m.tournament)}</span>
                    <span class="hm-badge ${r.cls}">${r.text}</span>
                </div>
                <div class="hm-vs">${escapeHtml(m.team)} <b>${m.ourSets} : ${m.oppSets}</b> ${escapeHtml(m.opponent)}</div>
                <div class="hm-sets">${setScores}</div>
            </div>
            <div class="hm-actions">
                <button class="btn-primary" onclick="viewMatchRecord('${m.id}')">📊 查看報表</button>
                <button class="btn-danger" onclick="deleteMatchRecord('${m.id}')">🗑 刪除</button>
            </div>
        </div>`;
    }).join('');
}

function viewMatchRecord(id) {
    const rec = getMatches().find(m => m.id === id);
    if (!rec) { alert('找不到這筆賽事紀錄。'); return; }

    if (!viewingHistory) {
        viewBackup = { matchSets, matchInfo, activeTeamName, registeredPlayers, matchSetWinners, currentSummaryType };
    }
    viewingHistory = true;
    matchSets = {};
    for (let s = 1; s <= 3; s++) matchSets[s] = deserializeSetState(rec.sets[s] || createSetState());
    matchInfo = { date: rec.date, tournament: rec.tournament, opponent: rec.opponent };
    activeTeamName = rec.team;
    registeredPlayers = [...rec.roster];
    matchSetWinners = Object.assign({}, rec.winners);
    openSummaryModal('total');
}

// 關閉報表時，把「目前比賽」的狀態還原
function endHistoryView() {
    if (!viewingHistory || !viewBackup) { viewingHistory = false; return; }
    ({ matchSets, matchInfo, activeTeamName, registeredPlayers, matchSetWinners, currentSummaryType } = viewBackup);
    viewBackup = null;
    viewingHistory = false;
}

function deleteMatchRecord(id) {
    const rec = getMatches().find(m => m.id === id);
    if (!rec) return;
    if (!confirm(`確定要刪除這場賽事紀錄嗎？\n${rec.date}　${rec.team} v.s ${rec.opponent}\n此動作無法復原。`)) return;
    setMatches(getMatches().filter(m => m.id !== id));
    renderMatchHistory();
}

function exportMatchesData() {
    const list = getMatches();
    if (list.length === 0) { alert('目前沒有可匯出的賽事紀錄。'); return; }
    const d = new Date();
    const ds = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const blob = new Blob([JSON.stringify({ type: 'volleyball_matches', version: 1, matches: list }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `volleyball_matches_${ds}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function importMatchesData(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            const incoming = Array.isArray(data) ? data : data.matches;
            if (!Array.isArray(incoming)) throw new Error('format');
            const list = getMatches();
            let added = 0, updated = 0;
            incoming.forEach(m => {
                if (!m || !m.id || !m.sets) return;
                const i = list.findIndex(x => x.id === m.id);
                if (i >= 0) { list[i] = m; updated++; } else { list.push(m); added++; }
            });
            if (setMatches(list)) {
                renderMatchHistory();
                alert(`匯入完成：新增 ${added} 場，更新 ${updated} 場。`);
            }
        } catch (err) {
            alert('匯入失敗，請確認這是從本系統匯出的賽事備份檔。');
        }
        event.target.value = '';
    };
    reader.readAsText(file, 'UTF-8');
}