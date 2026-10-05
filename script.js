// 預設 6 人球隊名單（球員 1~6）
const presetSixPlayers = [
    { num: "1", name: "球員1", pos: [] },
    { num: "2", name: "球員2", pos: [] },
    { num: "3", name: "球員3", pos: [] },
    { num: "4", name: "球員4", pos: [] },
    { num: "5", name: "球員5", pos: [] },
    { num: "6", name: "球員6", pos: [] }
];

let teamsData = { "預設球隊": JSON.parse(JSON.stringify(presetSixPlayers)) };
let activeTeamName = "預設球隊";

let lineup = ["", "", "", "", "", ""];
let registeredPlayers = [];
let activePlayerIndex = 0;
let isSubstituteMode = false;
let subPosIndex = null;

// 定義各主分類底下的細分選項（對應得分、失誤或犯規項目）

// 📤 匯出所有球隊資料為 JSON 檔案
function exportTeamsData() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(teamsData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);

    // 檔名自動帶入當下日期時間
    const dateObj = new Date();
    const dateStr = `${dateObj.getFullYear()}${String(dateObj.getMonth()+1).padStart(2,'0')}${String(dateObj.getDate()).padStart(2,'0')}`;
    downloadAnchor.setAttribute("download", `volleyball_teams_${dateStr}.json`);

    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

// 📥 匯入球隊資料檔案 (從平板讀取)
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

                    // 【關鍵修正】匯入成功後，必須手動觸發這三個更新畫面與選單的函式！
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

const categoryDetails = {
    "發球": [
        { label: "🟢 發球得分 (Ace)", type: "score", impact: "our", reason: "發球得分" },
        { label: "🔴 發球失誤", type: "error", impact: "opponent", reason: "發球失誤" }
    ],
    "攻擊": [
        { label: "🟢 攻擊得分", type: "score", impact: "our", reason: "攻擊得分" },
        { label: "🔴 攻擊失分 / 被攔", type: "error", impact: "opponent", reason: "攻擊失分" }
    ],
    "吊球": [
        { label: "🟢 吊球得分", type: "score", impact: "our", reason: "吊球得分" },
        { label: "🔴 吊球失誤", type: "error", impact: "opponent", reason: "吊球失誤" }
    ],
    "接發": [
        { label: "🔴 接發球失誤 (崩盤/直接失分)", type: "error", impact: "opponent", reason: "接發球失誤" }
    ],
    "接扣": [
        { label: "🔴 接扣失誤", type: "error", impact: "opponent", reason: "接扣失誤" }
    ],
    "接吊": [
        { label: "🔴 接吊失誤", type: "error", impact: "opponent", reason: "接吊失誤" }
    ],
    "二三傳": [
        { label: "🔴 二三傳噴 (失誤)", type: "error", impact: "opponent", reason: "二三傳失誤" }
    ],
    "犯規": [
        { label: "⚠️ 二傳犯規", type: "error", impact: "opponent", reason: "二傳犯規" },
        { label: "⚠️ 持球犯規", type: "error", impact: "opponent", reason: "持球犯規" },
        { label: "⚠️ 二次犯規", type: "error", impact: "opponent", reason: "二次犯規" },
        { label: "⚠️ 觸網犯規", type: "error", impact: "opponent", reason: "觸網犯規" },
        { label: "⚠️ 越界犯規", type: "error", impact: "opponent", reason: "越界犯規" }
    ]
};

let matchInfo = { date: "", tournament: "", opponent: "" };
let ourScore = 0;
let opponentScore = 0;
let historyLog = [];
let hasServe = true;

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
        teamsData = { "我的球隊": [] };
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
    activeTeamName = document.getElementById('active-team-select').value;
    document.getElementById('manage-team-select').value = activeTeamName;
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
            <td><b>#${p.num}</b></td>
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
    checkboxes.forEach(cb => {
        cb.checked = player.pos.includes(cb.value);
    });

    document.getElementById('form-title').textContent = `修改球員資訊 (#${player.num} ${player.name})`;
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

// 渲染賽前方格化登錄球員清單（點擊整張卡片切換選中狀態）
function renderPregameCheckboxes() {
    const container = document.getElementById('roster-cards-container');
    container.innerHTML = '';

    const players = teamsData[activeTeamName] || [];
    players.forEach((p, idx) => {
        let card = document.createElement('div');
        let isChecked = idx < 12; // 預設前 12 人選中
        card.className = `roster-select-card ${isChecked ? 'selected' : ''}`;
        card.id = `roster-card-${idx}`;

        let posStr = (p.pos && p.pos.length > 0) ? `(${p.pos.join('/')})` : '';
        card.innerHTML = `
            <input type="checkbox" id="chk-${idx}" value="#${p.num} ${p.name}" ${isChecked ? 'checked' : ''} onchange="handleRosterCardChange(${idx})">
            <div class="roster-card-info">
                <span class="roster-card-num">#${p.num} ${p.name}</span>
                <span class="roster-card-name">${posStr}</span>
            </div>
        `;

        // 點擊卡片即可切換勾選與邊框狀態
        card.onclick = function(e) {
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

    if (chk.checked) {
        card.classList.add('selected');
    } else {
        card.classList.remove('selected');
    }
    updateSelectedCount();
}

function updateSelectedCount() {
    const checkedBoxes = document.querySelectorAll('#roster-cards-container input[type="checkbox"]:checked');
    document.getElementById('selected-count').textContent = checkedBoxes.length;

    registeredPlayers = Array.from(checkedBoxes).map(cb => cb.value);
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

function startMatch() {
    const checkedBoxes = document.querySelectorAll('#roster-cards-container input[type="checkbox"]:checked');
    if (checkedBoxes.length < 6) {
        alert('先發陣容需要至少勾選 6 位登錄球員！');
        return;
    }

    // 抓取 6 宮格站位上的選單數值
    const p1 = document.getElementById('sel-p1').value;
    const p2 = document.getElementById('sel-p2').value;
    const p3 = document.getElementById('sel-p3').value;
    const p4 = document.getElementById('sel-p4').value;
    const p5 = document.getElementById('sel-p5').value;
    const p6 = document.getElementById('sel-p6').value;

    // 檢查是否有任何一個位置是空值或未指定
    const currentLineup = [p1, p2, p3, p4, p5, p6];
    if (currentLineup.some(p => !p || p === '-' || p === '請先勾選球員')) {
        alert('先發 6 人的場上位置（P1 ~ P6）尚未指派完整，請確認每個格子都有選擇球員！');
        return;
    }

    // 儲存賽前表頭資訊
    matchInfo.date = document.getElementById('match-date').value || "未填日期";
    matchInfo.tournament = document.getElementById('match-tournament').value.trim() || "友誼賽";
    matchInfo.opponent = document.getElementById('opponent-team-name').value.trim() || "對手";

    lineup[0] = p1;
    lineup[1] = p2;
    lineup[2] = p3;
    lineup[3] = p4;
    lineup[4] = p5;
    lineup[5] = p6;

    hasServe = (document.getElementById('initial-serve').value === 'our');
    ourScore = 0;
    opponentScore = 0;
    historyLog = [];
    isSubstituteMode = false;

    // 更新介面上的隊與表頭
    document.getElementById('current-match-title').textContent = `🔥 [${matchInfo.tournament}] ${activeTeamName} v.s ${matchInfo.opponent}`;
    document.getElementById('scoreboard-our-name').textContent = `${activeTeamName} 得分`;
    document.getElementById('scoreboard-opp-name').textContent = `${matchInfo.opponent} 得分`;
    document.getElementById('print-header-info').textContent = `日期：${matchInfo.date} | 盃賽：${matchInfo.tournament} | ${activeTeamName} v.s ${matchInfo.opponent}`;

    addLog(`🏁 比賽開始！${matchInfo.tournament}：${activeTeamName} v.s ${matchInfo.opponent}，先發陣容已確認。`, "info");

    document.getElementById('pregame-section').style.display = 'none';
    document.getElementById('in-game-section').style.display = 'block';

    setActivePlayer(0);
    updateUI();
}

function backToPregame() {
    if (confirm('回到檢錄頁面將會中斷目前的比賽計分，確定嗎？')) {
        document.getElementById('in-game-section').style.display = 'none';
        document.getElementById('pregame-section').style.display = 'block';
    }
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
    if (isSubstituteMode) {
        openSubstituteModal(posIdx);
    } else {
        setActivePlayer(posIdx);
    }
}

function setActivePlayer(index) {
    activePlayerIndex = index;
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
    document.getElementById('selected-active-player').textContent = `${lineup[index]} (P${index+1})`;
}

// 開啟細分項目彈窗
function openDetailModal(category) {
    const currentPlayer = lineup[activePlayerIndex];
    if (!currentPlayer || currentPlayer === '-') {
        alert('請先在上方點擊選擇一位場上球員！');
        return;
    }

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
            recordDetailedEvent(item.impact, category, item.reason);
            closeDetailModal();
        };
        container.appendChild(btn);
    });

    modal.style.display = 'flex';
}

function closeDetailModal() {
    document.getElementById('detail-modal').style.display = 'none';
}

// 紀錄細分事件
function recordDetailedEvent(impactTeam, category, reason) {
    const currentPlayer = lineup[activePlayerIndex];
    let rotatedThisPoint = false;

    if (impactTeam === 'our') {
        ourScore++;
        if (!hasServe) {
            rotateLineup();
            hasServe = true;
            rotatedThisPoint = true;
        }
    } else {
        opponentScore++;
        hasServe = false;
    }

    let logText = `[${ourScore}:${opponentScore}] ${impactTeam === 'our' ? '🟢 我方得分' : '🔴 對手得分'} - [${currentPlayer}] ${category}：${reason} (當前發球: ${lineup[0]})`;
    if (rotatedThisPoint) logText += " ➔ 【順時針輪轉 🔄】";

    historyLog.push({ team: impactTeam, reason: `${category}-${reason}`, ourScore, opponentScore, lineup: [...lineup], hasServe, text: logText });
    updateUI();
}

function openSubstituteModal(posIdx) {
    subPosIndex = posIdx;
    const modal = document.getElementById('sub-modal');
    const desc = document.getElementById('sub-modal-desc');
    const select = document.getElementById('sub-target-select');

    desc.textContent = `將 P${posIdx+1} 目前的球員 (${lineup[posIdx]}) 換下場：`;
    select.innerHTML = '';

    let availableBench = registeredPlayers.filter(p => !lineup.includes(p));
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
    if (incomingPlayer === '-' || !incomingPlayer) {
        alert('請選擇有效的替換球員！');
        return;
    }

    const outgoingPlayer = lineup[subPosIndex];
    lineup[subPosIndex] = incomingPlayer;

    addLog(`🔄 【換人】P${subPosIndex+1} 換人：${outgoingPlayer} 🔀 換上 ${incomingPlayer}`, "info");
    closeSubstituteModal();
    toggleSubstituteMode();
    updateUI();
    setActivePlayer(subPosIndex);
}

function scorePoint(team, reason) {
    let rotatedThisPoint = false;
    if (team === 'our') {
        ourScore++;
        if (!hasServe) {
            rotateLineup();
            hasServe = true;
            rotatedThisPoint = true;
        }
    } else {
        opponentScore++;
        hasServe = false;
    }

    let logText = `[${ourScore}:${opponentScore}] 🟢 我方得分 - ${reason} (對方失誤送分) (當前發球: ${lineup[0]})`;
    if (rotatedThisPoint) logText += " ➔ 【順時針輪轉 🔄】";

    historyLog.push({ team, reason, ourScore, opponentScore, lineup: [...lineup], hasServe, text: logText });
    updateUI();
}

function manualRotate() {
    rotateLineup();
    historyLog.push({ team: 'info', text: `🔄 【手動輪轉】當前發球員變更為: ${lineup[0]}`, lineup: [...lineup], hasServe });
    updateUI();
}

function rotateLineup() {
    const first = lineup.shift();
    lineup.push(first);
    setActivePlayer(0);
}

function undoLast() {
    if (historyLog.length === 0) return;
    historyLog.pop();
    if (historyLog.length > 0) {
        const prev = historyLog[historyLog.length - 1];
        ourScore = prev.ourScore;
        opponentScore = prev.opponentScore;
        lineup = [...prev.lineup];
        hasServe = prev.hasServe;
    } else {
        ourScore = 0;
        opponentScore = 0;
    }
    updateUI();
}

function resetMatch() {
    if (confirm('確定要重新開始本場比賽嗎？')) startMatch();
}

function updateUI() {
    document.getElementById('our-score').textContent = ourScore;
    document.getElementById('opponent-score').textContent = opponentScore;

    for (let i = 0; i < 6; i++) {
        document.getElementById(`disp-p${i+1}`).textContent = lineup[i];
        document.getElementById(`node-p${i+1}`).classList.remove('is-server');
    }
    document.getElementById('node-p1').classList.add('is-server');

    const badge = document.getElementById('serve-status-badge');
    if (hasServe) {
        badge.textContent = `發球權：我方 (${lineup[0]})`;
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

function addLog(text, type) {
    historyLog.push({ team: type, text, lineup: [...lineup], hasServe, ourScore, opponentScore });
    renderLogs();
}

function renderLogs() {
    const box = document.getElementById('log-container');
    box.innerHTML = '';
    historyLog.slice().reverse().forEach(item => {
        let div = document.createElement('div');
        div.className = 'log-item';
        div.textContent = item.text;
        if (item.team === 'our') div.style.color = '#16a34a';
        if (item.team === 'opponent') div.style.color = '#dc2626';
        box.appendChild(div);
    });
}