// 참조
// https://developers.google.com/youtube/iframe_api_reference?hl=ko
// // ── YouTube IFrame Player API 비동기 로드 ──
const tag = document.createElement('script')
tag.src = "https://www.youtube.com/iframe_api"
document.head.appendChild(tag)

// ── YouTube URL → ID 추출 ──
// be/와 ? 사이의 문자열만 반환, 이미 ID면 그대로 반환
const ytId = v => (v.includes('/') ? v.split('/').pop().split('?')[0] : v)

// ── 전역 상태 ──
let player       = null   // YT.Player 인스턴스
let loopTimer    = null   // 구간 감시 인터벌
let activeSlot   = -1     // 현재 선택된 슬롯 인덱스
let currentVideo = null   // 현재 재생 중인 VIDEOS 항목

// ── 버튼 그리드 생성 ──
// 목적: VIDEOS 배열 전체를 순서대로 160×90 썸네일 버튼으로 렌더링
// 로직: 15개 제한 없이 VIDEOS.length만큼 반복
//       flex-wrap 컨테이너가 공간에 맞게 자동 줄바꿈 처리
function buildGrid() {
	const grid = document.getElementById('grid')
	grid.innerHTML = ''

	for (let i = 0; i < VIDEOS.length; i++) {
		const entry = VIDEOS[i]
		const btn = document.createElement('button')
		btn.className = 'slot-btn'
		btn.dataset.index = i

			const img = document.createElement('img')
			img.src = `https://img.youtube.com/vi/${ytId(entry.video)}/mqdefault.jpg`
			img.alt = `슬롯 ${i + 1}`

			// 썸네일 로드 실패 시 숫자로 폴백
			img.onerror = () => {
				img.remove()
				const num = document.createElement('span')
				num.className = 'slot-num'
				num.textContent = i + 1
				btn.appendChild(num)
			}

			btn.appendChild(img)

			// 슬롯 번호 오버레이 (썸네일 위)
			const lbl = document.createElement('span')
			lbl.className = 'slot-label'
			lbl.textContent = i + 1
			btn.appendChild(lbl)

			// 클릭 이벤트: 해당 슬롯 영상 재생
			// btn.addEventListener('click', () => playSlot(i))
			btn.addEventListener('click', () => { if (activeSlot !== i) return playSlot(i) }) // 재생 중인 슬롯 클릭 무시 
		grid.appendChild(btn)
	}
}

// ── IFrame Player API 준비 완료 콜백 ──
// 목적: API 로드 후 플레이어 인스턴스 생성
function onYouTubeIframeAPIReady() {
	player = new YT.Player('ytplayer', {
		width: '100%',
		height: '100%',
		videoId: '',
		playerVars: {
			autoplay: 0,
			rel: 0,
			modestbranding: 1,
		},
		events: {
			onStateChange: onPlayerStateChange
		}
	})
}

// ── 슬롯 재생 로직 ──
// 목적: 선택한 슬롯의 영상을 start~end 구간으로 반복 설정
function playSlot(index) {
	if (!player || !VIDEOS[index]) return

	// 이전 감시 타이머 정리
	clearInterval(loopTimer)

	// 활성 버튼 시각 업데이트
	// document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('active'))
	// document.querySelector(`.slot-btn[data-index="${index}"]`).classList.add('active')
	// 활성 버튼 시각 업데이트
	document.querySelectorAll('.slot-btn').forEach(b => {b.classList.remove('active', 'dimmed')
		if (parseInt(b.dataset.index) !== index) b.classList.add('dimmed')})
	document.querySelector(`.slot-btn[data-index="${index}"]`).classList.add('active')

	activeSlot   = index
	currentVideo = VIDEOS[index]

	// 같은 영상이면 seek만, 다른 영상이면 로드
	const currentId = player.getVideoData ? player.getVideoData().video_id : ''
	if (currentId === ytId(currentVideo.video)) {
		player.seekTo(currentVideo.start, true)
		player.playVideo()
	} else {
		player.loadVideoById({
			videoId: ytId(currentVideo.video),
			startSeconds: currentVideo.start,
			// endSeconds: currentVideo.end
			...(currentVideo.end > 0 && { endSeconds: currentVideo.end })
		})
	}

	updateInfo()

loopTimer = setInterval(() => {
	if (!player || !currentVideo) return
	const t = player.getCurrentTime()
	const end = currentVideo.end > 0 ? currentVideo.end : player.getDuration()
	if (currentVideo.end > 0 && t >= currentVideo.end) {
		player.seekTo(currentVideo.start, true)
	}
	// 진행 바 업데이트
	const ratio = (t - currentVideo.start) / (end - currentVideo.start)
	document.getElementById('loop-fill').style.width = Math.max(0, Math.min(1, ratio)) * 100 + '%'
	updateInfo(t)
}, 250)

/*
	loopTimer = setInterval(() => {
		if (!player || !currentVideo) return
			const t = player.getCurrentTime()
		if (currentVideo.end > 0 && t >= currentVideo.end) {
			player.seekTo(currentVideo.start, true)
		}
		// 진행 바 업데이트
		if (currentVideo.end > 0) {
			const ratio = (t - currentVideo.start) / (currentVideo.end - currentVideo.start)
			document.getElementById('loop-fill').style.width = Math.max(0, Math.min(1, ratio)) * 100 + '%'
		}
	}, 250)
*/

	/*
	// 구간 감시: 1000ms(1초)마다 현재 시간 확인 후 초과 시 시작점으로 복귀
	loopTimer = setInterval(() => {
		if (!player || !currentVideo) return
		const t = player.getCurrentTime()
		if (t >= currentVideo.end) {
			player.seekTo(currentVideo.start, true)
		}
		// 진행 바 업데이트
		const ratio = (t - currentVideo.start) / (currentVideo.end - currentVideo.start)
		document.getElementById('loop-fill').style.width = Math.max(0, Math.min(1, ratio)) * 100 + '%'
	}, 1000) */
}

// ── 플레이어 상태 변경 처리 ──
// 목적: 영상이 종료(state=0)되면 자동으로 시작점으로 되감기
function onPlayerStateChange(e) {
	if (e.data === YT.PlayerState.PLAYING) {
		updateInfo(player.getCurrentTime())
	}
	if (e.data === YT.PlayerState.ENDED && currentVideo) {
		player.seekTo(currentVideo.start, true)
		player.playVideo()
	}
}
/*
function onPlayerStateChange(e) {
	if (e.data === YT.PlayerState.ENDED && currentVideo) {
		player.seekTo(currentVideo.start, true)
		player.playVideo()
	}
}
*/
// ── 상태 텍스트 업데이트 ──
function updateInfo(t = 0) {
	if (!currentVideo) return
	const fmt = s => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`
	const end = currentVideo.end > 0 ? currentVideo.end : (player ? player.getDuration() : 0)
	const cur = fmt(t)
	const endStr = fmt(end)
	if (currentVideo.start === 0) {
		document.getElementById('now-info').textContent = `${cur} → ${endStr}`
	} else {
		const startStr = fmt(currentVideo.start)
		document.getElementById('now-info').textContent = `${startStr} → ${cur} → ${endStr}`
	}
}

/*
function updateInfo() {
	if (!currentVideo) return
	const fmt = s => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`
	const end = currentVideo.end > 0 ? currentVideo.end : (player ? player.getDuration() : 0)
	document.getElementById('now-info').textContent =
		`${fmt(currentVideo.start)} → ${fmt(end)}`
}

function updateInfo() {
	if (!currentVideo) return
	const fmt = s => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`
	document.getElementById('now-info').textContent =
		`${fmt(currentVideo.start)} → ${fmt(end)}`
}
*/
// ── 초기화 ──
buildGrid()
