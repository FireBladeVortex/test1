/*

https://developers.google.com/youtube/iframe_api_reference?hl=ko

https://gist.github.com/Araxeus/fc574d0f31ba71d62215c0873a7b048e

http://developer.mozilla.org/

https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Events

https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values

https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_code_values

*/

// YouTube Player iframe API 불러오기
const api = document.createElement("script")
	api.src = "https://www.youtube.com/iframe_api"
	document.head.appendChild(api)

// iframe 들어갈 변수 준비
let player = null

// iframe 호출
function onYouTubeIframeAPIReady()
{
	player = new YT.Player("you_player",
	{
		width: "100%",
		height: "100%",
		videoId: "",
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

/*
영상 상태 확인
YT.PlayerState.ENDED = 0
YT.PlayerState.PLAYING = 1
YT.PlayerState.PAUSED = 2
YT.PlayerState.BUFFERING = 3
YT.PlayerState.CUED = 5
*/
const play = () => player.getPlayerState() === YT.PlayerState.PLAYING
const pause = () => player.getPlayerState() === YT.PlayerState.PAUSED
const play_now = () => play() || pause() // !play_now === !play && !pause




// 최초 재생 시작하기 전 상태
let img_click = null

// 왼쪽 영상 미리보기 불러오기
function total_list()
{
	const list = document.getElementById("list")

	// 영상 목록을 반복해서 읽으면서 순서대로 불러오기
	for (let num = 0; num < video_list.length; num++)
	{
		const ready = video_list[num]
		const btn = document.createElement("button")
		btn.className = "btn"
		btn.dataset.num = num

		// 미리보기 이미지 등록
		const img = document.createElement("img")
		img.src = `https://img.youtube.com/vi/${ready_data(ready.id)}/mqdefault.jpg`

		// 미리보기 불러와
		btn.appendChild(img)
		list.appendChild(btn)

		// 첫 클릭 => 재생 시작
		// 이후 클릭 => 일시 정지, 이어서 재생 반복
		btn.addEventListener("click", () =>
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
				else
					return
			}
			else
			{
				click_img(num)
				ready_data(ready.id, ready.start, ready.end)
			}
		})
	}
}

// 플레이 상태 관리
// let video_play = null
// 진행 막대 변수
let play_bar_ctrl = null
//
let get_id = null
// 시간 관리
let sec_start = null
let sec_end = null
let sec_last = null
let get_start = null
let get_end = null
// 시간 메세지
let msg_start = null
let msg_end = null

let try_count = null // (추가)

function click_img(num)
{
	// 활성화 버튼 강조 나머지 버튼 어둡게
	document.querySelectorAll(".btn").forEach(btn =>
	{
		const click = +btn.dataset.num === num
		btn.classList.toggle("active", click)
		btn.classList.toggle("blur", !click)
	})
	// total_list에서 클릭한 썸네일 또 클릭할때 쓰는 장치
	img_click = num
}


// youtube id 가져오기
function ready_data(id, start = 0, end = 0)
{
	const url = new URL(id)
	get_id = url.searchParams.get("v") ?? url.pathname.split("/").pop()
	if (arguments.length === 1)
	{
		return get_id
	}

	const get_start = parseInt(url.searchParams.get("t") ?? 0)

	[sec_start, msg_start] = get_start > 0 ? data_split(get_start) : data_split(start)
	[sec_end, msg_end] = end !== 0 ? data_split(end) : data_split(player.getDuration())

	
	const get_end = sec_end > 0 ? sec_end : player.getDuration()
		player.cueVideoById(
		{
			videoId : get_id,
			startSeconds : sec_start,
			...(get_end > 0 && {endSeconds : get_end})
		})
	/*
	try_count = 0
	try_ready = setInterval(data_try, 100)
	*/

}



function data_split(time) 
{
	if (typeof time === 'number' && time > 0)
	{
		const date = new Date(time * 1000)
		const hh = date.getUTCHours()
		const mm = date.getUTCMinutes()
		const ss = date.getUTCSeconds()
		const sss = time
		const hms = hms_convert([hh, mm, ss])
		return [ sss, hms ]
	}
	else if (typeof time === 'string')
	{
		const fix = time.replace(/;/g, ":")
		const fix_check = time.includes(":")
		if (fix_check)
		{
			const fix_hms = fix.split(":")
			const ss = +(fix_hms.pop())
			const mm = fix_hms.length ? +(fix_hms.pop()) : 0
			const hh = fix_hms.length ? +(fix_hms.pop()) : 0
			const sss = hh * 3600 + mm * 60 + ss
			const hms = hms_convert([hh, mm, ss])
			return [ sss, hms ]
		}
	}
	else
		return 0
}


function hms_convert(hhmmss)
{
	const hms_check = hhmmss.findIndex(num => num !== 0)
	const slice_ready = hms_check === -1 ? hhmmss.length - 1 : hms_check
	const slice_zero = hhmmss.slice(slice_ready)
	const ctrl_zero = slice_zero.map((num, idx) => idx === 0 ? `${num}` : `${num}`.padStart(2,"0"))
	const hms = ctrl_zero.join(":")
	return hms
}


// ready_data로 다시 넣기
function data_try()
{
	try_count++
	if (try_count++ > 30)
	{
		clearInterval(try_ready)
		return
	}

	const get_end = sec_end > 0 ? sec_end : player.getDuration()
	if (!Number.isNaN(get_end) && get_end > 0)
	{
		clearInterval(try_ready)
		player.cueVideoById(
		{
			videoId : get_id,
			startSeconds : sec_start,
			...(get_end > 0 && {endSeconds : get_end})
		})
	}
}



function ctrl_view()
{
	const cur = player.getCurrentTime()
	const [, msg_cur] = data_split(cur)
	if (msg_end && msg_start)
	{
		if (sec_start === 0)
		{
			document.getElementById("play_msg").textContent = `${msg_cur} < ${msg_end}`
		}
		else
		{
			document.getElementById("play_msg").textContent = `${msg_start} < ${msg_cur} > ${msg_end}`
		}
	}
	const end = sec_end > 0 ? sec_end : player.getDuration()
	if (sec_end > 0 && cur >= sec_end)
	{
		player.seekTo(sec_start, true)
	}
	const ratio = (cur - sec_start) / (end - sec_start)
	document.getElementById("play_now").style.width = Math.max(0, Math.min(1, ratio)) * 100 + "%"
}


// 볼륨 변수
const volume = document.getElementById("volume")
const volume_bar = document.getElementById("volume_bar")
const stop = move => move.stopPropagation()

// 볼륨 조절 막대 값 반영 시키기
volume_bar.addEventListener("input", () =>
{
	//if (player)
	//{
		player.setVolume(+volume_bar.value)
	//}
})

// 소리 크기 조절 간섭 방지
volume.addEventListener("mousedown", stop)
volume.addEventListener("click", stop)

// 해당하는 키 입력 기본 작동을 무시
// 스페이스 바가 play_or_pause()를 실행
// 숫자 패드 컨트롤 또는 쉬프트 +-로 재생 속도 조절 (보류)
// 숫자 패드 +-로 소리 크기 조절
document.addEventListener("keydown", key =>
{
	const add = key.code === "NumpadAdd"
	const sub = key.code === "NumpadSubtract"
	// const cs = key.ctrlKey || key.shiftKey
	/*
	if (!cs)
	{
	*/
		if (add)
		{
			key.preventDefault()
			volume_value(+5)
		}
		else if (sub)
		{
			key.preventDefault()
			volume_value(-5)
		}
	/*
	}
	else if (cs && add || sub)
	{
		key.preventDefault()
	}
	*/
	// 준비안됐으면 작동 중지
	if (!player || !play_now())
		return
	// 스페이스 바
	if (key.code === "Space")
	{
		key.preventDefault()
		play_or_pause()
	}
	/*
	else if (cs && add || sub)
	{
		key.preventDefault()
		const updown = add ? 0.05 : -0.05
		const limit = add ? 2 : 0.25
		const minmax  = add ? Math.min : Math.max
		player.setPlaybackRate(minmax(limit, (player.getPlaybackRate() + updown)))
	}
	else if (key.code === "Numpad0")
	{
		key.preventDefault()
		player.setPlaybackRate(1)
	}
	*/
})

// 마우스 휠 소리 크기 조절 및 오작동 억제
document.querySelectorAll("#left, #right").forEach(lr =>
{
	lr.addEventListener("wheel", wheel =>
	{
		wheel.preventDefault()
		if (lr.id === "right")
		{
			volume_value(wheel.deltaY < 0 ? +5 : -5)
		}
	})
})

// 재생 속도 조절
function play_speed(key, plma)
{
}

// 소리 크기 조절
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
function play_or_pause()
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

// 동영상 상태가 변화하면 즉시 작동
/*
영상 상태 확인
YT.PlayerState.ENDED = 0
YT.PlayerState.PLAYING = 1
YT.PlayerState.PAUSED = 2
YT.PlayerState.BUFFERING = 3
YT.PlayerState.CUED = 5
*/

function onPlayerStateChange(event)
{
	const pop = [1, 2, 3].includes(event.data)
	document.querySelectorAll("#right, #ad").forEach(overlay =>
	{
		overlay.style.cursor = pop ? "pointer" : "default"
		overlay.onclick = pop ? play_or_pause : null
	})
	document.getElementById("ad").style.pointerEvents = pop ? "auto" : "none"
	if (event.data === 0)
	{
		player.seekTo(sec_start, true)
		player.playVideo()
	}
	if (event.data === 5)
	{
		clearInterval(ctrl_view)
		update_msg()
		player.setPlaybackRate(1)
	}
	else if (event.data === 1)
	{ // 진행 막대 관리
		setInterval(ctrl_view, 100) // 100ms
	}
}

// 싲가
total_list()