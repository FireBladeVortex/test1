// =============================================
//  Google Apps Script — GitHub 중계 서버
//  action=submit  : 값 저장
//  트리거1        : 1분마다 mergeFiles() 실행
//  트리거2        : 1일마다 dailyCleanup() 실행 (현재 잠금)
// =============================================

const GITHUB_TOKEN  = '토큰';
const GITHUB_OWNER  = 'FireBladeVortex';
const GITHUB_REPO   = 'test1';
const GITHUB_BRANCH = 'main';

const DIR_SUBMISSIONS  = 'submissions';
const DIR_BASE_DATA    = 'base_data';

// 카테고리별 마지막 통합 파일명을 기록하는 JSON 파일
// 내용: {"a":"2026-06-01_120000.json","b":"","c":"2026-05-30_090000.json"}
const FILE_LAST_TIME = DIR_BASE_DATA + '/add_data_last_time.json';

// [임계값] submissions/ 파일이 이 수를 넘으면 dailyCleanup이 삭제를 실행
const DELETE_THRESHOLD = 30;

// pad1 값 → total 파일 접미사 매핑
// 가 → total_value_a.json
// 나 → total_value_b.json
// 다 → total_value_c.json
const PAD1_MAP = { '가': 'a', '나': 'b', '다': 'c' };

// ── 라우터 ────────────────────────────────────
// GET 요청을 action 파라미터 값에 따라 각 처리 함수로 분기한다
function doGet(e) {
	var action = e.parameter.action;
	if (action === 'submit') return handleSubmit(e);
	return respond({ status: 'error', where: '[라우터] 알 수 없는 action', received: action });
}

// ── 1. 값 저장 ────────────────────────────────────────────────────────────
// 폼에서 전송된 항목 배열을 1개의 JSON 파일로 submissions/ 에 저장한다
// data 파라미터: JSON.stringify([ {pad1,title,name,pad3,pad4}, ... ])
function handleSubmit(e) {
	var raw = e.parameter.data;
	if (!raw) {
		return respond({ status: 'error', where: '[submit-1] data 파라미터 없음' });
	}

	var items;
	try {
		items = JSON.parse(raw);
		// 단일 객체로 왔을 경우 배열로 통일
		if (!Array.isArray(items)) items = [items];
	} catch (err) {
		return respond({ status: 'error', where: '[submit-2] data JSON 파싱 실패', message: err.message });
	}

	if (items.length === 0) {
		return respond({ status: 'error', where: '[submit-3] 항목이 비어있음' });
	}

	// 각 항목에 timestamp 추가 및 pad1 유효성 확인
	var now = new Date().toISOString();
	for (var i = 0; i < items.length; i++) {
		if (!PAD1_MAP[items[i].pad1]) {
			return respond({ status: 'error', where: '[submit-4] 알 수 없는 pad1 값', index: i, received: items[i].pad1 });
		}
		items[i].timestamp = now;
	}

	// 항목 배열 전체를 1개 파일에 저장
	var filename, content;
	try {
		filename = buildFilename();
		// 줄바꿈 적용으로 가독성 향상
		content  = JSON.stringify(items, null, 2);
	} catch (err) {
		return respond({ status: 'error', where: '[submit-5] 파일 내용 생성 실패', message: err.message });
	}

	try {
		githubPut(DIR_SUBMISSIONS + '/' + filename, content, 'submit: ' + filename + ' (' + items.length + '건)');
	} catch (err) {
		return respond({ status: 'error', where: '[submit-6] GitHub 저장 실패', message: err.message });
	}

	return respond({ status: 'ok', filename: filename, count: items.length });
}

// ── 2. 통합 (1분마다 트리거로 자동 실행) ──────────────────────────────────
// submissions/ 의 미처리 파일을 카테고리별로 분류해 total_value 파일에 누적하고
// add_data_last_time.json 을 카테고리별 최신 파일명으로 갱신한다
// 모든 쓰기를 commitMultipleFiles() 로 묶어 commit 1개만 생성한다
function mergeFiles() {
	// submissions/ 폴더가 없으면 (정기 삭제 후) 즉시 종료
	var files;
	try {
		files = listDir(DIR_SUBMISSIONS);
	} catch (err) {
		Logger.log('[merge-1] submissions 목록 조회 실패: ' + err.message);
		return;
	}

	// 비어있으면 불필요한 commit 없이 종료
	if (files.length === 0) {
		Logger.log('[merge] submissions 비어있음 또는 폴더 없음 — 스킵');
		return;
	}

	// add_data_last_time.json 읽기 (없으면 모든 카테고리 빈 문자열로 초기화)
	var lastTimes = { 'a': '', 'b': '', 'c': '' };
	try {
		var ltRaw = githubGet(FILE_LAST_TIME);
		var ltParsed = JSON.parse(ltRaw);
		if (ltParsed.a !== undefined) lastTimes.a = ltParsed.a;
		if (ltParsed.b !== undefined) lastTimes.b = ltParsed.b;
		if (ltParsed.c !== undefined) lastTimes.c = ltParsed.c;
	} catch (e) {}

	// 전체 카테고리 중 가장 오래된 lastTime 기준으로 파일 필터링
	// (어느 카테고리든 미처리 데이터가 있을 수 있는 파일을 포함)
	var minLastTime = Object.keys(lastTimes).reduce(function(min, k) {
		var t = lastTimes[k] || '';
		return (!min || t < min) ? t : min;
	}, '');

	var targets = files.filter(function(f) { return f.name > minLastTime; });

	if (targets.length === 0) {
		Logger.log('[merge] 처리할 신규 파일 없음 — 스킵');
		return;
	}

	// 파일 내용 읽기 + 카테고리별로 그룹 분류
	// 각 카테고리마다 해당 카테고리의 lastTime 보다 최신인 파일 항목만 포함
	var groups       = {};
	var newestPerKey = { 'a': lastTimes['a'], 'b': lastTimes['b'], 'c': lastTimes['c'] };

	for (var i = 0; i < targets.length; i++) {
		try {
			var raw     = githubGet(targets[i].path);
			var parsed  = JSON.parse(raw);
			var entries = Array.isArray(parsed) ? parsed : [parsed];

			for (var j = 0; j < entries.length; j++) {
				var obj = entries[j];
				var key = PAD1_MAP[obj.pad1];
				if (!key) {
					Logger.log('[merge-2] 알 수 없는 pad1: ' + obj.pad1);
					continue;
				}
				// 해당 카테고리의 lastTime 보다 최신인 파일 항목만 처리
				if (targets[i].name <= (lastTimes[key] || '')) continue;

				if (!groups[key]) groups[key] = [];
				groups[key].push(obj);
			}

			// 각 카테고리별로 처리된 가장 최신 파일명 추적
			var fileKey;
			for (fileKey in newestPerKey) {
				if (targets[i].name > newestPerKey[fileKey]) {
					newestPerKey[fileKey] = targets[i].name;
				}
			}
		} catch (err) {
			Logger.log('[merge-2] 파일 읽기 실패: ' + targets[i].name + ' / ' + err.message);
		}
	}

	// 변경할 파일 목록 수집 → commitMultipleFiles() 에 한 번에 전달
	var changedFiles = [];
	var keys = Object.keys(groups);

	for (var g = 0; g < keys.length; g++) {
		var key      = keys[g];
		var records  = groups[key];
		var filePath = DIR_BASE_DATA + '/total_value_' + key + '.json';

		// timestamp 제외 (add_data_last_time.json 에서 카테고리별 갱신 시간 관리)
		var newBlocks = records.map(function(o) {
			return '{\n'
				+ '    "title": ' + JSON.stringify(o.title) + ',\n'
				+ '    "name": '  + JSON.stringify(o.name)  + ',\n'
				+ '    "pad3": '  + JSON.stringify(o.pad3)  + ',\n'
				+ '    "pad4": '  + JSON.stringify(o.pad4)  + '\n'
				+ '}';
		}).join('\n');

		var existing = '';
		try { existing = githubGet(filePath); } catch (e) {}

		changedFiles.push({
			path:    filePath,
			content: newBlocks + (existing ? '\n' + existing : '')
		});
	}

	// add_data_last_time.json 갱신 내용 추가
	// 갱신된 카테고리의 최신 파일명을 기록
	var updatedLastTimes = {
		a: newestPerKey['a'] || lastTimes['a'],
		b: newestPerKey['b'] || lastTimes['b'],
		c: newestPerKey['c'] || lastTimes['c']
	};
	changedFiles.push({
		path:    FILE_LAST_TIME,
		content: JSON.stringify(updatedLastTimes, null, 2)
	});

	// Trees API 로 모든 파일을 commit 1개로 저장
	try {
		var totalCount = targets.reduce(function(sum, f) {
			return sum + Object.keys(groups).reduce(function(s, k) {
				return s + (groups[k] ? groups[k].length : 0);
			}, 0);
		}, 0);
		commitMultipleFiles(changedFiles, 'merge: ' + targets.length + '개 파일 처리');
		Logger.log('[merge] 완료: ' + targets.length + '개 파일 처리');
	} catch (err) {
		Logger.log('[merge-3] commitMultipleFiles 실패: ' + err.message);
	}
}

/* submissions 삭제하는 기능 시작 부분 + 일시 잠금 */

// ── 3. 정기 삭제 (1일마다 트리거로 자동 실행) ─────────────────────────────
// submissions/ 파일이 임계값 초과이고
// add_data_last_time 이 최신화된 상태라면
// submissions/ 폴더를 1개의 commit 으로 일괄 삭제한다
/*
function dailyCleanup() {
	var files;
	try {
		files = listDir(DIR_SUBMISSIONS);
	} catch (err) {
		Logger.log('[cleanup-1] submissions 목록 조회 실패: ' + err.message);
		return;
	}

	if (files.length === 0) {
		Logger.log('[cleanup] submissions 없음 — 스킵');
		return;
	}

	if (files.length <= DELETE_THRESHOLD) {
		Logger.log('[cleanup] 파일 수 ' + files.length + '개, 임계값 미만 — 스킵');
		return;
	}

	var lastTimes = { 'a': '', 'b': '', 'c': '' };
	try {
		var ltRaw    = githubGet(FILE_LAST_TIME);
		var ltParsed = JSON.parse(ltRaw);
		if (ltParsed.a !== undefined) lastTimes.a = ltParsed.a;
		if (ltParsed.b !== undefined) lastTimes.b = ltParsed.b;
		if (ltParsed.c !== undefined) lastTimes.c = ltParsed.c;
	} catch (e) {
		Logger.log('[cleanup-2] add_data_last_time 읽기 실패 — 스킵');
		return;
	}

	// 가장 오래된 카테고리 lastTime 조회
	var minLastTime = Object.keys(lastTimes).reduce(function(min, k) {
		var t = lastTimes[k] || '';
		return (!min || t < min) ? t : min;
	}, '');

	// submissions/ 에서 가장 최신 파일명 확인
	var filenames = files.map(function(f) { return f.name; }).sort();
	var newestInSubmissions = filenames[filenames.length - 1];

	// 모든 카테고리 기준으로 가장 최신 파일까지 통합됐는지 확인
	if (newestInSubmissions > minLastTime) {
		Logger.log('[cleanup] 미통합 파일 존재 (' + newestInSubmissions + ') — 스킵');
		return;
	}

	try {
		deleteDirectoryByTree(DIR_SUBMISSIONS, 'cleanup: delete submissions/ (' + files.length + ' files)');
		Logger.log('[cleanup] submissions/ 삭제 완료 (' + files.length + '개)');
	} catch (err) {
		Logger.log('[cleanup-3] 삭제 실패: ' + err.message);
	}
}

// ── Git Trees API: 폴더 일괄 삭제 ────────────────────────────────────────
// 지정 폴더를 제외한 새 트리를 만들고 commit 1개로 삭제를 기록한다
function deleteDirectoryByTree(dir, commitMessage) {
	var branchRes  = UrlFetchApp.fetch(
		'https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/branches/' + GITHUB_BRANCH,
		reqOpt('get', null)
	);
	var branchData = JSON.parse(branchRes.getContentText());
	var commitSha  = branchData.commit.sha;
	var treeSha    = branchData.commit.commit.tree.sha;

	var treeRes  = UrlFetchApp.fetch(
		'https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/git/trees/' + treeSha + '?recursive=1',
		reqOpt('get', null)
	);
	var treeData = JSON.parse(treeRes.getContentText());

	var newTree = treeData.tree
		.filter(function(item) {
			return item.type === 'blob' && item.path.indexOf(dir + '/') !== 0;
		})
		.map(function(item) {
			return { path: item.path, mode: item.mode, type: item.type, sha: item.sha };
		});

	var newTreeRes = UrlFetchApp.fetch(
		'https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/git/trees',
		reqOpt('post', { tree: newTree })
	);
	var newTreeSha = JSON.parse(newTreeRes.getContentText()).sha;

	var newCommitRes = UrlFetchApp.fetch(
		'https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/git/commits',
		reqOpt('post', { message: commitMessage, tree: newTreeSha, parents: [commitSha] })
	);
	var newCommitSha = JSON.parse(newCommitRes.getContentText()).sha;

	UrlFetchApp.fetch(
		'https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/git/refs/heads/' + GITHUB_BRANCH,
		reqOpt('patch', { sha: newCommitSha })
	);
}
*/

/* submissions 삭제하는 기능 마지막 부분 + 일시 잠금 */

// ── Git Trees API: 여러 파일을 commit 1개로 저장 ──────────────────────────
// files: [{path, content}, ...] 형태의 배열
// base_tree 를 사용하므로 지정하지 않은 파일은 그대로 유지된다
function commitMultipleFiles(files, commitMessage) {
	var branchRes  = UrlFetchApp.fetch(
		'https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/branches/' + GITHUB_BRANCH,
		reqOpt('get', null)
	);
	var branchData = JSON.parse(branchRes.getContentText());
	var commitSha  = branchData.commit.sha;
	var treeSha    = branchData.commit.commit.tree.sha;

	var treeEntries = files.map(function(f) {
		return { path: f.path, mode: '100644', type: 'blob', content: f.content };
	});

	var newTreeRes = UrlFetchApp.fetch(
		'https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/git/trees',
		reqOpt('post', { base_tree: treeSha, tree: treeEntries })
	);
	var newTreeSha = JSON.parse(newTreeRes.getContentText()).sha;

	var newCommitRes = UrlFetchApp.fetch(
		'https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/git/commits',
		reqOpt('post', { message: commitMessage, tree: newTreeSha, parents: [commitSha] })
	);
	var newCommitSha = JSON.parse(newCommitRes.getContentText()).sha;

	var updateRes  = UrlFetchApp.fetch(
		'https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/git/refs/heads/' + GITHUB_BRANCH,
		reqOpt('patch', { sha: newCommitSha })
	);
	var updateCode = updateRes.getResponseCode();
	if (updateCode !== 200) {
		throw new Error('[commitMultipleFiles] ref 업데이트 실패 HTTP ' + updateCode);
	}
}

// ── GitHub API 헬퍼 ───────────────────────────

// 지정 경로에 파일을 생성하거나 덮어쓴다
function githubPut(path, content, message, sha) {
	// UTF_8 명시로 한글 깨짐 방지
	var encoded = Utilities.base64Encode(content, Utilities.Charset.UTF_8);
	var payload = { message: message, content: encoded, branch: GITHUB_BRANCH };
	if (sha) payload.sha = sha;
	var res  = UrlFetchApp.fetch(apiUrl(path), reqOpt('put', payload));
	var code = res.getResponseCode();
	if (code !== 200 && code !== 201) {
		throw new Error('HTTP ' + code + ' / ' + res.getContentText());
	}
}

// 지정 경로의 파일 내용을 문자열로 읽어 반환한다
function githubGet(path) {
	var res  = UrlFetchApp.fetch(apiUrl(path), reqOpt('get', null));
	var code = res.getResponseCode();
	if (code !== 200) throw new Error('HTTP ' + code);
	var data    = JSON.parse(res.getContentText());
	var decoded = Utilities.base64Decode(data.content.replace(/\n/g, ''));
	// UTF_8 명시로 한글 깨짐 방지
	return Utilities.newBlob(decoded).getDataAsString('UTF-8');
}

// 지정 폴더 안의 파일 목록을 반환한다 (폴더 없으면 빈 배열)
function listDir(dir) {
	var url  = 'https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/contents/' + dir + '?ref=' + GITHUB_BRANCH;
	var res  = UrlFetchApp.fetch(url, reqOpt('get', null));
	var code = res.getResponseCode();
	if (code === 404) return [];
	if (code !== 200) throw new Error('HTTP ' + code);
	var list = JSON.parse(res.getContentText());
	return list.filter(function(f) { return f.type === 'file'; });
}

// GitHub REST API URL 을 생성한다
function apiUrl(path) {
	return 'https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/contents/' + path;
}

// GitHub API 요청 옵션 객체를 생성한다
function reqOpt(method, payload) {
	var opt = {
		method:  method,
		headers: {
			'Authorization': 'Bearer ' + GITHUB_TOKEN,
			'Content-Type':  'application/json',
			'Accept':        'application/vnd.github+json'
		},
		muteHttpExceptions: true
	};
	if (payload) opt.payload = JSON.stringify(payload);
	return opt;
}

// doGet의 응답을 JSON 형식으로 반환한다
function respond(obj) {
	return ContentService
		.createTextOutput(JSON.stringify(obj))
		.setMimeType(ContentService.MimeType.JSON);
}

// 현재 시각을 기반으로 submissions 파일명을 생성한다 (YYYY-MM-DD_HHmmss.json)
function buildFilename() {
	var now = new Date();
	var pad = function(n) { return String(n).padStart(2, '0'); };
	return now.getFullYear() + '-' + pad(now.getMonth()+1) + '-' + pad(now.getDate())
		+ '_' + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds()) + '.json';
}
