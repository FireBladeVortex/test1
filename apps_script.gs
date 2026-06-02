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
// 진행 순서:
//   1) submissions/ 파일을 카테고리별로 total_value에 누적 (통합)
//   2) add_data_last_time.json 갱신 (최신화 기록)
//   3) 새 데이터가 추가된 카테고리만 title→name 순 정렬 시도
//   4) 정렬을 시도한 카테고리만 중복(title+name+pad3+pad4 4개 모두 동일) 제거
//   5) submissions/ 내 .json 파일 전체 삭제
//   모든 파일 변경을 commitMultipleFiles()로 묶어 commit 1개만 생성한다
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
		var ltRaw    = githubGet(FILE_LAST_TIME);
		var ltParsed = JSON.parse(ltRaw);
		if (ltParsed.a !== undefined) lastTimes.a = ltParsed.a;
		if (ltParsed.b !== undefined) lastTimes.b = ltParsed.b;
		if (ltParsed.c !== undefined) lastTimes.c = ltParsed.c;
	} catch (e) {}

	// 전체 카테고리 중 가장 오래된 lastTime 기준으로 파일 필터링
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
				if (targets[i].name <= (lastTimes[key] || '')) continue;

				if (!groups[key]) groups[key] = [];
				groups[key].push(obj);
			}

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

	// 변경할 파일 목록 수집
	var changedFiles = [];
	// 새 데이터가 추가된 카테고리 목록 (정렬/중복제거 대상)
	var updatedKeys  = Object.keys(groups);

	// ── 단계 1~2: 통합 + 최신화 기록 준비 ──────────────────────────────────
	// 카테고리별로 기존 파일에 신규 레코드를 앞에 추가해 changedFiles에 쌓는다
	for (var g = 0; g < updatedKeys.length; g++) {
		var key      = updatedKeys[g];
		var records  = groups[key];
		var filePath = DIR_BASE_DATA + '/total_value_' + key + '.json';

		// 신규 레코드 블록 (timestamp 제외)
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
			// 신규 데이터를 앞에 붙여 누적; 이후 단계에서 정렬/중복제거로 덮어씀
			content: newBlocks + (existing ? '\n' + existing : ''),
			// 정렬/중복제거 단계에서 해당 인덱스를 찾기 위한 식별자
			key:     key
		});
	}

	// add_data_last_time.json 갱신 내용 추가
	var updatedLastTimes = {
		a: newestPerKey['a'] || lastTimes['a'],
		b: newestPerKey['b'] || lastTimes['b'],
		c: newestPerKey['c'] || lastTimes['c']
	};
	changedFiles.push({
		path:    FILE_LAST_TIME,
		content: JSON.stringify(updatedLastTimes, null, 2)
	});

	// ── 단계 3~4: 새 데이터가 추가된 카테고리만 정렬 + 중복제거 ────────────
	// 목적: total_value 파일을 title→name 오름차순으로 유지하고
	//       4개 필드(title, name, pad3, pad4)가 모두 동일한 중복 항목을 제거한다
	for (var h = 0; h < changedFiles.length; h++) {
		var cf = changedFiles[h];
		// key 필드가 없는 항목(add_data_last_time.json 등)은 건너뜀
		if (!cf.key) continue;

		// 원시 텍스트를 JSON 객체 배열로 파싱
		// total_value 파일은 JSON 배열이 아닌 객체를 줄바꿈으로 연결한 형식이므로
		// 각 객체를 분리해서 파싱한 뒤 배열로 다룬다
		var rawContent = cf.content;
		var items      = parseNdjsonLike(rawContent);

		if (items.length === 0) continue;

		// 정렬: title 오름차순 → title 동일 시 name 오름차순 (한글/영문 모두 localeCompare 적용)
		items.sort(function(a, b) {
			var titleCmp = String(a.title || '').localeCompare(String(b.title || ''), 'ko');
			if (titleCmp !== 0) return titleCmp;
			return String(a.name || '').localeCompare(String(b.name || ''), 'ko');
		});

		// 중복제거: title + name + pad3 + pad4 4개가 모두 동일한 항목 중 첫 번째만 유지
		var seen   = {};
		var unique = [];
		for (var u = 0; u < items.length; u++) {
			// 4개 필드를 직렬화해 고유 키 생성
			var dedupKey = JSON.stringify(items[u].title)
				+ '|' + JSON.stringify(items[u].name)
				+ '|' + JSON.stringify(items[u].pad3)
				+ '|' + JSON.stringify(items[u].pad4);
			if (!seen[dedupKey]) {
				seen[dedupKey] = true;
				unique.push(items[u]);
			}
		}

		// 정렬/중복제거 결과를 기존 형식(줄바꿈 연결 객체)으로 재직렬화해 덮어씀
		cf.content = unique.map(function(o) {
			return '{\n'
				+ '    "title": ' + JSON.stringify(o.title) + ',\n'
				+ '    "name": '  + JSON.stringify(o.name)  + ',\n'
				+ '    "pad3": '  + JSON.stringify(o.pad3)  + ',\n'
				+ '    "pad4": '  + JSON.stringify(o.pad4)  + '\n'
				+ '}';
		}).join('\n');
	}

	// ── 단계 5: submissions/ 내 .json 파일 전체 삭제 준비 ──────────────────
	// 목적: 처리 완료된 submissions 파일을 같은 commit에서 일괄 삭제해
	//       다음 트리거 실행 시 중복 처리를 방지한다
	// deleteEntries는 Trees API에서 sha=null로 전달해 삭제를 표현한다
	var deleteEntries = files
		.filter(function(f) { return f.name.slice(-5) === '.json'; })
		.map(function(f) {
			return { path: f.path, mode: '100644', type: 'blob', sha: null };
		});

	// key 필드 제거 후 Trees API 형식으로 정리
	var treeFiles = changedFiles.map(function(cf) {
		return { path: cf.path, content: cf.content };
	});

	// Trees API로 모든 변경(통합+최신화+정렬+중복제거+submissions 삭제)을 commit 1개로 저장
	try {
		commitMultipleFilesWithDeletes(treeFiles, deleteEntries,
			'merge: ' + targets.length + '개 파일 처리 / 정렬+중복제거+submissions 삭제');
		Logger.log('[merge] 완료: ' + targets.length + '개 파일 처리');
	} catch (err) {
		Logger.log('[merge-3] commitMultipleFilesWithDeletes 실패: ' + err.message);
	}
}

// ── 헬퍼: total_value 파일의 원시 텍스트를 객체 배열로 파싱 ─────────────────
// total_value 파일은 JSON 배열([ ])이 아닌
// { ... }\n{ ... } 형태로 객체가 줄바꿈으로 이어진 형식이다
// 중괄호 깊이를 추적해 각 최상위 객체 경계를 찾아 JSON.parse로 변환한다
function parseNdjsonLike(text) {
	var result = [];
	var depth  = 0;
	var start  = -1;

	for (var i = 0; i < text.length; i++) {
		var ch = text[i];
		if (ch === '{') {
			if (depth === 0) start = i;
			depth++;
		} else if (ch === '}') {
			depth--;
			if (depth === 0 && start !== -1) {
				try {
					result.push(JSON.parse(text.slice(start, i + 1)));
				} catch (e) {
					Logger.log('[parseNdjsonLike] 파싱 실패: ' + e.message);
				}
				start = -1;
			}
		}
	}
	return result;
}

/* submissions 삭제하는 기능 시작 부분 + 일시 잠금 */

// ── 3. 정기 삭제 (1일마다 트리거로 자동 실행) ─────────────────────────────
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
		Logger.log('[cleanup-2] add_data_last_time.json 읽기 실패 — 스킵');
		return;
	}

	var minLastTime = Object.keys(lastTimes).reduce(function(min, k) {
		var t = lastTimes[k] || '';
		return (!min || t < min) ? t : min;
	}, '');

	var filenames = files.map(function(f) { return f.name; }).sort();
	var newestInSubmissions = filenames[filenames.length - 1];

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

// ── Git Trees API: 파일 저장 + 삭제(sha=null)를 commit 1개로 처리 ──────────
// files:   [{path, content}, ...] — 생성/덮어쓰기 대상
// deletes: [{path, mode, type, sha:null}, ...] — 삭제 대상 (sha=null이 삭제를 의미)
// base_tree를 사용하므로 지정하지 않은 파일은 그대로 유지된다
function commitMultipleFilesWithDeletes(files, deletes, commitMessage) {
	var branchRes  = UrlFetchApp.fetch(
		'https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/branches/' + GITHUB_BRANCH,
		reqOpt('get', null)
	);
	var branchData = JSON.parse(branchRes.getContentText());
	var commitSha  = branchData.commit.sha;
	var treeSha    = branchData.commit.commit.tree.sha;

	// 저장 항목: content로 blob 생성
	var treeEntries = files.map(function(f) {
		return { path: f.path, mode: '100644', type: 'blob', content: f.content };
	});

	// 삭제 항목: sha=null을 전달하면 GitHub Trees API가 해당 경로를 트리에서 제거한다
	for (var d = 0; d < deletes.length; d++) {
		treeEntries.push(deletes[d]);
	}

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
		throw new Error('[commitMultipleFilesWithDeletes] ref 업데이트 실패 HTTP ' + updateCode);
	}
}

// ── GitHub API 헬퍼 ───────────────────────────

// 지정 경로에 파일을 생성하거나 덮어쓴다
function githubPut(path, content, message, sha) {
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
