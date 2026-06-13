/*
https://developers.google.com/youtube/iframe_api_reference?hl=ko
https://gist.github.com/Araxeus/fc574d0f31ba71d62215c0873a7b048e
http://developer.mozilla.org/
https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Events
https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values
https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_code_values
*/

// YouTube Player iframe API 불러오기
const api = document.createElement('script')
	api.src = "https://www.youtube.com/iframe_api"
	document.head.appendChild(api)

// iframe가 들어갈 변수 준비
let player = null
// iframe 준비
function onYouTubeIframeAPIReady()
{
	player = new YT.Player('you_player',
	{
		width: '100%',
		height: '100%',
		videoId: '',
		playerVars:
		{
			autoplay: 0, // 자동재생 방지
			rel: 0, // 영상 종료 때 추천 방지
			fs: 0, // 풀 스크린 버튼 숨김
			disablekb: 1, // 유튜브 자체 키보드 조작 기능 방지 방향키 숫자 0~9 등
			controls: 0, // 유튜브 일부 ui 숨김 (볼륨 조절용)
		},
		// 현재 상태 불러오기
		events:
		{
			onReady: () =>
			{
				player.setVolume(+volume_bar.value) // value="25" 적용
			},
			onStateChange : onPlayerStateChange
		}
	})
}

// 영상 상태 확인
// YT.PlayerState.PLAYING = 1
// YT.PlayerState.PAUSED = 2
const play = () => player?.getPlayerState() === YT.PlayerState.PLAYING
const pause = () => player?.getPlayerState() === YT.PlayerState.PAUSED
const play_now = () => play() || pause() // !play_now === !play && !pause

// youtube id 찾기
const id_find = id =>
{
	try
	{
		const url = new URL(id)
		return url.searchParams.get('v') ?? url.pathname.split('/').pop()
	}
	catch
	{
		return id
	}
}

// 시간 표시 변환
const time_convert = time =>
{
	if (typeof time === 'number')
		return time
	if (typeof time === 'string')
	{
		const sec = time.replace(/[^0-9:]/g, '')
		return sec.includes(':') ? sec.split(':').reduce((acc, cur) => acc * 60 + +cur, 0) : +sec
	}
	return 0
}

// 여러가지 경우의 수 대비
const time_find = id =>
{
	try
	{
		const time = new URL(id).searchParams.get('t')
		return time !== null ? time_convert(time) : 0
	}
	catch
	{
		return 0
	}
}




 // 최초 재생 시작하기 전
let img_click = -1


// 왼쪽 영상 미리보기 불러오기
function total_list()
{
	const list = document.getElementById('list')

	// 영상 목록을 반복해서 읽으면서 순서대로 불러오기
	for (let num = 0; num < video_list.length; num++)
	{
		const ready = video_list[num]
		const btn = document.createElement('button')
		btn.className = 'btn'
		btn.dataset.num = num

		// 미리보기 이미지 등록
		const img = document.createElement('img')
		img.src = `https://img.youtube.com/vi/${id_find(ready.id)}/mqdefault.jpg`

		// 미리보기 불러와
		btn.appendChild(img)
		list.appendChild(btn)

		// 첫 클릭 => 재생 시작
		// 이후 클릭 => 일시 정지, 이어서 재생 반복
		btn.addEventListener('click', () =>
		{
			if (img_click === num)
			{
				if (play())
				{
					player.pauseVideo()
				}
				else if (pause())
				{
					player.playVideo()
				}
			}
			else
			{
				loop(num)
			}
		})
	}
}


















/*
현재 선택한 썸네일의 영상 번호를 어떻게 불러올까?
썸네일 강조 표시
썸네일 재생 일시정지 클릭
*/




// 시간 관리
let video_play = null
let play_bar_ctrl = null
let start_sec = 0
let end_sec = 0
let last_sec = 0




function loop(num)
{
	if (!player || !video_list[num])
		return

	// 활성화 버튼 강조 나머지 버튼 어둡게
	document.querySelectorAll('.btn').forEach(btn =>
	{	
		// btn.classList.remove('active', 'blur')
		const click = Number(btn.dataset.num) === num
		btn.classList.toggle('active', click)
		btn.classList.toggle('blur', !click)
	})

	img_click = num
	video_play = video_list[num]

	// 시간값들 여러 경우의 수 대비 및 정리
	const time_sec = time_find(video_play.id)
	end_sec = time_convert(video_play.end)

	if (time_sec === 0)
	{
		start_sec = time_convert(video_play.start)
	}
	else if (end_sec > 0 && end_sec <= time_sec)
	{
		start_sec = 0
	}
	else
	{
		start_sec = time_sec
	}

	// 클릭한 영상 정보 id start end 값을 불러옴
	// loadVideoById == 즉시 재생 기능 (조회수 누적 안됨)
	// cueVideoById == 재생 준비 (조회수 누적 가능)
	player.cueVideoById(
	{
		videoId : id_find(video_play.id),
		startSeconds : start_sec,
		...(end_sec > 0 && {endSeconds : end_sec})
	})

	// 상태 초기화
	player.setPlaybackRate(1)
	// update()

	// 결정될 시간 값 관리
	if (end_sec === 0)
	{
		last_sec = player.getDuration() // 문제 있으면 아래꺼 다시 사용
		/*
		setTimeout(() =>
		{
			last_sec = player.getDuration()
		}, 100) // 0 일때 100ms 후 영상길이 불러와서 반영하고 종료
		*/
	}
	else
	{
		last_sec = end_sec
	}

	// 진행 막대 관리
	play_bar_ctrl = setInterval(() =>
	{
		// 에러 방지
		if (!player || !video_play) return
		if (!play()) return

		// 현재시간 종료시간 비율로 진행 막대 계산 100ms 마다
		const cur = player.getCurrentTime()
		const end = last_sec > 0 ? end_sec : player.getDuration()
		if (end_sec > 0 && cur >= end_sec)
		{
			player.seekTo(start_sec, true)
		}
		const ratio = (cur - start_sec) / (end - start_sec)
		document.getElementById('play_now').style.width = Math.max(0, Math.min(1, ratio)) * 100 + '%'
		update(cur)
	}, 100) // 100ms

}









// 상태 메세지 실시간 업데이트
function update(time = 0) {
	const fmt = sec => `${Math.floor(sec/60)}:${String(Math.floor(sec%60)).padStart(2,'0')}`
	const cur = fmt(time)
	const end = end_sec > 0 ? fmt(end_sec) : fmt(player.getDuration())
	if (start_sec === 0) {
		document.getElementById('play_msg').textContent = `${cur} → ${end}`
	} else {
		document.getElementById('play_msg').textContent = `${fmt(start_sec)} → ${cur} → ${end}`
	}
}












































































const volume_bar = document.getElementById('volume_bar')

// 볼륨 조절 막대 값 반영 시키기
volume_bar.addEventListener('input', () =>
{
	if (player)
	{
		player.setVolume(+volume_bar.value)
	}
})

// 볼륨 조절에 오버레이 간섭 방지
document.getElementById('volume').addEventListener('mousedown', drag => drag.stopPropagation())
document.getElementById('volume').addEventListener('click', click => click.stopPropagation())

// 스페이스 바가 할 수 있는 모든 기능을 무시하고 play_or_pause() 만을 실행
// 숫자 패드 컨트롤 또는 쉬프트 +-로 재생 속도조절
// 숫자 패드 +-로 볼륨 5씩 조절
document.addEventListener('keydown', key =>
{
	if (!player || !play_now())
		return
	if (key.code === 'Space')
	{
		key.preventDefault()
		play_or_pause()
	}
	else if (key.ctrlKey || key.shiftKey)
	{
		if  (key.code === 'NumpadAdd' || key.code === 'NumpadSubtract')
		{
			key.preventDefault()
			const keys = key.code === 'NumpadAdd'
			const updown = keys ? 0.05 : -0.05
			const limit = keys ? 2 : 0.25
			const minmax  = keys ? Math.min : Math.max
			player.setPlaybackRate(minmax(limit, (player.getPlaybackRate() + updown)))
		}
	}
	else if (key.code === 'Numpad0')
	{
		key.preventDefault()
		player.setPlaybackRate(1)
	}
	else if (key.code === 'NumpadAdd')
	{
		key.preventDefault()
		volume_value(+5)
	}
	else if (key.code === 'NumpadSubtract')
	{
		key.preventDefault()
		volume_value(-5)
	}
})

// 마우스 휠 소리 크기 조절
document.addEventListener('wheel', wheel =>
{
	wheel.preventDefault()
	volume_value(wheel.deltaY < 0 ? +5 : -5)
})


function volume_value(plma)
{
	const volume = player.getVolume()
	const updown = plma > 0
		? Math.floor(volume / 5) * 5 + 5
		: Math.ceil(volume / 5) * 5 - 5
	const change = Math.min(100, Math.max(0, updown))
	player.setVolume(change)
	volume_bar.value = change
}

// 재생 일시중지
function play_or_pause() {
	if (play()) { player.pauseVideo() }
	else if (pause()) { player.playVideo() }
}

const overlay = document.querySelectorAll('#right, #ad')
function onPlayerStateChange(event) {
	const pop = event.data === 1 || event.data === 2
	overlay.forEach(overlay => { overlay.style.cursor = pop ? 'pointer' : 'default' })
	overlay.forEach(overlay => { overlay.onclick = pop ? play_or_pause : null })
	document.getElementById('ad').style.pointerEvents = pop ? 'auto' : 'none'
	if (event.data === YT.PlayerState.ENDED && video_play) {
		player.seekTo(start_sec, true)
		player.playVideo()
	}
}


total_list()