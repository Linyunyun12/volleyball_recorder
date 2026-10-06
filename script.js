const presetSixPlayers = [
    { num: "1", name: "球員1", pos: [] },
    { num: "2", name: "球員2", pos: [] },
    { num: "3", name: "球員3", pos: [] },
    { num: "4", name: "球員4", pos: [] },
    { num: "5", name: "球員5", pos: [] },
    { num: "6", name: "球員6", pos: [] }
];

let teamsData = { "逢甲資工": JSON.parse(JSON.stringify(presetSixPlayers)) };
let activeTeamName = "逢甲資工";

let currentSet = 1;
let matchSets = {
    1: { ourScore: 0, opponentScore: 0, lineup: ["", "", "", "", "", ""], hasServe: true, historyLog: [], playerStats: {}, substitutedPlayers: new Set(), isFinished: false },
    2: { ourScore: 0, opponentScore: 0, lineup: ["", "", "", "", "", ""], hasServe: true, historyLog: [], playerStats: {}, substitutedPlayers: new Set(), isFinished: false },
    3: { ourScore: 0, opponentScore: 0, lineup: ["", "", "", "", "", ""], hasServe: true, historyLog: [], playerStats: {}, substitutedPlayers: new Set(), isFinished: false }
};

let registeredPlayers = [];
let activePlayerIndex = 0;
let isSubstituteMode = false;
let subPosIndex = null;
let matchInfo = { date: "", tournament: "", opponent: "" };
let attendanceStatus = {};
let currentSummaryType = 'total';
let matchSetWinners = {};

// 💡 恢復「其他失誤」為需選定球員的失誤項目，直接讓對方得分
const categoryDetails = {
    "發球": [
        { label: "⚪ 一般發球 (未得失分)", type: "attempt", impact: "none", reason: "發球次數", statKey: "serveAttempts" },
        { label: "🟢 發球得分 (Ace)", type: "score", impact: "our", reason: "發球得分", statKey: "serveAce" },
        { label: "🔴 發球失誤", type: "error", impact: "opponent", reason: "發球失誤", statKey: "serveError" }
    ],
    "攻擊": [
        { label: "🟢 攻擊得分", type: "score", impact: "our", reason: "攻擊得分", statKey: "attackScore" },
        { label: "🔴 攻擊失分 / 被攔", type: "error", impact: "opponent", reason: "攻擊失分", statKey: "attackError" }
    ],
    "吊球": [
        { label: "🟢 吊球得分", type: "score", impact: "our", reason: "吊球得分", statKey: "dropScore" },
        { label: "🔴 吊球失誤", type: "error", impact: "opponent", reason: "吊球失誤", statKey: "dropError" }
    ],
    "攔網": [
        { label: "🟢 攔網得分 (Block)", type: "score", impact: "our", reason: "攔網得分", statKey: "blockScore" },
        { label: "🔴 攔網失分", type: "error", impact: "opponent", reason: "攔網失分", statKey: "blockError" }
    ],
    "防守": [
        { label: "🟢 防守到位/得分", type: "score", impact: "our", reason: "防守得分", statKey: "defenseScore" },
        { label: "🔴 防守失誤 (接噴)", type: "error", impact: "opponent", reason: "防守失誤", statKey: "defenseError" }
    ],
    "其他失誤": [
        { label: "🔴 其他失誤 (球員失誤失分)", type: "error", impact: "opponent", reason: "其他失誤", statKey: "otherError" }
    ],
    "犯規": [
        { label: "⚠️ 持球犯規", type: "error", impact: "opponent", reason: "持球犯規", statKey: "foulCarry" },
        { label: "⚠️ 二次犯規", type: "error", impact: "opponent", reason: "二次犯規", statKey: "foulDoubleHit" },
        { label: "⚠️ 觸網犯規", type: "error", impact: "opponent", reason: "觸網犯規", statKey: "foulNet" },
        { label: "⚠️️ 越界犯規", type: "error", impact: "opponent", reason: "越界犯規", statKey: "foulCrossing" }
    ]
};

window.onload = function() {
    loadAllData();
    updateAllTeamSelects();
    renderTeamTable();
    renderPregameCheckboxes();
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('match-date').value = today;
};

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');
}

function saveAllData() {
    localStorage.setItem('volleyball_teams_data', JSON.stringify(teamsData));
}

function loadAllData() {
    const saved = localStorage.getItem('volleyball_teams_data');
    if (saved) {
        teamsData = JSON.parse(saved);
        const keys = Object.keys(teamsData);
        if (keys.length > 0) activeTeamName = keys[0];
    } else {
        teamsData = { "逢甲資工": JSON.parse(JSON.stringify(presetSixPlayers)) };
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

    document.getElementById('form-title').textContent = "👤 新增球員到此球隊";
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
            row.innerHTML = `<span style="background:#334155; color:white; font-weight:bold; padding:2px 8px; border-radius:6px; margin-right:8px; font-size:0.85rem;">${pNum}</span> <span style="font-weight:600;">${pName}</span> ${statusBadgeTag}`;
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

function openAttendanceModal() {
    const container = document.getElementById('attendance-list-container');
    container.innerHTML = '';

    const players = [...(teamsData[activeTeamName] || [])].sort(sortByNum);
    if (players.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#64748b;">目前球隊沒有球員，請先至大名單新增！</p>';
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
                <span style="background:#334155; color:white; font-weight:bold; padding:2px 8px; border-radius:6px; font-size:0.85rem;">${p.num}</span>
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

    document.getElementById('current-match-title').textContent = `🔥 [${matchInfo.tournament}] ${activeTeamName} v.s ${matchInfo.opponent}`;
    document.getElementById('scoreboard-opp-name').textContent = `${matchInfo.opponent} 得分`;

    closeEditMatchInfoModal();
}

// 💡 暫停記錄函式 (比分格式：我方:對方)
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

    let logText = `[${currentData.ourScore}:${currentData.opponentScore}] ⏸️ 【暫停記錄】由 【${requester}】 提出暫停 (比分 ${currentData.ourScore}:${currentData.opponentScore})`;

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

    currentSet = 1;
    for (let s = 1; s <= 3; s++) {
        let initialLineup = [p1, p2, p3, p4, p5, p6];
        matchSets[s] = {
            ourScore: 0,
            opponentScore: 0,
            lineup: initialLineup,
            hasServe: (document.getElementById('initial-serve').value === 'our'),
            historyLog: [],
            playerStats: {},
            substitutedPlayers: new Set(),
            isFinished: false
        };
        initialLineup.forEach(p => matchSets[s].substitutedPlayers.add(p));

        registeredPlayers.forEach(pName => {
            matchSets[s].playerStats[pName] = {
                serveAttempts: 0, serveAce: 0, serveError: 0,
                attackScore: 0, attackError: 0,
                dropScore: 0, dropError: 0,
                blockScore: 0, blockError: 0,
                defenseScore: 0, defenseError: 0,
                otherError: 0,
                setAttempts: 0,
                foulCarry: 0, foulDoubleHit: 0, foulNet: 0, foulCrossing: 0
            };
        });
    }

    document.getElementById('current-match-title').textContent = `🔥 [${matchInfo.tournament}] ${activeTeamName} v.s ${matchInfo.opponent}`;
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
        btn.textContent = "🔄 模式：點擊球員進行【換人】";
        btn.style.background = "#e11d48";
        btn.style.color = "white";
    } else {
        btn.textContent = "🔄 模式：點擊球員計分";
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
    document.getElementById('selected-active-player').textContent = `${currentData.lineup[index]} (P${index+1})`;
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

    currentData.historyLog.push({ team: 'info', text: `🔄 【第${currentSet}局換人】P${subPosIndex+1}: ${outgoingPlayer} 🔀 ${incomingPlayer}`, lineup: [...currentData.lineup], hasServe: currentData.hasServe });
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
    if (rotatedThisPoint) logText += " ➔ 【順時針輪轉 🔄】";

    currentData.historyLog.push({ statsApplied: statsApplied.map(k => ({ player: currentPlayer, key: k })), team: impactTeam, reason: `${category}-${reason}`, ourScore: currentData.ourScore, opponentScore: currentData.opponentScore, lineup: [...currentData.lineup], hasServe: currentData.hasServe, text: logText });
    updateUI();
    checkSetWinCondition();
}

function scorePoint(team, reason) {
    const currentData = matchSets[currentSet];
    if (currentData.isFinished) return;

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
    if (rotatedThisPoint) logText += " ➔ 【順時針輪轉 🔄】";

    currentData.historyLog.push({ team, reason, ourScore: currentData.ourScore, opponentScore: currentData.opponentScore, lineup: [...currentData.lineup], hasServe: currentData.hasServe, text: logText });
    updateUI();
    checkSetWinCondition();
}

function checkSetWinCondition() {
    const currentData = matchSets[currentSet];
    let targetScore = currentSet === 3 ? 15 : 25;
    let our = currentData.ourScore;
    let opp = currentData.opponentScore;

    if ((our >= targetScore || opp >= targetScore) && Math.abs(our - opp) >= 2) {
        currentData.isFinished = true;
        let winnerKey = our > opp ? 'our' : 'opponent';
        let winnerName = our > opp ? activeTeamName : matchInfo.opponent;
        matchSetWinners[currentSet] = winnerKey;

        document.getElementById('set-end-title').textContent = `🎉 第 ${currentSet} 局結束！`;
        document.getElementById('set-end-score').textContent = `${activeTeamName} ${our} : ${opp} ${matchInfo.opponent}`;

        let isStraightTwo = false;
        if (currentSet === 2 && matchSetWinners[1] === matchSetWinners[2]) {
            isStraightTwo = true;
        }

        if (isStraightTwo || currentSet >= 3) {
            document.getElementById('set-match-status').textContent = `本局由 【${winnerName}】 獲勝！ 🏆 全場比賽已由 【${winnerName}】 取得勝利！`;
            document.getElementById('next-set-btn').style.display = 'none';
            document.getElementById('next-set-lineup-preview').style.display = 'none';
        } else {
            document.getElementById('set-match-status').textContent = `本局由 【${winnerName}】 獲勝！準備進入下一局。`;
            document.getElementById('next-set-btn').style.display = 'block';
            document.getElementById('next-set-lineup-preview').style.display = 'block';
            populateNextSetLineupSelects();
        }

        document.getElementById('set-end-modal').style.display = 'flex';
    }
}

function populateNextSetLineupSelects() {
    const posIds = ["next-sel-p4", "next-sel-p3", "next-sel-p2", "next-sel-p5", "next-sel-p6", "next-sel-p1"];
    const currentLineup = matchSets[currentSet].lineup;

    posIds.forEach((id, idx) => {
        const select = document.getElementById(id);
        if (select) {
            let optionsHTML = '<option value="">-- 請選擇球員 --</option>';
            registeredPlayers.forEach(p => {
                let selectedAttr = (p === currentLineup[idx]) ? 'selected' : '';
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

    closeSetEndModal();
    let nextSetNum = currentSet + 1;
    if (nextSetNum <= 3) {
        const nextBtn = document.getElementById(`set-btn-${nextSetNum}`);
        nextBtn.disabled = false;
        nextBtn.style.opacity = '1';
        nextBtn.style.cursor = 'pointer';

        let newLineup = [p1, p2, p3, p4, p5, p6];
        matchSets[nextSetNum].lineup = newLineup;
        newLineup.forEach(p => matchSets[nextSetNum].substitutedPlayers.add(p));

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
        currentData.historyLog.push({ team: 'info', text: `🔄 【手動輪轉】當前發球員變更為: ${currentData.lineup[0]}`, lineup: [...currentData.lineup], hasServe: currentData.hasServe });
        updateUI();
    }
}

function resetCurrentSetWithWarning() {
    const currentData = matchSets[currentSet];
    if (confirm(`⚠️ 警告：確定要完全重設第 ${currentSet} 局的得分與所有技術紀錄嗎？此動作無法復原！`)) {
        currentData.ourScore = 0;
        currentData.opponentScore = 0;
        currentData.historyLog = [];
        currentData.isFinished = false;
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
    }
    updateUI();
}

function updateUI() {
    const currentData = matchSets[currentSet];
    document.getElementById('our-score').textContent = currentData.ourScore;
    document.getElementById('opponent-score').textContent = currentData.opponentScore;

    for (let i = 0; i < 6; i++) {
        document.getElementById(`disp-p${i+1}`).textContent = currentData.lineup[i] || '-';
        document.getElementById(`node-p${i+1}`).classList.remove('is-server');
    }
    document.getElementById('node-p1').classList.add('is-server');

    const badge = document.getElementById('serve-status-badge');
    if (currentData.hasServe) {
        badge.textContent = `發球權：我方 (${currentData.lineup[0]})`;
        badge.style.background = '#22c55e';
        badge.style.color = '#fff';
    } else {
        badge.textContent = `發球權：對手`;
        badge.style.background = '#ef4444';
        badge.style.color = '#fff';
    }

    const controlsPanel = document.getElementById('active-scoring-controls');
    const rotateBtn = document.getElementById('manual-rotate-btn');
    const resetBtn = document.getElementById('reset-set-btn');

    if (currentData.isFinished) {
        controlsPanel.style.opacity = '0.5';
        controlsPanel.style.pointerEvents = 'none';
        rotateBtn.style.opacity = '0.5';
        rotateBtn.style.pointerEvents = 'none';
    } else {
        controlsPanel.style.opacity = '1';
        controlsPanel.style.pointerEvents = 'auto';
        rotateBtn.style.opacity = '1';
        rotateBtn.style.pointerEvents = 'auto';
    }

    setActivePlayer(activePlayerIndex);
    renderLogs();
}

function renderLogs() {
    const currentData = matchSets[currentSet];
    const box = document.getElementById('log-container');
    box.innerHTML = '';
    currentData.historyLog.slice().reverse().forEach(item => {
        let div = document.createElement('div');
        div.className = 'log-item';
        div.textContent = item.text;
        if (item.team === 'our') div.style.color = '#059669';
        else if (item.team === 'opponent') div.style.color = '#e11d48';
        else div.style.color = '#475569';
        box.appendChild(div);
    });
}

function openSummaryModal(type = 'total') {
    currentSummaryType = type;
    updateSummaryModalTabs();
    generateReportHTML();
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

// 💡 報表生成：加入「其他失誤」欄位呈現
function generateReportHTML() {
    const area = document.getElementById('summary-content-area');
    area.innerHTML = '';

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

    let setLabelStr = (typeof currentSummaryType === 'number') ? `第 ${currentSummaryType} 局` : `全場總計`;
    let nextSetQuickBtn = "";
    if (typeof currentSummaryType === 'number' && currentSummaryType < 3 && matchSetWinners[currentSummaryType]) {
        nextSetQuickBtn = `<button class="btn-success" style="padding:6px 12px; font-size:0.85rem;" onclick="closeSummaryModal(); switchSet(${currentSummaryType + 1});">➡️ 進入第 ${currentSummaryType + 1} 局</button>`;
    }

    let html = `
        <div style="background:#f1f5f9; padding:10px 15px; border-radius:8px; margin-bottom:15px; font-weight:bold; font-size:0.95rem; border:1px solid #cbd5e1; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div>📅 日期：${matchInfo.date || '未填'} | 🏆 比賽：${matchInfo.tournament || '友誼賽'} | 逢甲資工 v.s ${matchInfo.opponent || '對手'} | 📌 ${setLabelStr} | 📊 比分：${setOurScore} : ${setOppScore}</div>
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
                    <tr><th colspan="2">逢甲資訊</th></tr>
                    <tr><th>得分</th><th>失誤</th></tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="font-size:1.1rem; font-weight:bold; color:#059669;">${setOurScore}</td>
                        <td style="font-size:1.1rem; font-weight:bold; color:#e11d48;">${setOppScore}</td>
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
                        <td><b>${opponentErrors.foxl || opponentErrors.foul}</b></td>
                        <td><b>${opponentErrors.other}</b></td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;

    area.innerHTML = html;
}

function closeSummaryModal() {
    document.getElementById('summary-modal').style.display = 'none';
}

function exportReportAsPDF() {
    window.print();
}

function exportReportAsImageNotification() {
    alert('💡 提示：在平板上，您可以使用內建的「螢幕截圖」功能將此報表畫面拍下來並存為照片，或點擊「匯出為 PDF」儲存檔案！');
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
    const icons = { "發球": "🏐", "攻擊": "💥", "吊球": "✨", "攔網": "🧱", "防守": "🛡️" };
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
    const strip = (label) => label.replace(/^[^\s]+\s/, '');

    Object.keys(categoryDetails).filter(c => c !== "犯規" && c !== "其他失誤").forEach(cat => {
        const btns = makeRow(`${icons[cat] || ''} ${cat}`);
        categoryDetails[cat].forEach((item, i) => btns.appendChild(makeBtn(strip(item.label), cls(item), () => recordInline(cat, i))));
    });

    // 其他失誤 與 犯規 並列
    const last = makeRow('⚠️ 失誤');
    categoryDetails["其他失誤"].forEach((item, i) => last.appendChild(makeBtn('其他失誤', cls(item), () => recordInline("其他失誤", i))));
    last.appendChild(makeBtn('犯規…', 'is-foul', () => openDetailModal('犯規')));
}
renderScoringGroups();