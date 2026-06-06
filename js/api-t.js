//////////////////////////////////////////////////////////////////////
// https://developers.google.com/youtube/iframe_api_reference?hl=ko //
//////////////////////////////////////////////////////////////////////

// YouTube Player iframe API 불러오기
const api = document.createElement('script')
	api.src = "https://www.youtube.com/iframe_api"
	document.head.appendChild(api)

// youtube id 찾기
const id_find = id => {
	try {
		const url = new URL(id)
		return url.searchParams.get('v') ?? url.pathname.split('/').pop()
	} catch {
		return id
	}
}

// 시간 표시 변환
const time_convert = time => {
	if (typeof time === 'number') return time
	if (typeof time === 'string') {
		const sec = time.trim().replace(/s$/i, '')
		return sec.includes(':') ? sec.split(':').reduce((acc, cur) => acc * 60 + +cur, 0) : +sec
	}
	return 0
}

// 시작시간 예상치 못한 여러가지 경우의 수 대비
const time_find = id => {
	try {
		const time = new URL(id).searchParams.get('t')
		return time !== null ? time_convert(time) : 0
	} catch {
		return 0
	}
}

// 전역 변수 준비
let player = null
let video_click = -1 // 재생 전 초기 상태

// 왼쪽 영상 미리보기 불러오기
function total_list() {
	const list = document.getElementById('list')

	// 영상 목록을 반복해서 읽으면서 순서대로 불러오기
	for (let i = 0; i < video_list.length; i++) {
		const ready = video_list[i]
		const btn = document.createElement('button')
		btn.className = 'btn'
		btn.dataset.index = i

		// 미리보기 이미지 등록
		const img = document.createElement('img')
		img.src = `https://img.youtube.com/vi/${id_find(ready.id)}/mqdefault.jpg`

		// 미리보기 불러와
		btn.appendChild(img)
		list.appendChild(btn)

		// 첫 클릭 => 재생 시작
		// 이후 클릭 => 일시 정지, 이어서 재생 반복
		btn.addEventListener('click', () => {
			if (video_click === i && player.getPlayerState() === YT.PlayerState.PLAYING) {
					player.pauseVideo()
				}
			else if (video_click === i && player.getPlayerState() === YT.PlayerState.PAUSED) {
					player.playVideo()
				}
			else {
				loop(i)
			}
		})
	}
}


// 오른쪽 투명 오버레이 재생 조작
// 오버레이 3개 만들어서 광고 스킵 자리 제외
let overlay_ready = false
function overlay_click() {
	if (video_click === -1)
		return
	if (player.getPlayerState() === YT.PlayerState.PLAYING) {
		player.pauseVideo()
	}
	else if (player.getPlayerState() === YT.PlayerState.PAUSED) {
		player.playVideo()
	}
}

// 속도 느릴 때 에러 렉 방지
let player_ready = false

// iframe 준비
function onYouTubeIframeAPIReady() {
	player = new YT.Player('you_player', {
		width: '100%',
		height: '100%',
		videoId: '',
		playerVars: {
			autoplay: 0,
			rel: 0,
			controls: 0, // 유튜브 ui 숨김 (볼륨 조절용)
		},
		// 현재 상태 불러오기
		events: {
			onReady: () => { player_ready = true }, // 느릴 때 에러 방지
			onStateChange: onPlayerStateChange
		}
	})
}

// 시간 관리
let video_play = null
let play_bar_ctrl = null
let start_sec = 0
let end_sec = 0
let last_sec = 0

// 재생 준비
function loop(index) {

	// 예상 에러 발생시 진행을 멈추고 즉시 종료
	if (!player_ready) {
		setTimeout(() => loop(index), 100) // 100ms 후 재시도
		return
	}
	if (!player || !video_list[index])
		return

	// 오버레이 기능, 커서 상태 조절
	if (!overlay_ready) {
		overlay_ready = true
		document.getElementById('right').style.cursor = 'pointer'
		document.getElementById('overlay_small_1').style.cursor = 'pointer'
		document.getElementById('overlay_small_2').style.cursor = 'pointer'
	}
	document.getElementById('right').onclick = overlay_click
	document.getElementById('overlay_small_1').onclick = overlay_click
	document.getElementById('overlay_small_2').onclick = overlay_click

	// 타이머 값 계속 초기화
	clearInterval(play_bar_ctrl)

	// 버튼 강조 관리
	document.querySelectorAll('.btn').forEach(btn => {
		// 강조, 어둡게 삭제
		btn.classList.remove('active', 'blur')
		// 선택한 버튼 제외 나머지 버튼을 모두 어둡게
		if (parseInt(btn.dataset.index) !== index) btn.classList.add('blur')})
	// 일치하는 버튼만 강조
	document.querySelector(`.btn[data-index="${index}"]`).classList.add('active')

	// list index 이용할 준비
	video_click = index
	video_play = video_list[index]

	// 시간값들 여러 경우의 수 대비 및 정리
	const time_sec = time_find(video_play.id)
	end_sec = time_convert(video_play.end)
	start_sec = (() => {
		if (time_sec === 0) return time_convert(video_play.start)
		if (end_sec > 0 && end_sec <= time_sec) return 0
		return time_sec
	})()

	// 클릭한 영상 정보 id start end 값을 불러옴
	player.loadVideoById({
		videoId: id_find(video_play.id),
		startSeconds: start_sec,
		...(end_sec > 0 && {endSeconds: end_sec})
	})

	// 상태 갱신
	update()

	// 결정될 시간 값 관리
	if (end_sec === 0) {
		setTimeout(() => { last_sec = player.getDuration() }, 100) // 0 일때 100ms 후 영상길이 불러와서 반영하고 종료
	}
	else {
		last_sec = end_sec
	}

	// 진행 막대 관리
	play_bar_ctrl = setInterval(() => {
		// 에러 방지
		if (!player || !video_play) return
		if (player.getPlayerState() !== YT.PlayerState.PLAYING) return

		// 현재시간 종료시간 비율로 진행 막대 계산 100ms 마다
		const cur = player.getCurrentTime()
		const end = last_sec > 0 ? end_sec : player.getDuration()
		if (end_sec > 0 && cur >= end_sec) {
			player.seekTo(start_sec, true)
		}
		const ratio = (cur - start_sec) / (end - start_sec)
		document.getElementById('play-now').style.width = Math.max(0, Math.min(1, ratio)) * 100 + '%'
		update(cur)
	}, 100) // 100ms
}

// 유튜브 상태 확인
function onPlayerStateChange(event) {
	if (event.data === YT.PlayerState.ENDED && video_play) {
		player.seekTo(start_sec, true)
		player.playVideo()
	}
}

// 상태 메세지 실시간 업데이트
function update(time = 0) {
	const fmt = sec => `${Math.floor(sec/60)}:${String(Math.floor(sec%60)).padStart(2,'0')}`
	const cur = fmt(time)
	const end = end_sec > 0 ? fmt(end_sec) : fmt(player.getDuration())
	if (start_sec === 0) {
		document.getElementById('play-msg').textContent = `${cur} → ${end}`
	} else {
		document.getElementById('play-msg').textContent = `${fmt(start_sec)} → ${cur} → ${end}`
	}
}

// 볼륨 조절 막대 값 반영 시키기
document.getElementById('Volume-bar').addEventListener('input', Volume => {
	if (player) player.setVolume(+Volume.target.value)
})

// 시작
total_list()
