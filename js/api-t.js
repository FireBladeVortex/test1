// https://developers.google.com/youtube/iframe_api_reference?hl=ko
// YouTube Player iframe API 불러오기
const tag = document.createElement('script')
    tag.src = "https://www.youtube.com/iframe_api"
    document.head.appendChild(tag)

// youtube id 코드 찾기
const id_find = id => id.includes('/') ? id.split('/').pop().split('?').shift():id

// 반복 구간 찾기
const time_convert = time => time.includes(':') ? time.split(':').reduce((acc, cur) => acc * 60 + +cur, 0):time

// 변수 준비
let player = null
let video_click = -1 // 재생 전 초기 상태

// 영상 미리보기 불러오기
function total_list() {
    const list = document.getElementById('list')
    // list.innerHTML = ''

    for (let i = 0; i < video_list.length; i++) {
        const ready = video_list[i]
        const btn = document.createElement('button')
        btn.id = 'btn'
        btn.dataset.index = i

        // 미리보기 등록
        const img = document.createElement('img')
        img.src = `https://img.youtube.com/vi/${id_find(ready.id)}/default.jpg`
        btn.appendChild(img)

        // 첫 클릭 = 재생
        // 이후 클릭 = 일시 정지, 이어서 재생 반복
		btn.addEventListener('click', () => {
            if (video_click === i && player.getPlayerState() === YT.PlayerState.PLAYING) {
                return player.pauseVideo()
            }
            else if (video_click === i && player.getPlayerState() === YT.PlayerState.PAUSED) {
                return player.playVideo()
            }
            else {
                loop(i)
            }
        })
        //미리보기 불러와
        list.appendChild(btn)
    }
}

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
		events: {
			onStateChange: onPlayerStateChange
		}
	})
}

// 변수 준비
let play_bar_ctrl = null
let video_play = null

// 재생 준비
function loop(index) {
    // 에러 발생시 즉시 종료
	// if (!player || !video_list[index]) return

    // 타이머 초기화
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
	}, 1000) // 1000ms
}

function onPlayerStateChange(event) {
	if (event.data === YT.PlayerState.ENDED && video_play) {
		player.seekTo(video_play.start, true)
		player.playVideo()
	}
}

function update(time = 0) {
	// if (!video_play) return
	const fmt = sec => `${Math.floor(sec/60)}:${String(Math.floor(sec%60)).padStart(2,'0')}`
	// const end = time_convert(video_play.end) > 0 ? time_convert(video_play.end) : (player ? player.getDuration() : 0)
	const end = time_convert(video_play.end) > 0 ? time_convert(video_play.end):player.getDuration()
	const cur = fmt(time)
	const end_time = video_play.end
	if (time_convert(video_play.start) === 0) {
		document.getElementById('play-msg').textContent = `${cur} → ${end_time}`
	} else {
		const start_time = video_play.start
		document.getElementById('play-msg').textContent = `${start_time} → ${cur} → ${end_time}`
	}
}

total_list()
