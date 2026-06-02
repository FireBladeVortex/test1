// ── 송신 ─────────────────────────────────
	// pad5 목록이 있으면 목록 전체를 1개 JSON으로 송신 후 목록 초기화
	// pad5 목록이 비어있으면 현재 pad1~4 값을 단일 항목으로 송신
	// 🔗 HTML연결: HTML의 onclick="send()"에서 호출, 함수명 바꾸면 HTML도 수정
	async function send() {
		if (sending) return;

		// 송신 대상 결정
		let items;
		if (savedList.length > 0) {
			// 목록 전체 송신
			items = savedList.slice();
		} else {
			// 현재 pad1~4 단일 송신 (기존 동작)
			if (!validate()) return;
			items = [snapshot()];
		}

		sending = true;
		const btn = document.getElementById('sendBtn'); // 🔗 연결: 'sendBtn' → HTML id="sendBtn"과 연결
		btn.classList.add('sending'); // 🔗 연결: 'sending' → CSS .btn-send.sending과 연결
		setStatus('');

		const fetchPromise = doFetch(items);
		const dots = ['.', '..', '...'];
		for (const d of dots) {
			btn.textContent = '전송 중' + d;
			await sleep(500);
		}

		const result = await fetchPromise;

		btn.textContent = '송신';
		btn.classList.remove('sending'); // 🔗 연결: 'sending' → CSS .btn-send.sending과 연결
		sending = false;

		if (result.ok) {
			// 목록 송신이었으면 목록 초기화
			if (savedList.length > 0 || result.fromList) {
				savedList.length = 0;
				editingIdx = null;
				setSaveMode('저장');
				renderList();
			}
			setStatus('저장완료 (' + result.count + '건)', 'success'); // 🔗 연결: 'success' → CSS .status.success와 연결
		} else {
			setStatus('오류: ' + result.message, 'error'); // 🔗 연결: 'error' → CSS .status.error와 연결
		}
	}

	// items: 송신할 항목 배열 (1개 또는 여러 개)
	// 배열 전체를 1개의 JSON 파일로 Apps Script에 전달한다
	async function doFetch(items) {
		try {
			const url  = APPS_SCRIPT_URL + '?action=submit&data=' + encodeURIComponent(JSON.stringify(items));
			const res  = await fetch(url);
			const data = await res.json();
			return data.status === 'ok'
				? { ok: true, count: data.count, fromList: items.length > 1 }
				: { ok: false, message: (data.where || '') + ' ' + (data.message || '') };
		} catch (e) {
			return { ok: false, message: e.message };
		}
	}

	// 🔗 JS연결: setStatus → send() / validate() / resetAll()에서 호출
	//            type 값 'success'/'error' → CSS .status.success / .status.error와 연결
	function setStatus(msg, type) {
		const el = document.getElementById('status'); // 🔗 연결: 'status' → HTML id="status"와 연결
		el.textContent = msg;
		el.className   = 'status' + (type ? ' ' + type : ''); // 🔗 연결: 'status' → CSS .status / type → CSS .status.success 또는 .status.error
	}
