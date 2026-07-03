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

// iframe 들어갈 변수 준비 (계속 바뀌는 값)
let player = null

// iframe 호출
function onYouTubeIframeAPIReady()
{
	player = new YT.Player("you_player",
	{
		width: "100%",
		height: "100%",
		videoId: "d8dqNFNrXPk",
		playerVars:
		{
			autoplay: 0, // 자동재생 방지
			rel: 0, // 영상 종료 때 추천 방지
			// fs: 0, // 풀 스크린 버튼 숨김
			// disablekb: 1, // 유튜브 자체 키보드 조작 기능 방지 방향키 숫자 0~9 등
			// controls: 0, // 유튜브 일부 ui 숨김
			origin: window.location.origin,
		},
		// 현재 상태 불러오기
		events:
		{
			onReady: () =>
			{
				player.setVolume(+volume_bar.value) // 현재 value 적용
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
const play = () => player?.getPlayerState?.() === YT.PlayerState.PLAYING
const pause = () => player?.getPlayerState?.() === YT.PlayerState.PAUSED
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
		// 이후 미리보기 클릭 => 일시 정지, 이어서 재생 반복
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

// 시간 관리
let sec_start = null
let sec_end = null
// 시간 메세지
let msg_start = null
let msg_end = null

function click_img(num)
{
	// 활성화 버튼 강조 나머지 버튼 어둡게
	document.querySelectorAll(".btn").forEach(btn =>
	{
		const click = +(btn.dataset.num) === num
		btn.classList.toggle("active", click)
		btn.classList.toggle("blur", !click)
	})
	// total_list에서 클릭한 썸네일 또 클릭할때 쓰는 장치
	img_click = num
}


// youtube 정보 가져오기 cue 상태 되기전
function ready_data(id, start = 0, end = 0)
{
	// 주소에서 id 추출
	const url = new URL(id)
	const get_id = url.searchParams.get("v") ?? url.pathname.split("/").pop()
	if (arguments.length === 1)
	{
		return get_id
	}

	// 주소에서 t값 추출 + 시작시간 비교후 결정
	const get_start = parseInt(url.searchParams.get("t"))
	const set_start = !Number.isNaN(get_start) ? get_start : start
	;[sec_start, msg_start] = data_split(set_start)

	// 종료 시간 결정(getDuration() 아님)
	;[sec_end, msg_end] = data_split(end)

	// 영상 불러오기
	player.cueVideoById(
	{
		videoId : get_id,
		startSeconds : sec_start,
		...(sec_end > 0 && {endSeconds : sec_end})
	})

}


// 시간값 시간표시 정리
function data_split(time) 
{
	if (typeof time === "number" && time > 0)
	{
		const date = new Date(time * 1000)
		const hh = date.getUTCHours()
		const mm = date.getUTCMinutes()
		const ss = date.getUTCSeconds()
		const sss = time
		const hms = hms_convert([hh, mm, ss])
		return [ sss, hms ]
	}
	else if (typeof time === "string")
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
	{
		return [ 0, 0 ]
	}
}


// 시간 메세지 표기법 정리 24:00:00
function hms_convert(hhmmss)
{
	const hms_check = hhmmss.findIndex(num => num !== 0)
	const slice_ready = hms_check === -1 ? hhmmss.length - 1 : hms_check
	const slice_zero = hhmmss.slice(slice_ready)
	const ctrl_zero = slice_zero.map((num, idx) => idx === 0 ? `${num}` : `${num}`.padStart(2,"0"))
	const hms = ctrl_zero.join(":")
	return hms
}



function ctrl_view()
{
	const cur = player.getCurrentTime()
	const ratio = (cur - sec_start) / (sec_end - sec_start)
	document.getElementById("play_now").style.width = Math.max(0, Math.min(1, ratio)) * 100 + "%"

	
	/*
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
		*/


}


// 볼륨 변수
const volume = document.getElementById("volume")
const volume_bar = document.getElementById("volume_bar")
const stopp = move => move.stopPropagation()

// 볼륨 조절 막대 값 반영 시키기
volume_bar.addEventListener("input", () =>
{
	player.setVolume(+volume_bar.value)
})

// 소리 크기 조절 간섭 방지
volume.addEventListener("mousedown", stopp)
volume.addEventListener("click", stopp)

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
document.addEventListener("wheel", wheel =>
{
	wheel.preventDefault()
	volume_value(wheel.deltaY < 0 ? +5 : -5)
},
{
	passive: false
})


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

// 재생 속도 조절
function play_speed(key, plma)
{
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

let play_bar = null

function onPlayerStateChange(event)
{
	// 영상 정보 불러온 상태(재생 시작 전)
	if (event.data === 5)
	{
		player.setPlaybackRate(1)
		if (sec_end === 0)
		{
			[sec_end, msg_end] = data_split(player.getDuration())
		}
		document.getElementById("play_msg").textContent = player.getVideoData().title 
	}
	// 재생 중일 때 100ms마다 진행바 갱신
	if (event.data === 1)
	{
		clearInterval(play_bar) // 인터벌 중복 호출 방지
		play_bar = setInterval(ctrl_view, 100)
	}
	else
	{
		clearInterval(play_bar)
	}
	// 영상 재시작
	if (event.data === 0)
	{
		player.seekTo(sec_start, true)
		player.playVideo()
	}
	//
	const pop = [1, 2, 3].includes(event.data)
	document.querySelectorAll("#right, #ad").forEach(overlay =>
	{
		overlay.style.cursor = pop ? "pointer" : "default"
		overlay.onclick = pop ? play_or_pause : null
	})
	document.getElementById("ad").style.pointerEvents = pop ? "auto" : "none"
}

// 싲가
total_list()