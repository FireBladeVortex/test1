<!-- ⛔ 표준: script 태그, 변경 불가 -->
	// 🔗 JS연결: APPS_SCRIPT_URL → doFetch()에서 사용, Apps Script 배포 URL 입력 필요
	const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxJ-D2MksgHr7vbLaWl72EXIKVwNR5A--QwmHMBmJf_1fGSoXgiL4FIJYOa9w_iPRXr/exec';

	// 🔗 JS연결: state → selectPad1 / selectGrid / resetGrid / resetAll / validate / doFetch 전체에서 사용
	//            키 이름 pad1, pad3, pad4는 HTML id값과 일치해야 markError/clearError가 정상 작동
	const state = {
		pad1: null,
		pad3: [null, null, null],
		pad4: [null, null, null],
	};

	// 🔗 JS연결: sending → send() 내부에서 중복 클릭 방지용, send()와 짝을 이룸
	let sending = false;

	const sleep = ms => new Promise(r => setTimeout(r, ms));

	// ── 패드1: 단일 선택 ─────────────────────
	// 🔗 HTML연결: HTML의 onclick="selectPad1(...)"에서 호출, 함수명 바꾸면 HTML도 수정
	function selectPad1(btn, val) {
		document.querySelectorAll('#pad1 .sel-btn').forEach(b => b.classList.remove('on')); // 🔗 연결: '#pad1'→id / '.sel-btn'→class / 'on'→CSS .sel-btn.on
		btn.classList.add('on');
		state.pad1 = val;
		clearError('pad1'); // 🔗 연결: 'pad1' → HTML id="pad1"과 연결
	}

	// ── 패드3, 4: 행당 최대 1개 ──────────────
	// 🔗 HTML연결: HTML의 onclick="selectGrid(...)"에서 호출, 함수명 바꾸면 HTML도 수정
	function selectGrid(padId, row, col, btn) {
		const rows = document.querySelectorAll('#' + padId + 'Rows .grid-row'); // 🔗 연결: padId+'Rows'→id / '.grid-row'→class
		rows[row].querySelectorAll('.sel-btn').forEach(b => b.classList.remove('on')); // 🔗 연결: '.sel-btn'→class / 'on'→CSS
		if (state[padId][row] === col) {
			state[padId][row] = null;
		} else {
			btn.classList.add('on'); // 🔗 연결: 'on' → CSS .sel-btn.on과 연결
			state[padId][row] = col;
		}
		clearError(padId); // 🔗 연결: padId → HTML id="pad3" / id="pad4"와 연결
	}

	// ── 개별 초기화 ───────────────────────────
	// 🔗 HTML연결: HTML의 onclick="resetGrid(...)"에서 호출, 함수명 바꾸면 HTML도 수정
	function resetGrid(padId) {
		document.querySelectorAll('#' + padId + 'Rows .sel-btn').forEach(b => b.classList.remove('on')); // 🔗 연결: padId+'Rows'→id / '.sel-btn'→class / 'on'→CSS
		state[padId] = [null, null, null];
	}

	// 🔗 HTML연결: HTML의 onclick="clearInput(...)"에서 호출, 함수명 바꾸면 HTML도 수정
	function clearInput(id) {
		document.getElementById(id).value = ''; // 🔗 연결: id → HTML id="titleInput" / id="nameInput"과 연결
	}

	// ── 전체 초기화 ───────────────────────────
	// 🔗 HTML연결: HTML의 onclick="resetAll()"에서 호출, 함수명 바꾸면 HTML도 수정
	function resetAll() {
		document.querySelectorAll('#pad1 .sel-btn').forEach(b => b.classList.remove('on'));
		state.pad1 = null;
		clearInput('titleInput');
		clearInput('nameInput');
		resetGrid('pad3');
		resetGrid('pad4');
		['pad1','pad2','pad3','pad4'].forEach(clearError);
		setStatus('');
		// 수정 모드 해제
		if (editingIdx !== null) {
			editingIdx = null;
			setSaveMode('저장');
			renderList();
		}
		setSaveStatus('');
	}

	// ── 임시 저장 목록 ──────────────────────
	// savedList: 휘발성 임시 저장 배열 (새로고침 시 초기화), 최대 10개
	const savedList = [];   // 🔗 JS연결: renderList / save / loadItem / editItem에서 공유
	const MAX_LIST   = 10;  // [목록 최대 개수] 변경 시 P5 카운터 표시도 자동 반영
	let   editingIdx = null; // 현재 수정 중인 인덱스 (null = 저장 모드)

	// 현재 패드 입력값 스냅샷을 반환한다
	function snapshot() {
		return {
			pad1:  state.pad1,
			title: document.getElementById('titleInput').value.trim(),
			name:  document.getElementById('nameInput').value.trim(),
			pad3:  [...state.pad3],
			pad4:  [...state.pad4],
		};
	}

	// 두 스냅샷이 완전히 동일한지 비교한다
	function isSame(a, b) {
		return a.pad1  === b.pad1
			&& a.title === b.title
			&& a.name  === b.name
			&& JSON.stringify(a.pad3) === JSON.stringify(b.pad3)
			&& JSON.stringify(a.pad4) === JSON.stringify(b.pad4);
	}

	// pad5 목록을 다시 그린다
	function renderList() {
		const list  = document.getElementById('pad5List');
		const count = document.getElementById('p5Count');
		list.innerHTML = '';
		count.textContent = '(' + savedList.length + '/' + MAX_LIST + ')';

		savedList.forEach(function(item, idx) {
			const el = document.createElement('div');
			el.className   = 'p5-item' + (idx === editingIdx ? ' active' : '');
			el.textContent = '[' + (idx + 1) + '번 ' + item.pad1 + '-' + item.title + '-' + item.name + ']';
			el.onclick     = function() { loadItem(idx); };
			list.appendChild(el);
		});
	}

	// 목록의 항목을 패드 1~4에 불러온다 (수정 모드 진입)
	function loadItem(idx) {
		// 같은 항목 재클릭 시 수정 모드 해제
		if (editingIdx === idx) {
			editingIdx = null;
			setSaveMode('저장');
			renderList();
			return;
		}

		const item = savedList[idx];
		editingIdx = idx;

		// pad1 복원
		document.querySelectorAll('#pad1 .sel-btn').forEach(b => b.classList.remove('on'));
		document.querySelectorAll('#pad1 .sel-btn').forEach(b => {
			if (b.textContent === item.pad1) b.classList.add('on');
		});
		state.pad1 = item.pad1;

		// pad2 복원
		document.getElementById('titleInput').value = item.title;
		document.getElementById('nameInput').value  = item.name;

		// pad3 복원
		resetGrid('pad3');
		item.pad3.forEach(function(col, row) {
			if (col === null) return;
			const rows = document.querySelectorAll('#pad3Rows .grid-row');
			const btn  = rows[row].querySelectorAll('.sel-btn')[col];
			btn.classList.add('on');
			state.pad3[row] = col;
		});

		// pad4 복원
		resetGrid('pad4');
		item.pad4.forEach(function(col, row) {
			if (col === null) return;
			const rows = document.querySelectorAll('#pad4Rows .grid-row');
			const btn  = rows[row].querySelectorAll('.sel-btn')[col];
			btn.classList.add('on');
			state.pad4[row] = col;
		});

		setSaveMode('수정');
		setSaveStatus('');
		renderList();
	}

	// 저장 버튼 텍스트와 스타일을 변경한다
	function setSaveMode(mode) {
		const btn = document.getElementById('saveBtn');
		btn.textContent = mode;
		btn.classList.remove('btn-edit', 'btn-error');
		if (mode === '수정') btn.classList.add('btn-edit');
	}

	// 저장 상태 메시지를 표시한다
	function setSaveStatus(msg, type) {
		const el   = document.getElementById('saveStatus');
		el.textContent = msg;
		el.className   = 'save-status' + (type ? ' ' + type : '');
	}

	// ── 저장 / 수정 ──────────────────────────
	// 🔗 HTML연결: HTML의 onclick="save()"에서 호출, 함수명 바꾸면 HTML도 수정
	function save() {
		if (!validate()) return;

		const snap = snapshot();
		const btn  = document.getElementById('saveBtn');

		// ── 수정 모드 ─────────────────────────
		if (editingIdx !== null) {
			// 다른 항목과 중복 검사 (현재 편집 중인 항목 제외)
			const dup = savedList.some(function(item, idx) {
				return idx !== editingIdx && isSame(item, snap);
			});
			if (dup) {
				btn.classList.add('btn-error');
				setSaveStatus('저장 실패 = 같은 내용이 이미 있습니다', 'error');
				return;
			}
			savedList[editingIdx] = snap;
			editingIdx = null;
			setSaveMode('저장');
			setSaveStatus('');
			renderList();
			return;
		}

		// ── 저장 모드 ─────────────────────────
		if (savedList.length >= MAX_LIST) {
			btn.classList.add('btn-error');
			setSaveStatus('저장 실패 = 목록이 가득 찼습니다 (최대 ' + MAX_LIST + '개)', 'error');
			return;
		}

		// 중복 검사
		const dup = savedList.some(function(item) { return isSame(item, snap); });
		if (dup) {
			btn.classList.add('btn-error');
			setSaveStatus('저장 실패 = 같은 내용이 이미 있습니다', 'error');
			return;
		}

		savedList.push(snap);
		btn.classList.remove('btn-error');
		setSaveStatus('');
		renderList();
	}

	// ── 유효성 검사 ───────────────────────────
	function validate() {
		const errors = [];

		if (!state.pad1) errors.push('pad1'); // 🔗 연결: 'pad1' → HTML id="pad1" / markError와 연결

		const title = document.getElementById('titleInput').value.trim(); // 🔗 연결: 'titleInput' → HTML id="titleInput"
		const name  = document.getElementById('nameInput').value.trim();  // 🔗 연결: 'nameInput'  → HTML id="nameInput"
		if (!title && !name) errors.push('pad2'); // 🔗 연결: 'pad2' → HTML id="pad2" / markError와 연결

		const p3Empty = state.pad3.every(v => v === null);
		if (p3Empty) errors.push('pad3'); // 🔗 연결: 'pad3' → HTML id="pad3" / markError와 연결

		const p4Empty = state.pad4.every(v => v === null);
		if (p4Empty) errors.push('pad4'); // 🔗 연결: 'pad4' → HTML id="pad4" / markError와 연결

		if (errors.length > 0) {
			errors.forEach(id => markError(id));
			setStatus('입력되지 않은 패드가 있습니다', 'error'); // 🔗 연결: 'error' → CSS .status.error와 연결
			return false;
		}
		return true;
	}

	function markError(padId) {
		const el = document.getElementById(padId);
		el.classList.add('error'); // 🔗 연결: 'error' → CSS .pad.error와 연결
		setTimeout(() => el.classList.remove('error'), 10000);
	}

	function clearError(padId) {
		document.getElementById(padId).classList.remove('error'); // 🔗 연결: 'error' → CSS .pad.error와 연결
	}
