// https://developers.google.com/youtube/iframe_api_reference?hl=ko
// YouTube Player iframe API 불러오기
const tag = document.createElement('script')
	tag.src = "https://www.youtube.com/iframe_api"
	document.head.appendChild(tag)

// youtube id 코드 찾기
const id_find = id => id.includes('/') ? id.split('/').pop().split('?').shift():id

// 반복 구간 찾기
const time_convert = time => {
	if (typeof time === 'string')
		return time.includes(':') ? time.split(':').reduce((acc, cur) => acc * 60 + +cur, 0):+time
	return 0
}

// 변수 준비
let player = null
let video_click = -1 // 재생 전 초기 상태

// 왼쪽 영상 미리보기 불러오기
function total_list() {
	const list = document.getElementById('list')


	/*
    // onclick은 마지막 할당만 유효 → 중복 등록 불가
    document.getElementById('overlay_big').onclick = overlay_click
    document.getElementById('overlay_small_1').onclick = overlay_click
    document.getElementById('overlay_small_2').onclick = overlay_click
		// 커서 변경
		document.getElementById('overlay_big').style.cursor = 'pointer'
		document.getElementById('overlay_small_1').style.cursor = 'pointer'
		document.getElementById('overlay_small_2').style.cursor = 'pointer'
		*/




		
	// 영상 목록 순서대로 불러오기
	for (let i = 0; i < video_list.length; i++) {
		const ready = video_list[i]
		const btn = document.createElement('button')
		btn.className = 'btn'
		btn.dataset.index = i

		// 미리보기 이미지 등록
		const img = document.createElement('img')
		img.src = `https://img.youtube.com/vi/${id_find(ready.id)}/mqdefault.jpg`

		// 마우스 올라갔을때 강조 효과
		btn.addEventListener('mouseenter', () => {
			if (btn.classList.contains('blur'))
				btn.style.filter = 'brightness(100%)'
		})

		// 마우스 나갔을때 강조효과 종료
		btn.addEventListener('mouseleave', () => {
			if (btn.classList.contains('blur'))
				btn.style.filter = ''
		})

		//미리보기 불러와
		btn.appendChild(img)
		list.appendChild(btn)

		// 첫 클릭 = 재생
		// 이후 클릭 = 일시 정지, 이어서 재생 반복
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

		/*
		// 화면 절반 오른쪽도 같은 기능
		// 첫 클릭 아무것도 안함
		// 재생 시작 후 클릭 일시정지, 이어서 재생
		document.getElementById('overlay_big').addEventListener('click', overlay_click)
		document.getElementById('overlay_small_1').addEventListener('click', overlay_click)
		document.getElementById('overlay_small_2').addEventListener('click', overlay_click)


		*/
	}
}


// 오른쪽 투명 오버레이 재생 조작
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
		},
		// 현재 재생 상태 불러오기
		events: {
			onReady: () => { player_ready = true },
			onStateChange: onPlayerStateChange
		}
	})
}

// 변수 준비
let play_bar_ctrl = null
let video_play = null
let overlay_init = false

// 재생 준비
function loop(index) {
	// 에러 발생시 즉시 종료
	if (!player_ready) {
		setTimeout(() => loop(index), 200)  // 200ms 후 재시도
		return
	}
	if (!player || !video_list[index])
		return

    // 여기서부터는 player_ready = true 보장
    if (!overlay_init) {
        overlay_init = true
        document.getElementById('overlay_big').style.cursor = 'pointer'
        document.getElementById('overlay_small_1').style.cursor = 'pointer'
        document.getElementById('overlay_small_2').style.cursor = 'pointer'
    }
    document.getElementById('overlay_big').onclick = overlay_click
    document.getElementById('overlay_small_1').onclick = overlay_click
    document.getElementById('overlay_small_2').onclick = overlay_click

	// 타이머 값 계속 초기화
	clearInterval(play_bar_ctrl)

	// 버튼 상태 관리
	// 모든 버튼을 검색
	document.querySelectorAll('.btn').forEach(btn => {
		// 버튼 상태 강조, 어둡게 초기화
		btn.classList.remove('active', 'blur')
		// 선택한 버튼 값과 불일치하면 어둡게
		if (parseInt(btn.dataset.index) !== index) btn.classList.add('blur')})
	// 일치하는 버튼을 탐색하면 그 버튼만 관리
	document.querySelector(`.btn[data-index="${index}"]`).classList.add('active')

	// index 이용할 준비
	video_click = index
	video_play = video_list[index]

	// 클릭한 영상 정보 id start end 값을 불러옴
	player.loadVideoById({
		videoId: id_find(video_play.id),
		startSeconds: time_convert(video_play.start),
		...(time_convert(video_play.end) > 0 && {endSeconds: time_convert(video_play.end)})
	})

	update()

	play_bar_ctrl = setInterval(() => {
		// if (!player || !video_play) return
		const cur   = player.getCurrentTime()
		const end = time_convert(video_play.end) > 0 ? time_convert(video_play.end):player.getDuration()
		if (time_convert(video_play.end) > 0 && cur >= time_convert(video_play.end)) {
			player.seekTo(time_convert(video_play.start), true)
		}
		// 진행 막대 비율 계산
		const ratio = (cur - time_convert(video_play.start)) / (end - time_convert(video_play.start))
		document.getElementById('play-now').style.width = Math.max(0, Math.min(1, ratio)) * 100 + '%'
		update(cur)
	}, 100) // 100ms
}

function onPlayerStateChange(event) {
	if (event.data === YT.PlayerState.ENDED && video_play) {
		player.seekTo(time_convert(video_play.start), true)
		player.playVideo()
	}
}

function update(time = 0) {
	// if (!video_play) return
	const fmt = sec => `${Math.floor(sec/60)}:${String(Math.floor(sec%60)).padStart(2,'0')}`
	const cur = fmt(time)
	const end = time_convert(video_play.end) > 0 ? video_play.end:fmt(player.getDuration())
	if (time_convert(video_play.start) === 0) {
		document.getElementById('play-msg').textContent = `${cur} → ${end}`
	} else {
		const start = video_play.start
		document.getElementById('play-msg').textContent = `${start} → ${cur} → ${end}`
	}
}

total_list()