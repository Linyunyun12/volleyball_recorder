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
    1: { ourScore: 0, opponentScore: 0, lineup: ["", "", "", "", "", ""], hasServe: true, historyLog: [], playerStats: {} },
    2: { ourScore: 0, opponentScore: 0, lineup: ["", "", "", "", "", ""], hasServe: true, historyLog: [], playerStats: {} },
    3: { ourScore: 0, opponentScore: 0, lineup: ["", "", "", "", "", ""], hasServe: true, historyLog: [], playerStats: {} }
};

let registeredPlayers = [];
let activePlayerIndex = 0;
let isSubstituteMode = false;
let subPosIndex = null;
let matchInfo = { date: "", tournament: "", opponent: "" };
let attendanceStatus = {};

const categoryDetails = {
    "發球": [
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
    "接發": [
        { label: "🔴 接發球失誤", type: "error", impact: "opponent", reason: "接發球失誤", statKey: "receiveServeError" }
    ],
    "接扣": [
        { label: "🔴 接扣失誤", type: "error", impact: "opponent", reason: "接扣失誤", statKey: "receiveAttackError" }
    ],
    "接吊": [
        { label: "🔴 接吊失誤", type: "error", impact: "opponent", reason: "接吊失誤", statKey: "receiveDropError" }
    ],
    "二三傳": [
        { label: "🔴 二三傳噴 (失誤)", type: "error", impact: "opponent", reason: "二三傳失誤", statKey: "setPassError" }
    ],
    "犯規": [
        { label: "⚠️ 二傳犯規", type: "error", impact: "opponent", reason: "二傳犯規", statKey: "foulDouble" },
        { label: "⚠️ 持球犯規", type: "error", impact: "opponent", reason: "持球犯規", statKey: "foulCarry" },
        { label: "⚠️ 二次犯規", type: "error", impact: "opponent", reason: "二次犯規", statKey: "foulDoubleHit" },
        { label: "⚠️ 觸網犯規", type: "error", impact: "opponent", reason: "觸網犯規", statKey: "foulNet" },
        { label: "⚠️ 越界犯規", type: "error", impact: "opponent", reason: "越界犯規", statKey: "foulCrossing" }
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

function renderTeamTable() {
    activeTeamName = document.getElementById('manage-team-select').value;
    const tbody = document.getElementById('team-table-body');
    tbody.innerHTML = '';

    const players = teamsData[activeTeamName] || [];
    document.getElementById('team-player-count').textContent = players.length;

    players.forEach((p, idx) => {
        let tr = document.createElement('tr');
        let posStr = (p.pos && p.pos.length > 0) ? p.pos.join(', ') : '未填';
        tr.innerHTML = `
            <td><b>${p.num}</b></td>
            <td>${p.name}</td>
            <td>${posStr}</td>
            <td>
                <button class="btn-warning" style="padding:4px 8px; font-size:0.8rem; margin-right:5px;" onclick="editPlayer(${idx})">修改</button>
                <button class="btn-danger" style="padding:4px 8px; font-size:0.8rem;" onclick="removePlayer(${idx})">刪除</button>
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
    checkboxes.forEach(cb => cb.checked = false);
}

function editPlayer(idx) {
    const player = teamsData[activeTeamName][idx];
    document.getElementById('p-num').value = player.num;
    document.getElementById('p-name').value = player.name;
    document.getElementById('edit-index').value = idx;

    const checkboxes = document.querySelectorAll('input[name="p-pos"]');
    checkboxes.forEach(cb => { cb.checked = player.pos.includes(cb.value); });

    document.getElementById('form-title').textContent = `修改球員資訊 (${player.num} ${player.name})`;
    document.getElementById('save-player-btn').textContent = "儲存修改";
    document.getElementById('cancel-edit-btn').style.display = "block";
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEdit() {
    document.getElementById('edit-index').value = "-1";
    document.getElementById('p-num').value = '';
    document.getElementById('p-name').value = '';
    document.querySelectorAll('input[name="p-pos"]').forEach(cb => cb.checked = false);

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

// 渲染檢錄卡片（帶有狀態圖示與禁選防呆，無 # 符號）
function renderPregameCheckboxes() {
    const container = document.getElementById('roster-cards-container');
    container.innerHTML = '';

    const players = teamsData[activeTeamName] || [];
    players.forEach((p, idx) => {
        let card = document.createElement('div');
        let pKey = `${p.num} ${p.name}`;
        let status = attendanceStatus[pKey] || "可出賽";

        let isChecked = idx < 12 && status !== "請假" && status !== "傷病";
        let isDisabled = status === "請假" || status === "傷病";

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
            <div class="roster-card-info" style="width:100%;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="roster-card-num">${p.num} ${p.name}</span>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </div>
                <span class="roster-card-name">${posStr}</span>
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

// 控制檢錄名單預覽展開與清單條列
function toggleRosterSummary() {
    const dropdown = document.getElementById('roster-summary-dropdown');
    if (dropdown.style.display === 'none' || dropdown.style.display === '') {
        dropdown.style.display = 'block';
    } else {
        dropdown.style.display = 'none';
    }
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
        registeredPlayers.forEach((pStr, idx) => {
            let row = document.createElement('div');
            row.style.cssText = "display: flex; align-items: center; padding: 4px 8px; background: #f8fafc; border-radius: 4px; border-left: 3px solid #2563eb;";
            row.innerHTML = `<span style="font-weight: bold; margin-right: 8px; color: #2563eb;">${idx+1}</span> <span>${pStr}</span>`;
            listContainer.appendChild(row);
        });
    }

    updateLineupSelects(registeredPlayers);
}

function updateLineupSelects(activePlayers) {
    const posIds = ["sel-p4", "sel-p3", "sel-p2", "sel-p5", "sel-p6", "sel-p1"];
    posIds.forEach((id, idx) => {
        const select = document.getElementById(id);
        if (select) {
            select.innerHTML = activePlayers.length > 0
                ? activePlayers.map((p, pIdx) => `<option value="${p}" ${pIdx === idx ? 'selected' : ''}>${p}</option>`).join('')
                : '<option value="-">請先勾選球員</option>';
        }
    });
}

function openAttendanceModal() {
    const container = document.getElementById('attendance-list-container');
    container.innerHTML = '';

    const players = teamsData[activeTeamName] || [];
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
            <span style="font-weight:bold; color:#1e293b;">${p.num} ${p.name}</span>
            <select id="att-${p.num}-${p.name}" style="width:140px; padding:6px; font-size:0.9rem;" onchange="attendanceStatus['${pKey}'] = this.value">
                <option value="可出賽" ${attendanceStatus[pKey] === '可出賽' ? 'selected' : ''}>🟢 可出賽</option>
                <option value="晚到" ${attendanceStatus[pKey] === '晚到' ? 'selected' : ''}>🟡 晚到</option>
                <option value="請假" ${attendanceStatus[pKey] === '請假' ? 'selected' : ''}>🔴 請假</option>
                <option value="傷病" ${attendanceStatus[pKey] === '傷病' ? 'selected' : ''}>🏥 傷病</option>
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

function startMatch() {
    const checkedBoxes = document.querySelectorAll('#roster-cards-container input[type="checkbox"]:checked');
    if (checkedBoxes.length < 6) { alert('先發陣容需要至少勾選 6 位登錄球員！'); return; }

    const p1 = document.getElementById('sel-p1').value;
    const p2 = document.getElementById('sel-p2').value;
    const p3 = document.getElementById('sel-p3').value;
    const p4 = document.getElementById('sel-p4').value;
    const p5 = document.getElementById('sel-p5').value;
    const p6 = document.getElementById('sel-p6').value;

    if ([p1, p2, p3, p4, p5, p6].some(p => !p || p === '-' || p === '請先勾選球員')) {
        alert('先發 6 人的場上位置（P1 ~ P6）尚未指派完整！');
        return;
    }

    matchInfo.date = document.getElementById('match-date').value || "未填日期";
    matchInfo.tournament = document.getElementById('match-tournament').value.trim() || "友誼賽";
    matchInfo.opponent = document.getElementById('opponent-team-name').value.trim() || "對手";

    currentSet = 1;
    for (let s = 1; s <= 3; s++) {
        matchSets[s] = {
            ourScore: 0,
            opponentScore: 0,
            lineup: [p1, p2, p3, p4, p5, p6],
            hasServe: (document.getElementById('initial-serve').value === 'our'),
            historyLog: [],
            playerStats: {}
        };
        registeredPlayers.forEach(pName => {
            matchSets[s].playerStats[pName] = {
                serveAttempts: 0, serveAce: 0, serveError: 0,
                attackAttempts: 0, attackScore: 0, attackError: 0,
                dropAttempts: 0, dropScore: 0, dropError: 0,
                receiveServeError: 0, receiveAttackError: 0, receiveDropError: 0,
                setPassError: 0,
                foulDouble: 0, foulCarry: 0, foulDoubleHit: 0, foulNet: 0, foulCrossing: 0
            };
        });
    }

    document.getElementById('current-match-title').textContent = `🔥 [${matchInfo.tournament}] ${activeTeamName} v.s ${matchInfo.opponent}`;
    document.getElementById('scoreboard-our-name').textContent = `${activeTeamName} 得分`;
    document.getElementById('scoreboard-opp-name').textContent = `${matchInfo.opponent} 得分`;
    document.getElementById('print-header-info').textContent = `日期：${matchInfo.date} | 盃賽：${matchInfo.tournament} | ${activeTeamName} v.s ${matchInfo.opponent}`;

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
    isSubstituteMode = !isSubstituteMode;
    const btn = document.getElementById('sub-mode-btn');
    if (isSubstituteMode) {
        btn.textContent = "🔄 模式：點擊球員進行【換人】";
        btn.style.background = "#dc2626";
        btn.style.color = "white";
    } else {
        btn.textContent = "🔄 模式：點擊球員計分";
        btn.style.background = "#d97706";
        btn.style.color = "white";
    }
}

function handleCourtCardClick(posIdx) {
    if (isSubstituteMode) openSubstituteModal(posIdx);
    else setActivePlayer(posIdx);
}

function setActivePlayer(index) {
    activePlayerIndex = index;
    const currentData = matchSets[currentSet];
    for (let i = 0; i < 6; i++) {
        let node = document.getElementById(`node-p${i+1}`);
        if (i === index) {
            node.style.border = "3px solid #2563eb";
            node.style.boxShadow = "0 0 10px rgba(37, 99, 235, 0.6)";
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
            let opt = document.createElement('option');
            opt.value = p;
            opt.textContent = p;
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

    currentData.historyLog.push({ team: 'info', text: `🔄 【第${currentSet}局換人】P${subPosIndex+1}: ${outgoingPlayer} 🔀 ${incomingPlayer}`, lineup: [...currentData.lineup], hasServe: currentData.hasServe });
    closeSubstituteModal();
    toggleSubstituteMode();
    updateUI();
    setActivePlayer(subPosIndex);
}

function openDetailModal(category) {
    const currentData = matchSets[currentSet];
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
        btn.className = item.impact === 'our' ? 'btn-success' : 'btn-danger';
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
    const currentPlayer = currentData.lineup[activePlayerIndex];
    let rotatedThisPoint = false;

    if (currentData.playerStats[currentPlayer]) {
        if (statKey) {
            currentData.playerStats[currentPlayer][statKey]++;
            if (category === '發球') currentData.playerStats[currentPlayer].serveAttempts++;
            if (category === '攻擊') currentData.playerStats[currentPlayer].attackAttempts++;
            if (category === '吊球') currentData.playerStats[currentPlayer].dropAttempts++;
        }
    }

    if (impactTeam === 'our') {
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

    let logText = `[${currentData.ourScore}:${currentData.opponentScore}] ${impactTeam === 'our' ? '🟢 我方得分' : '🔴 對手得分'} - [${currentPlayer}] ${category}：${reason}`;
    if (rotatedThisPoint) logText += " ➔ 【順時針輪轉 🔄】";

    currentData.historyLog.push({ team: impactTeam, reason: `${category}-${reason}`, ourScore: currentData.ourScore, opponentScore: currentData.opponentScore, lineup: [...currentData.lineup], hasServe: currentData.hasServe, text: logText });
    updateUI();
    checkSetWinCondition();
}

function scorePoint(team, reason) {
    const currentData = matchSets[currentSet];
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
        let winner = our > opp ? activeTeamName : matchInfo.opponent;
        document.getElementById('set-end-title').textContent = `🎉 第 ${currentSet} 局結束！`;
        document.getElementById('set-end-score').textContent = `${activeTeamName} ${our} : ${opp} ${matchInfo.opponent}`;
        document.getElementById('set-match-status').textContent = `本局由 【${winner}】 獲勝！`;

        if (currentSet >= 3) {
            document.getElementById('next-set-btn').style.display = 'none';
            document.getElementById('set-match-status').textContent += ` 🏆 全場比賽結束！`;
        } else {
            document.getElementById('next-set-btn').style.display = 'block';
        }

        document.getElementById('set-end-modal').style.display = 'flex';
    }
}

function closeSetEndModal() {
    document.getElementById('set-end-modal').style.display = 'none';
}

function proceedToNextSet() {
    closeSetEndModal();
    if (currentSet < 3) {
        switchSet(currentSet + 1);
    }
}

function manualRotate() {
    const currentData = matchSets[currentSet];
    rotateLineup();
    currentData.historyLog.push({ team: 'info', text: `🔄 【手動輪轉】當前發球員變更為: ${currentData.lineup[0]}`, lineup: [...currentData.lineup], hasServe: currentData.hasServe });
    updateUI();
}

function rotateLineup() {
    const currentData = matchSets[currentSet];
    const first = currentData.lineup.shift();
    currentData.lineup.push(first);
    setActivePlayer(0);
}

function undoLast() {
    const currentData = matchSets[currentSet];
    if (currentData.historyLog.length === 0) return;
    currentData.historyLog.pop();
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

function resetCurrentSet() {
    if (confirm(`確定要重設第 ${currentSet} 局的得分與紀錄嗎？`)) {
        const currentData = matchSets[currentSet];
        currentData.ourScore = 0;
        currentData.opponentScore = 0;
        currentData.historyLog = [];
        updateUI();
    }
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
        if (item.team === 'our') div.style.color = '#16a34a';
        if (item.team === 'opponent') div.style.color = '#dc2626';
        box.appendChild(div);
    });
}

function openSummaryModal() {
    const area = document.getElementById('summary-content-area');
    area.innerHTML = '';

    let totalStats = {};
    registeredPlayers.forEach(pName => {
        totalStats[pName] = {
            serveAttempts: 0, serveAce: 0, serveError: 0,
            attackAttempts: 0, attackScore: 0, attackError: 0,
            dropAttempts: 0, dropScore: 0, dropError: 0,
            receiveServeError: 0, receiveAttackError: 0, receiveDropError: 0,
            setPassError: 0,
            foulDouble: 0, foulCarry: 0, foulDoubleHit: 0, foulNet: 0, foulCrossing: 0
        };
    });

    for (let s = 1; s <= 3; s++) {
        let pStats = matchSets[s].playerStats;
        for (let pName in pStats) {
            if (!totalStats[pName]) continue;
            for (let key in pStats[pName]) {
                totalStats[pName][key] += pStats[pName][key];
            }
        }
    }

    let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; background:#f1f5f9; padding:10px 15px; border-radius:8px; margin-bottom:15px; font-weight:bold; font-size:0.95rem;">
            <div>📅 日期：${matchInfo.date}</div>
            <div>🏆 比賽：${matchInfo.tournament}</div>
            <div>⚔️ 對戰：${activeTeamName} v.s ${matchInfo.opponent}</div>
        </div>
        <div style="overflow-x:auto;">
            <table class="paper-matrix-table">
                <thead>
                    <tr>
                        <th rowspan="2">號碼</th>
                        <th rowspan="2">球員姓名</th>
                        <th colspan="3">發球</th>
                        <th colspan="3">攻擊</th>
                        <th colspan="3">吊球</th>
                        <th colspan="2">接發</th>
                        <th colspan="2">接扣</th>
                        <th colspan="2">接吊</th>
                        <th rowspan="2">二傳</th>
                        <th colspan="4">犯規</th>
                    </tr>
                    <tr>
                        <th>次</th><th>得</th><th>失</th>
                        <th>次</th><th>得</th><th>失</th>
                        <th>次</th><th>得</th><th>失</th>
                        <th>次</th><th>失</th>
                        <th>次</th><th>失</th>
                        <th>次</th><th>失</th>
                        <th>持球</th><th>二次</th><th>觸網</th><th>越界</th>
                    </tr>
                </thead>
                <tbody>
    `;

    registeredPlayers.forEach(pName => {
        let st = totalStats[pName];
        let parts = pName.split(' ');
        let num = parts[0] || '';
        let name = parts.slice(1).join(' ') || pName;

        html += `
            <tr>
                <td><b>${num}</b></td>
                <td style="text-align:left; padding-left:6px;">${name}</td>
                <td>${st.serveAttempts}</td><td>${st.serveAce}</td><td>${st.serveError}</td>
                <td>${st.attackAttempts}</td><td>${st.attackScore}</td><td>${st.attackError}</td>
                <td>${st.dropAttempts}</td><td>${st.dropScore}</td><td>${st.dropError}</td>
                <td>-</td><td>${st.receiveServeError}</td>
                <td>-</td><td>${st.receiveAttackError}</td>
                <td>-</td><td>${st.receiveDropError}</td>
                <td>${st.setPassError}</td>
                <td>${st.foulCarry}</td><td>${st.foulDoubleHit}</td><td>${st.foulNet}</td><td>${st.foulCrossing}</td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>
    `;

    let totalOurScore = matchSets[1].ourScore + matchSets[2].ourScore + matchSets[3].ourScore;
    let totalOppScore = matchSets[1].opponentScore + matchSets[2].opponentScore + matchSets[3].opponentScore;

    html += `
        <div style="display:grid; grid-template-columns: 1fr 1.5fr; gap:15px; margin-top:20px;">
            <table class="paper-matrix-table">
                <thead>
                    <tr><th colspan="2">${activeTeamName}</th></tr>
                    <tr><th>得分</th><th>失誤</th></tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="font-size:1.2rem; font-weight:bold; color:#16a34a;">${totalOurScore}</td>
                        <td style="font-size:1.2rem; font-weight:bold; color:#dc2626;">${totalOppScore}</td>
                    </tr>
                </tbody>
            </table>

            <table class="paper-matrix-table">
                <thead>
                    <tr><th colspan="4">${matchInfo.opponent}失誤統計</th></tr>
                    <tr><th>發球失誤</th><th>二、三傳噴</th><th>攻擊失誤</th><th>犯規</th></tr>
                </thead>
                <tbody>
                    <tr>
                        <td>-</td><td>-</td><td>-</td><td>-</td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;

    area.innerHTML = html;
    document.getElementById('summary-modal').style.display = 'flex';
}

function closeSummaryModal() {
    document.getElementById('summary-modal').style.display = 'none';
}

function exportTeamsData() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(teamsData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    const dateObj = new Date();
    const dateStr = `${dateObj.getFullYear()}${String(dateObj.getMonth()+1).padStart(2,'0')}${String(dateObj.getDate()).padStart(2,'0')}`;
    downloadAnchor.setAttribute("download", `volleyball_teams_${dateStr}.json`);
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